const crypto = require('node:crypto');
const { assertAmount } = require('../../shared/money');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function createLedgerService(db) {
  function getPartnerOrThrow(companyId, partnerId) {
    const row = db.prepare('SELECT * FROM partners WHERE company_id = ? AND id = ?').get(companyId, partnerId);
    if (!row) throw new Error('거래처를 찾을 수 없습니다');
    return row;
  }

  function sumBilled(companyId, partnerId) {
    return db.prepare(
      'SELECT COALESCE(SUM(total_amount),0) AS s FROM invoices WHERE company_id = ? AND partner_id = ?'
    ).get(companyId, partnerId).s;
  }

  function sumPaid(companyId, partnerId) {
    return db.prepare(
      'SELECT COALESCE(SUM(amount),0) AS s FROM payments WHERE company_id = ? AND partner_id = ?'
    ).get(companyId, partnerId).s;
  }

  function outstandingOf(companyId, partnerId) {
    return sumBilled(companyId, partnerId) - sumPaid(companyId, partnerId);
  }

  // running_balance 체인은 기표순(rowid) 기준 — entry_date 역전(소급 입금 등)에도 체인 정합 유지
  function lastBalance(companyId, partnerId) {
    const row = db.prepare(
      'SELECT running_balance FROM ledger_entries WHERE company_id = ? AND partner_id = ? ORDER BY rowid DESC LIMIT 1'
    ).get(companyId, partnerId);
    return row ? row.running_balance : 0;
  }

  // FIFO(발행일 오래된 순) 기준 청구서별 충당 스냅샷 — 순수 조회, 단일 진실원천(누적 입금)
  function snapshotAllocations(companyId, partnerId) {
    const invs = db.prepare(
      `SELECT id, invoice_no, billing_month, total_amount FROM invoices
       WHERE company_id = ? AND partner_id = ? ORDER BY issue_date ASC, invoice_no ASC`
    ).all(companyId, partnerId);
    let left = sumPaid(companyId, partnerId);
    return invs.map(inv => {
      const allocated = Math.min(Math.max(left, 0), inv.total_amount);
      left -= allocated;
      const remaining = inv.total_amount - allocated;
      return {
        invoiceId: inv.id,
        invoiceNo: inv.invoice_no,
        billingMonth: inv.billing_month,
        total: inv.total_amount,
        allocated,
        remaining,
        status: remaining === 0 ? 'PAID' : (allocated > 0 ? 'PARTIAL' : 'UNPAID')
      };
    });
  }

  function recordPayment({ companyId, partnerId, paymentDate, amount, method, memo } = {}) {
    if (!companyId) throw new Error('companyId가 필요합니다');
    getPartnerOrThrow(companyId, partnerId);
    assertAmount(amount);
    if (amount <= 0) throw new Error('입금액은 1원 이상이어야 합니다');
    if (!DATE_RE.test(paymentDate || '') || Number.isNaN(Date.parse(paymentDate))) {
      throw new Error('입금일자는 YYYY-MM-DD 형식이어야 합니다');
    }

    // 초과입금 정책: 에러 (미수잔액 초과분은 자동반환하지 않음 — UI 확인 다이얼로그 경로)
    const outstanding = outstandingOf(companyId, partnerId);
    if (amount > outstanding) {
      throw new Error(`입금액이 미수잔액을 초과합니다 (미수 ${outstanding}원, 초과 ${amount - outstanding}원)`);
    }

    const before = snapshotAllocations(companyId, partnerId);
    const paymentId = crypto.randomUUID();
    const ledgerId = crypto.randomUUID();

    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare(
        `INSERT INTO payments (id, company_id, partner_id, invoice_id, payment_date, amount, method, memo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(paymentId, companyId, partnerId, null, paymentDate, amount, method || null, memo || null);

      const running = lastBalance(companyId, partnerId) - amount;
      db.prepare(
        `INSERT INTO ledger_entries (id, company_id, partner_id, entry_date, entry_type, supply_amount, vat_amount, paid_amount, running_balance, ref_id, memo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(ledgerId, companyId, partnerId, paymentDate, '입금', 0, 0, amount, running, paymentId, memo || null);

      const updateStatus = db.prepare('UPDATE invoices SET status = ? WHERE id = ?');
      const after = snapshotAllocations(companyId, partnerId);
      for (const a of after) updateStatus.run(a.status, a.invoiceId);

      db.exec('COMMIT');

      const beforeById = new Map(before.map(b => [b.invoiceId, b.allocated]));
      return {
        payment: { id: paymentId, companyId, partnerId, paymentDate, amount, method: method || null, memo: memo || null },
        ledgerEntry: { id: ledgerId, entryDate: paymentDate, paidAmount: amount, runningBalance: running },
        allocations: after.map(a => ({
          invoiceId: a.invoiceId,
          invoiceNo: a.invoiceNo,
          billingMonth: a.billingMonth,
          allocated: a.allocated - (beforeById.get(a.invoiceId) ?? 0),
          remaining: a.remaining,
          status: a.status
        })),
        outstanding: outstanding - amount
      };
    } catch (err) {
      try { db.exec('ROLLBACK'); } catch {}
      throw err;
    }
  }

  function getPartnerLedger({ companyId, partnerId } = {}) {
    if (!companyId) throw new Error('companyId가 필요합니다');
    const p = getPartnerOrThrow(companyId, partnerId);
    const billedTotal = sumBilled(companyId, partnerId);
    const paidTotal = sumPaid(companyId, partnerId);

    const rows = db.prepare(
      `SELECT l.id, l.entry_date, l.entry_type, l.supply_amount, l.vat_amount, l.paid_amount,
              l.running_balance, l.ref_id, l.memo,
              i.invoice_no, i.billing_month, pm.method
       FROM ledger_entries l
       LEFT JOIN invoices i ON i.id = l.ref_id AND l.entry_type = '매출청구'
       LEFT JOIN payments pm ON pm.id = l.ref_id AND l.entry_type = '입금'
       WHERE l.company_id = ? AND l.partner_id = ?
       ORDER BY l.rowid ASC`
    ).all(companyId, partnerId);

    return {
      partner: { id: p.id, partnerCode: p.partner_code, partnerName: p.partner_name, bizNo: p.biz_no },
      summary: { billedTotal, paidTotal, outstanding: billedTotal - paidTotal },
      entries: rows.map(r => ({
        id: r.id,
        entryDate: r.entry_date,
        entryType: r.entry_type,
        supplyAmount: r.supply_amount,
        vatAmount: r.vat_amount,
        paidAmount: r.paid_amount,
        runningBalance: r.running_balance,
        invoiceNo: r.invoice_no,
        billingMonth: r.billing_month,
        method: r.method,
        memo: r.memo
      }))
    };
  }

  return { recordPayment, getPartnerLedger, outstandingOf };
}

module.exports = { createLedgerService };
