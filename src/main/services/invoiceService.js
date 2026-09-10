const crypto = require('node:crypto');
const { computeVat, computeTotal } = require('../../shared/money');

function createInvoiceService(db) {
  function nextInvoiceNo(companyId, billingMonth) {
    const yyyymm = billingMonth.replace('-', '');
    const prefix = `INV-${yyyymm}-`;
    const rows = db.prepare('SELECT invoice_no FROM invoices WHERE company_id = ? AND billing_month = ?').all(companyId, billingMonth);
    let max = 0;
    for (const r of rows) {
      if (typeof r.invoice_no === 'string' && r.invoice_no.startsWith(prefix)) {
        const n = Number(r.invoice_no.slice(prefix.length));
        if (Number.isInteger(n) && n > max) max = n;
      }
    }
    return { prefix, nextSeq: max + 1 };
  }

  // running_balance 체인은 기표순(rowid) 기준 — created_at은 초 단위라
  // 같은 초 다수 기표가 동점이 되어 UUID 임의 순서로 잘못된 행을 고름 (P1 회귀)
  function lastBalance(companyId, partnerId) {
    const row = db.prepare(
      'SELECT running_balance FROM ledger_entries WHERE company_id = ? AND partner_id = ? ORDER BY rowid DESC LIMIT 1'
    ).get(companyId, partnerId);
    return row ? row.running_balance : 0;
  }

  function issueDateOf(billingMonth) {
    return db.prepare("SELECT date(?, 'start of month', '+1 month', '-1 day') AS d").get(`${billingMonth}-01`).d;
  }

  function createInvoiceBatch({ companyId, billingMonth, partnerIds } = {}) {
    if (!companyId) throw new Error('companyId가 필요합니다');
    if (!/^\d{4}-\d{2}$/.test(billingMonth || '')) {
      throw new Error('청구년월은 YYYY-MM 형식이어야 합니다');
    }

    let targets;
    if (Array.isArray(partnerIds) && partnerIds.length > 0) {
      targets = partnerIds.map(id =>
        db.prepare('SELECT * FROM partners WHERE company_id = ? AND id = ?').get(companyId, id)
      );
    } else {
      targets = db.prepare('SELECT * FROM partners WHERE company_id = ?').all(companyId);
    }

    const created = [];
    const skipped = [];
    const issueDate = issueDateOf(billingMonth);

    db.exec('BEGIN IMMEDIATE');
    try {
      const { prefix, nextSeq } = nextInvoiceNo(companyId, billingMonth);
      let seq = nextSeq;
      const issued = new Set(
        db.prepare('SELECT partner_id FROM invoices WHERE company_id = ? AND billing_month = ?')
          .all(companyId, billingMonth).map(r => r.partner_id)
      );

      const insertInvoice = db.prepare(
        `INSERT INTO invoices (id, company_id, partner_id, invoice_no, billing_month, supply_amount, vat_amount, total_amount, issue_date, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      const insertLedger = db.prepare(
        `INSERT INTO ledger_entries (id, company_id, partner_id, entry_date, entry_type, supply_amount, vat_amount, paid_amount, running_balance, ref_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );

      for (const p of targets) {
        if (!p) throw new Error('존재하지 않는 거래처가 포함되어 있습니다');
        if (issued.has(p.id)) { skipped.push(p.id); continue; }
        const priceTable = p.default_price_json ? JSON.parse(p.default_price_json) : [];
        const supply = (Array.isArray(priceTable) ? priceTable : [])
          .reduce((acc, it) => acc + (Number(it.unitPrice) || 0), 0);
        if (!(supply > 0)) { skipped.push(p.id); continue; }

        const vat = computeVat(supply);
        const total = supply + vat;
        const invoiceNo = `${prefix}${String(seq).padStart(4, '0')}`;
        const invoiceId = crypto.randomUUID();
        const running = lastBalance(companyId, p.id) + total;

        insertInvoice.run(invoiceId, companyId, p.id, invoiceNo, billingMonth, supply, vat, total, issueDate, 'UNPAID');
        insertLedger.run(crypto.randomUUID(), companyId, p.id, issueDate, '매출청구', supply, vat, 0, running, invoiceId);

        created.push({
          id: invoiceId,
          invoiceNo,
          companyId,
          partnerId: p.id,
          partnerName: p.partner_name,
          billingMonth,
          supplyAmount: supply,
          vatAmount: vat,
          totalAmount: total,
          issueDate,
          status: 'UNPAID'
        });
        seq += 1;
      }
      db.exec('COMMIT');
    } catch (err) {
      try { db.exec('ROLLBACK'); } catch {}
      throw err;
    }

    return {
      created,
      summary: {
        totalCount: created.length,
        supplyTotal: created.reduce((s, i) => s + i.supplyAmount, 0),
        vatTotal: created.reduce((s, i) => s + i.vatAmount, 0),
        skippedCount: skipped.length,
        skippedPartnerIds: skipped
      }
    };
  }

  return { createInvoiceBatch };
}

module.exports = { createInvoiceService };