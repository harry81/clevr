const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createDatabase } = require('../../../src/main/db/sqliteEngine');
const { createPartnerService } = require('../../../src/main/services/partnerService');
const { createInvoiceService } = require('../../../src/main/services/invoiceService');
const { createLedgerService } = require('../../../src/main/services/ledgerService');

function setup() {
  const db = createDatabase(':memory:');
  db.prepare('INSERT INTO companies (id, company_name, biz_no) VALUES (?, ?, ?)').run('c1', '한빛정밀', '123-45-67890');
  const partners = createPartnerService(db);
  const invoices = createInvoiceService(db);
  const ledger = createLedgerService(db);
  return { db, partners, invoices, ledger, companyId: 'c1' };
}

function addPartner(partners, companyId, name, unitPrice) {
  return partners.savePartner(companyId, {
    partnerName: name,
    priceTable: unitPrice ? [{ itemName: '정밀가공', unitPrice }] : []
  });
}

function seedInvoice(db, { companyId, partnerId, invoiceNo, billingMonth, supply, issueDate }) {
  const vat = Math.trunc(supply * 0.1);
  const total = supply + vat;
  const id = `inv-${invoiceNo}`;
  db.prepare(
    `INSERT INTO invoices (id, company_id, partner_id, invoice_no, billing_month, supply_amount, vat_amount, total_amount, issue_date, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, companyId, partnerId, invoiceNo, billingMonth, supply, vat, total, issueDate, 'UNPAID');
  return { id, invoiceNo, supply, vat, total };
}

function tableCount(db, table, companyId) {
  return db.prepare(`SELECT COUNT(*) AS c FROM ${table} WHERE company_id = ?`).get(companyId).c;
}

// ---------- 입력 검증 ----------
test('recordPayment: amount<=0·비정수·날짜형식 오류·미존재 거래처 → 예외', () => {
  const { partners, ledger, companyId } = setup();
  const p = addPartner(partners, companyId, '한빛정밀', 10000);
  const base = { companyId, partnerId: p.id, paymentDate: '2026-09-10', method: '계좌이체' };
  assert.throws(() => ledger.recordPayment({ ...base, amount: 0 }), /금액/i);
  assert.throws(() => ledger.recordPayment({ ...base, amount: -100 }), /금액/i);
  assert.throws(() => ledger.recordPayment({ ...base, amount: 10.5 }), /금액/i);
  assert.throws(() => ledger.recordPayment({ ...base, amount: '1000' }), /금액/i);
  assert.throws(() => ledger.recordPayment({ ...base, amount: 1000, paymentDate: '2026/09/10' }), /일자|날짜/i);
  assert.throws(() => ledger.recordPayment({ ...base, amount: 1000, partnerId: 'no-such' }), /거래처/i);
});

// ---------- 완납 ----------
test('recordPayment: 완납 — payments INSERT + 입금 기표 + PAID', () => {
  const { db, partners, invoices, ledger, companyId } = setup();
  const p = addPartner(partners, companyId, '한빛정밀', 10000);
  invoices.createInvoiceBatch({ companyId, billingMonth: '2026-09', partnerIds: [p.id] });

  const r = ledger.recordPayment({ companyId, partnerId: p.id, paymentDate: '2026-09-10', amount: 11000, method: '계좌이체', memo: '9월분' });
  assert.ok(r.payment.id);
  assert.equal(tableCount(db, 'payments', companyId), 1);
  assert.equal(db.prepare('SELECT amount AS a FROM payments').get().a, 11000);

  const entry = db.prepare(`SELECT * FROM ledger_entries WHERE entry_type = '입금'`).get();
  assert.equal(entry.paid_amount, 11000);
  assert.equal(entry.running_balance, 0);
  assert.equal(entry.ref_id, r.payment.id);

  assert.equal(db.prepare('SELECT status AS s FROM invoices').get().s, 'PAID');
  assert.deepEqual(r.allocations.map(a => ({ allocated: a.allocated, remaining: a.remaining, status: a.status })),
    [{ allocated: 11000, remaining: 0, status: 'PAID' }]);
  assert.equal(r.outstanding, 0);
});

// ---------- 부분입금 (1원 정확성) ----------
test('recordPayment: 부분 충당 — 공급가 4,000,000 청구에 3,000,000 입금 → PARTIAL 잔여 1,400,000', () => {
  const { db, partners, ledger, companyId } = setup();
  const p = addPartner(partners, companyId, '한빛정밀', 10000);
  const inv = seedInvoice(db, { companyId, partnerId: p.id, invoiceNo: 'INV-202609-0001', billingMonth: '2026-09', supply: 4000000, issueDate: '2026-09-30' });
  assert.equal(inv.total, 4400000);

  const r = ledger.recordPayment({ companyId, partnerId: p.id, paymentDate: '2026-09-10', amount: 3000000, method: '계좌이체' });
  assert.equal(db.prepare('SELECT status AS s FROM invoices').get().s, 'PARTIAL');
  assert.deepEqual(r.allocations.map(a => ({ allocated: a.allocated, remaining: a.remaining, status: a.status })),
    [{ allocated: 3000000, remaining: 1400000, status: 'PARTIAL' }]);
  assert.equal(r.outstanding, 1400000);

  const r2 = ledger.recordPayment({ companyId, partnerId: p.id, paymentDate: '2026-09-20', amount: 1400000, method: '어음' });
  assert.equal(db.prepare('SELECT status AS s FROM invoices').get().s, 'PAID');
  assert.equal(r2.outstanding, 0);
});

// ---------- FIFO ----------
test('recordPayment: FIFO — 오래된 청구서(8월)부터 충당', () => {
  const { db, partners, ledger, companyId } = setup();
  const p = addPartner(partners, companyId, '한빛정밀', 10000);
  seedInvoice(db, { companyId, partnerId: p.id, invoiceNo: 'INV-202608-0001', billingMonth: '2026-08', supply: 10000, issueDate: '2026-08-31' });
  seedInvoice(db, { companyId, partnerId: p.id, invoiceNo: 'INV-202609-0001', billingMonth: '2026-09', supply: 20000, issueDate: '2026-09-30' });

  const r = ledger.recordPayment({ companyId, partnerId: p.id, paymentDate: '2026-09-10', amount: 15000, method: '계좌이체' });
  assert.deepEqual(r.allocations.map(a => a.invoiceNo), ['INV-202608-0001', 'INV-202609-0001']);
  assert.deepEqual(r.allocations.map(a => ({ allocated: a.allocated, remaining: a.remaining, status: a.status })), [
    { allocated: 11000, remaining: 0, status: 'PAID' },
    { allocated: 4000, remaining: 18000, status: 'PARTIAL' }
  ]);
  const statuses = db.prepare('SELECT invoice_no AS n, status AS s FROM invoices ORDER BY invoice_no').all()
    .map(r => ({ n: r.n, s: r.s }));
  assert.deepEqual(statuses, [
    { n: 'INV-202608-0001', s: 'PAID' },
    { n: 'INV-202609-0001', s: 'PARTIAL' }
  ]);
  assert.equal(r.outstanding, 18000);
});

// ---------- 초과입금 정책: 에러 ----------
test('recordPayment: 미수 초과 입금 → 에러 (초과분 자동반환 없음)', () => {
  const { db, partners, invoices, ledger, companyId } = setup();
  const p = addPartner(partners, companyId, '한빛정밀', 10000);
  invoices.createInvoiceBatch({ companyId, billingMonth: '2026-09', partnerIds: [p.id] });
  assert.throws(() => ledger.recordPayment({ companyId, partnerId: p.id, paymentDate: '2026-09-10', amount: 12000, method: '계좌이체' }), /초과|미수/);
  assert.equal(tableCount(db, 'payments', companyId), 0);
  assert.equal(tableCount(db, 'ledger_entries', companyId), 1);
  assert.equal(db.prepare('SELECT status AS s FROM invoices').get().s, 'UNPAID');
});

test('recordPayment: 미수 0원 거래처에 입금 → 에러', () => {
  const { partners, ledger, companyId } = setup();
  const p = addPartner(partners, companyId, '한빛정밀', 10000);
  assert.throws(() => ledger.recordPayment({ companyId, partnerId: p.id, paymentDate: '2026-09-10', amount: 5000, method: '계좌이체' }), /초과|미수/);
});

// ---------- 불변식 ----------
test('불변식: running_balance == Σ청구 − Σ입금 (재구성 대조) + 기표 순서별 누적', () => {
  const { db, partners, invoices, ledger, companyId } = setup();
  const p = addPartner(partners, companyId, '한빛정밀', 10000);
  invoices.createInvoiceBatch({ companyId, billingMonth: '2026-08', partnerIds: [p.id] });
  invoices.createInvoiceBatch({ companyId, billingMonth: '2026-09', partnerIds: [p.id] });
  ledger.recordPayment({ companyId, partnerId: p.id, paymentDate: '2026-09-05', amount: 5000, method: '계좌이체' });
  ledger.recordPayment({ companyId, partnerId: p.id, paymentDate: '2026-09-20', amount: 7000, method: '카드' });

  const rows = db.prepare(
    `SELECT entry_type AS t, supply_amount AS s, vat_amount AS v, paid_amount AS p, running_balance AS r
     FROM ledger_entries WHERE company_id = ? AND partner_id = ? ORDER BY rowid ASC`
  ).all(companyId, p.id);
  assert.equal(rows.length, 4);
  let expected = 0;
  for (const row of rows) {
    expected += (row.t === '매출청구') ? (row.s + row.v) : -row.p;
    assert.equal(row.r, expected, `기표 순서 누적 불일치 (${row.t})`);
  }
  const billed = db.prepare('SELECT COALESCE(SUM(total_amount),0) AS s FROM invoices WHERE company_id=? AND partner_id=?').get(companyId, p.id).s;
  const paid = db.prepare('SELECT COALESCE(SUM(amount),0) AS s FROM payments WHERE company_id=? AND partner_id=?').get(companyId, p.id).s;
  assert.equal(rows[rows.length - 1].r, billed - paid);
});

// ---------- 원장 조회 ----------
test('getPartnerLedger: 타임라인 행별 running_balance + 요약(총청구/총입금/미수)', () => {
  const { partners, invoices, ledger, companyId } = setup();
  const p = addPartner(partners, companyId, '한빛정밀', 10000);
  invoices.createInvoiceBatch({ companyId, billingMonth: '2026-09', partnerIds: [p.id] });
  ledger.recordPayment({ companyId, partnerId: p.id, paymentDate: '2026-09-10', amount: 5000, method: '계좌이체', memo: '선입금' });

  const view = ledger.getPartnerLedger({ companyId, partnerId: p.id });
  assert.equal(view.partner.partnerName, '한빛정밀');
  assert.deepEqual(view.summary, { billedTotal: 11000, paidTotal: 5000, outstanding: 6000 });
  assert.equal(view.entries.length, 2);
  assert.equal(view.entries[0].entryType, '매출청구');
  assert.equal(view.entries[0].invoiceNo, 'INV-202609-0001');
  assert.equal(view.entries[0].runningBalance, 11000);
  assert.equal(view.entries[1].entryType, '입금');
  assert.equal(view.entries[1].method, '계좌이체');
  assert.equal(view.entries[1].runningBalance, 6000);
});

test('getPartnerLedger: 미존재 거래처 → 예외', () => {
  const { ledger, companyId } = setup();
  assert.throws(() => ledger.getPartnerLedger({ companyId, partnerId: 'no-such' }), /거래처/i);
});
