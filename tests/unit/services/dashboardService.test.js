const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createDatabase } = require('../../../src/main/db/sqliteEngine');
const { createPartnerService } = require('../../../src/main/services/partnerService');
const { createInvoiceService } = require('../../../src/main/services/invoiceService');
const { createLedgerService } = require('../../../src/main/services/ledgerService');
const { createDashboardService } = require('../../../src/main/services/dashboardService');

function setup() {
  const db = createDatabase(':memory:');
  db.prepare('INSERT INTO companies (id, company_name, biz_no) VALUES (?, ?, ?)').run('c1', '한빛정밀', '123-45-67890');
  const partners = createPartnerService(db);
  const invoices = createInvoiceService(db);
  const ledger = createLedgerService(db);
  const dashboard = createDashboardService(db);
  return { db, partners, invoices, ledger, dashboard, companyId: 'c1' };
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
  db.prepare(
    `INSERT INTO invoices (id, company_id, partner_id, invoice_no, billing_month, supply_amount, vat_amount, total_amount, issue_date, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(`inv-${invoiceNo}`, companyId, partnerId, invoiceNo, billingMonth, supply, vat, total, issueDate, 'UNPAID');
  return total;
}

test('getDashboardSummary: 빈 회사 → 0·null·빈 목록', () => {
  const { dashboard, companyId } = setup();
  const s = dashboard.getDashboardSummary({ companyId, baseMonth: '2026-09' });
  assert.deepEqual(s.kpi, { billedAmount: 0, paidAmount: 0, outstandingAmount: 0, growthRate: null });
  assert.deepEqual(s.recentInvoices, []);
  assert.deepEqual(s.topDebtors, []);
});

test('getDashboardSummary: 당월 청구·입금·누적미수 1원 정확성', () => {
  const { partners, invoices, ledger, dashboard, companyId } = setup();
  const a = addPartner(partners, companyId, '한빛정밀', 10000);
  const b = addPartner(partners, companyId, '한국가공', 20000);
  invoices.createInvoiceBatch({ companyId, billingMonth: '2026-09', partnerIds: [a.id, b.id] });
  ledger.recordPayment({ companyId, partnerId: a.id, paymentDate: '2026-09-15', amount: 5000, method: '계좌이체' });

  const s = dashboard.getDashboardSummary({ companyId, baseMonth: '2026-09' });
  assert.equal(s.kpi.billedAmount, 11000 + 22000);
  assert.equal(s.kpi.paidAmount, 5000);
  assert.equal(s.kpi.outstandingAmount, 33000 - 5000);
});

test('getDashboardSummary: 전월 대비 증감률 + 전월 0원 → null', () => {
  const { db, partners, dashboard, companyId } = setup();
  const a = addPartner(partners, companyId, '한빛정밀', 10000);
  seedInvoice(db, { companyId, partnerId: a.id, invoiceNo: 'INV-202608-0001', billingMonth: '2026-08', supply: 50000, issueDate: '2026-08-31' });
  seedInvoice(db, { companyId, partnerId: a.id, invoiceNo: 'INV-202609-0001', billingMonth: '2026-09', supply: 10000, issueDate: '2026-09-30' });

  const s = dashboard.getDashboardSummary({ companyId, baseMonth: '2026-09' });
  assert.ok(Math.abs(s.kpi.growthRate - (-0.8)) < 1e-12, `growthRate=${s.kpi.growthRate}`);

  const only = dashboard.getDashboardSummary({ companyId, baseMonth: '2026-08' });
  assert.equal(only.kpi.growthRate, null);
});

test('getDashboardSummary: 1월 기준 전월은 전년 12월', () => {
  const { db, partners, dashboard, companyId } = setup();
  const a = addPartner(partners, companyId, '한빛정밀', 10000);
  seedInvoice(db, { companyId, partnerId: a.id, invoiceNo: 'INV-202512-0001', billingMonth: '2025-12', supply: 10000, issueDate: '2025-12-31' });
  seedInvoice(db, { companyId, partnerId: a.id, invoiceNo: 'INV-202601-0001', billingMonth: '2026-01', supply: 20000, issueDate: '2026-01-31' });

  const s = dashboard.getDashboardSummary({ companyId, baseMonth: '2026-01' });
  assert.ok(Math.abs(s.kpi.growthRate - 1.0) < 1e-12, `growthRate=${s.kpi.growthRate}`);
});

test('getDashboardSummary: 최근 청구서 5건 (최신순)', () => {
  const { partners, invoices, dashboard, companyId } = setup();
  const ids = [];
  for (let i = 0; i < 3; i++) ids.push(addPartner(partners, companyId, `거래처${i}`, 10000).id);
  invoices.createInvoiceBatch({ companyId, billingMonth: '2026-08', partnerIds: ids });
  invoices.createInvoiceBatch({ companyId, billingMonth: '2026-09', partnerIds: ids });

  const s = dashboard.getDashboardSummary({ companyId, baseMonth: '2026-09' });
  assert.equal(s.recentInvoices.length, 5);
  assert.equal(s.recentInvoices[0].billingMonth, '2026-09');
  assert.ok(s.recentInvoices[0].partnerName);
  assert.ok(s.recentInvoices[0].invoiceNo);
});

test('getDashboardSummary: 미수잔액 TOP5 내림차순 (완납 제외)', () => {
  const { partners, invoices, ledger, dashboard, companyId } = setup();
  const prices = [10000, 20000, 30000, 40000, 50000, 60000];
  const ids = prices.map((up, i) => addPartner(partners, companyId, `거래처${i}`, up).id);
  invoices.createInvoiceBatch({ companyId, billingMonth: '2026-09', partnerIds: ids });
  ledger.recordPayment({ companyId, partnerId: ids[5], paymentDate: '2026-09-10', amount: 66000, method: '계좌이체' });

  const s = dashboard.getDashboardSummary({ companyId, baseMonth: '2026-09' });
  assert.equal(s.topDebtors.length, 5);
  assert.deepEqual(s.topDebtors.map(d => d.outstanding), [55000, 44000, 33000, 22000, 11000]);
  assert.ok(!s.topDebtors.some(d => d.partnerId === ids[5]), '완납 거래처 제외');
});

test('getDashboardSummary: T5발행→KPI 반영, T6입금→미수 감소 (연동)', () => {
  const { partners, invoices, ledger, dashboard, companyId } = setup();
  const a = addPartner(partners, companyId, '한빛정밀', 30000);
  invoices.createInvoiceBatch({ companyId, billingMonth: '2026-09', partnerIds: [a.id] });
  const before = dashboard.getDashboardSummary({ companyId, baseMonth: '2026-09' });
  assert.equal(before.kpi.billedAmount, 33000);
  assert.equal(before.kpi.outstandingAmount, 33000);

  ledger.recordPayment({ companyId, partnerId: a.id, paymentDate: '2026-09-20', amount: 13000, method: '계좌이체' });
  const after = dashboard.getDashboardSummary({ companyId, baseMonth: '2026-09' });
  assert.equal(after.kpi.billedAmount, 33000);
  assert.equal(after.kpi.paidAmount, 13000);
  assert.equal(after.kpi.outstandingAmount, 20000);
});

test('불변식: outstanding == Σtotal − Σpaid (재구성 대조)', () => {
  const { db, partners, invoices, ledger, dashboard, companyId } = setup();
  const a = addPartner(partners, companyId, '한빛정밀', 10000);
  const b = addPartner(partners, companyId, '한국가공', 20000);
  invoices.createInvoiceBatch({ companyId, billingMonth: '2026-08', partnerIds: [a.id, b.id] });
  invoices.createInvoiceBatch({ companyId, billingMonth: '2026-09', partnerIds: [a.id, b.id] });
  ledger.recordPayment({ companyId, partnerId: a.id, paymentDate: '2026-09-10', amount: 15000, method: '계좌이체' });

  const s = dashboard.getDashboardSummary({ companyId, baseMonth: '2026-09' });
  const billed = db.prepare('SELECT COALESCE(SUM(total_amount),0) AS s FROM invoices WHERE company_id=?').get(companyId).s;
  const paid = db.prepare('SELECT COALESCE(SUM(amount),0) AS s FROM payments WHERE company_id=?').get(companyId).s;
  assert.equal(s.kpi.outstandingAmount, billed - paid);
});

test('getDashboardSummary: 청구년월 형식 검증', () => {
  const { dashboard, companyId } = setup();
  assert.throws(() => dashboard.getDashboardSummary({ companyId, baseMonth: '2026/09' }), /YYYY-MM/i);
});
