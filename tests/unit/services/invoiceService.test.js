const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createDatabase } = require('../../../src/main/db/sqliteEngine');
const { createPartnerService } = require('../../../src/main/services/partnerService');
const { createInvoiceService } = require('../../../src/main/services/invoiceService');
const { computeVat, computeTotal } = require('../../../src/shared/money');

function setup() {
  const db = createDatabase(':memory:');
  db.prepare('INSERT INTO companies (id, company_name, biz_no) VALUES (?, ?, ?)').run('c1', '한빛정밀', '123-45-67890');
  const partners = createPartnerService(db);
  const invoices = createInvoiceService(db);
  return { db, partners, invoices, companyId: 'c1' };
}

function addPartner(partners, companyId, name, unitPrice) {
  return partners.savePartner(companyId, {
    partnerName: name,
    priceTable: unitPrice ? [{ itemName: '정밀가공', unitPrice }] : []
  });
}

// ---------- money.js (VAT 절사 단일 소스) ----------
test('money.computeVat: Math.trunc(supply*0.1) 원 단위 절사', () => {
  assert.equal(computeVat(10000), 1000);
  assert.equal(computeVat(12345), 1234);
  assert.equal(computeVat(999), 99);
  assert.equal(computeVat(0), 0);
  assert.equal(computeTotal(12345), 13579);
  assert.equal(computeTotal(10000), 11000);
});

test('money.computeVat: 0 미만/비정수/비숫자 → 예외', () => {
  assert.throws(() => computeVat(-1), /정수/i);
  assert.throws(() => computeVat(10.5), /정수/i);
  assert.throws(() => computeVat('100'), /정수/i);
  assert.throws(() => computeVat(null), /정수/i);
});

// ---------- T5 일괄 발행 엔진 ----------
test('createInvoiceBatch: 단가표 기반 일괄 발행 + 채번 INV-YYYYMM-0001', () => {
  const { partners, invoices, companyId } = setup();
  addPartner(partners, companyId, '한빛정밀', 12500);
  addPartner(partners, companyId, '한국가공', 25000);
  const result = invoices.createInvoiceBatch({ companyId, billingMonth: '2026-09' });
  assert.equal(result.summary.totalCount, 2);
  assert.equal(result.summary.supplyTotal, 37500);
  assert.equal(result.summary.vatTotal, Math.trunc(12500 * 0.1) + Math.trunc(25000 * 0.1));
  assert.deepEqual(result.created.map(i => i.invoiceNo), ['INV-202609-0001', 'INV-202609-0002']);
  assert.equal(result.created[0].supplyAmount, 12500);
  assert.equal(result.created[0].vatAmount, 1250);
  assert.equal(result.created[0].totalAmount, 13750);
  assert.equal(result.created[0].status, 'UNPAID');
});

test('createInvoiceBatch: 각 청구서를 ledger_entries에 매출청구 기표 1:1, running_balance=Σ청구', () => {
  const { db, partners, invoices, companyId } = setup();
  const a = addPartner(partners, companyId, '한빛정밀', 10000);
  addPartner(partners, companyId, '한국가공', 20000);
  invoices.createInvoiceBatch({ companyId, billingMonth: '2026-09' });
  const ledgers = db.prepare('SELECT * FROM ledger_entries WHERE company_id = ? AND entry_type = ?').all(companyId, '매출청구');
  assert.equal(ledgers.length, 2);
  const ledgerA = ledgers.find(l => l.partner_id === a.id);
  assert.equal(ledgerA.supply_amount, 10000);
  assert.equal(ledgerA.vat_amount, 1000);
  assert.equal(ledgerA.paid_amount, 0);
  assert.equal(ledgerA.running_balance, 11000);
  const recon = db.prepare(
    'SELECT (SELECT COALESCE(SUM(total_amount),0) FROM invoices WHERE company_id=? AND partner_id=?) AS billed'
  ).get(companyId, a.id).billed;
  assert.equal(ledgerA.running_balance, recon);
});

test('createInvoiceBatch: 채번 연속성 — 두 번째 배치는 이어서 채번', () => {
  const { partners, invoices, companyId } = setup();
  addPartner(partners, companyId, '한빛정밀', 10000);
  const r1 = invoices.createInvoiceBatch({ companyId, billingMonth: '2026-09' });
  assert.equal(r1.created[0].invoiceNo, 'INV-202609-0001');
  addPartner(partners, companyId, '한국가공', 20000);
  const r2 = invoices.createInvoiceBatch({ companyId, billingMonth: '2026-09' });
  const created = r2.created.filter(i => i.partnerName === '한국가공');
  assert.equal(created.length, 1);
  assert.equal(created[0].invoiceNo, 'INV-202609-0002');
});

test('createInvoiceBatch: 동일 거래처·동일 청구년월 중복 발행 방지', () => {
  const { partners, invoices, companyId } = setup();
  addPartner(partners, companyId, '한빛정밀', 10000);
  const r1 = invoices.createInvoiceBatch({ companyId, billingMonth: '2026-09' });
  assert.equal(r1.summary.totalCount, 1);
  const r2 = invoices.createInvoiceBatch({ companyId, billingMonth: '2026-09' });
  assert.equal(r2.summary.totalCount, 0);
  assert.deepEqual(r2.summary.skippedPartnerIds, [r1.created[0].partnerId]);
});

test('createInvoiceBatch: 단가표 없는 거래처는 대상에서 제외', () => {
  const { partners, invoices, companyId } = setup();
  const empty = addPartner(partners, companyId, '단가표없음', null);
  addPartner(partners, companyId, '한빛정밀', 10000);
  const result = invoices.createInvoiceBatch({ companyId, billingMonth: '2026-09' });
  assert.equal(result.summary.totalCount, 1);
  assert.ok(result.summary.skippedPartnerIds.includes(empty.id));
});

test('createInvoiceBatch: partnerIds 지정 시 해당 거래처만 발행', () => {
  const { partners, invoices, companyId } = setup();
  const a = addPartner(partners, companyId, '한빛정밀', 10000);
  addPartner(partners, companyId, '한국가공', 20000);
  const result = invoices.createInvoiceBatch({ companyId, billingMonth: '2026-09', partnerIds: [a.id] });
  assert.equal(result.summary.totalCount, 1);
  assert.equal(result.created[0].partnerId, a.id);
});

test('createInvoiceBatch: 트랜잭션 원자성 — 일부 성공 후 무효 파트너에서 실패 시 전체 롤백', () => {
  const { db, partners, invoices, companyId } = setup();
  const a = addPartner(partners, companyId, '한빛정밀', 10000);
  assert.throws(() => invoices.createInvoiceBatch({
    companyId, billingMonth: '2026-09', partnerIds: [a.id, 'no-such-partner']
  }), /존재하지 않는 거래처/);
  assert.equal(db.prepare('SELECT COUNT(*) AS c FROM invoices WHERE company_id = ?').get(companyId).c, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS c FROM ledger_entries WHERE company_id = ?').get(companyId).c, 0);
});

test('createInvoiceBatch: 청구년월 형식 검증', () => {
  const { invoices, companyId } = setup();
  assert.throws(() => invoices.createInvoiceBatch({ companyId, billingMonth: '2026/09' }), /YYYY-MM/i);
  assert.throws(() => invoices.createInvoiceBatch({ companyId, billingMonth: '' }), /YYYY-MM/i);
});

test('createInvoiceBatch: 벤치 — 50건 배치 0.1초 미만 (A2 렉 게이트)', () => {
  const { partners, invoices, companyId } = setup();
  const partnerIds = [];
  for (let i = 0; i < 50; i++) {
    partnerIds.push(addPartner(partners, companyId, `거래처${String(i).padStart(2, '0')}`, 10000 + i).id);
  }
  const start = process.hrtime.bigint();
  const result = invoices.createInvoiceBatch({ companyId, billingMonth: '2026-10', partnerIds });
  const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
  assert.equal(result.summary.totalCount, 50);
  assert.ok(elapsedMs < 100, `배치 소요 ${elapsedMs.toFixed(1)}ms — 100ms 초과`);
});