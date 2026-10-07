const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createDatabase } = require('../../src/main/db/sqliteEngine');
const { isOnboardingNeeded, completeOnboarding } = require('../../src/main/services/onboardingService');
const { verifyPassword } = require('../../src/shared/security/hasher');
const { createPartnerService } = require('../../src/main/services/partnerService');
const { createInvoiceService } = require('../../src/main/services/invoiceService');
const { createLedgerService } = require('../../src/main/services/ledgerService');
const { createDashboardService } = require('../../src/main/services/dashboardService');

const BILLING_MONTH = '2026-09';

// T4 학원 템플릿: 김민수 330000(수강료300000+교재비30000) / 박서연 250000 / 이준호 320000(수강료300000+기타회비20000)
// 신규 거래처 30000 → 공급가액 합 930000, VAT(절사 10%) 93000, 합계 1023000
const EXPECTED_TOTALS = { supply: 930000, vat: 93000, total: 1023000 };

function invariantBalance(db, companyId, partnerId) {
  const billed = db.prepare('SELECT COALESCE(SUM(total_amount),0) AS s FROM invoices WHERE company_id=? AND partner_id=?').get(companyId, partnerId).s;
  const paid = db.prepare('SELECT COALESCE(SUM(amount),0) AS s FROM payments WHERE company_id=? AND partner_id=?').get(companyId, partnerId).s;
  const last = db.prepare('SELECT running_balance AS r FROM ledger_entries WHERE company_id=? AND partner_id=? ORDER BY rowid DESC LIMIT 1').get(companyId, partnerId);
  assert.equal(last ? last.r : 0, billed - paid, `원장 불변식 위반 partner=${partnerId}`);
  return { billed, paid };
}

test('SME-ERP 전체 비즈니스 흐름 (온보딩→청구→입금→대시보드)', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sme-e2e-'));
  const db = createDatabase(path.join(tmpDir, 'e2e.db'));
  try {
    const partners = createPartnerService(db);
    const invoices = createInvoiceService(db);
    const ledger = createLedgerService(db);
    const dashboard = createDashboardService(db);

    // 1. 클린 DB: 온보딩 필요
    assert.equal(isOnboardingNeeded(db), true);

    // 2. 온보딩(템플릿 적용): 회사+관리자(해시)+품목+거래처 3곳
    const ob = completeOnboarding(db, {
      company: { companyName: '한빛정밀', bizNo: '123-45-67890', ceoName: '홍길동' },
      admin: { username: 'admin', password: 'admin1234!' },
      items: []
    }, { applyTemplate: true });
    assert.equal(ob.onboardingComplete, true);
    assert.equal(ob.templateApplied, true);
    assert.equal(isOnboardingNeeded(db), false);
    const { companyId } = ob;
    const seeded = partners.listPartners(companyId).map(p => p.partnerName).sort();
    assert.deepEqual(seeded, ['김민수', '박서연', '이준호']);

    // 3. 로그인: 해시 정합 (틀린 비번 거부)
    const admin = db.prepare('SELECT * FROM users WHERE company_id=? AND username=?').get(companyId, 'admin');
    assert.equal(admin.role, 'admin');
    assert.equal(verifyPassword('admin1234!', admin.password_hash, admin.salt), true);
    assert.equal(verifyPassword('wrong-pw', admin.password_hash, admin.salt), false);

    // 4. 거래처 추가 등록 → 목록 3+1
    const extra = partners.savePartner(companyId, {
      partnerName: '신규거래처', bizNo: '444-55-66666',
      priceTable: [{ itemName: '절곡가공', unitPrice: 30000 }]
    });
    assert.ok(extra.id);
    assert.equal(partners.listPartners(companyId).length, 4);

    // 5. 월 일괄발행: 4건 채번 연속·원장 1:1 기표·불변식
    const batch = invoices.createInvoiceBatch({ companyId, billingMonth: BILLING_MONTH });
    assert.equal(batch.created.length, 4);
    const seqs = batch.created.map(c => Number(c.invoiceNo.replace('INV-202609-', ''))).sort((a, b) => a - b);
    assert.deepEqual(seqs, [1, 2, 3, 4]);
    assert.equal(batch.summary.supplyTotal, EXPECTED_TOTALS.supply);
    assert.equal(batch.summary.vatTotal, EXPECTED_TOTALS.vat);
    const posted = db.prepare("SELECT COUNT(*) AS c FROM ledger_entries WHERE company_id=? AND entry_type='매출청구'").get(companyId).c;
    assert.equal(posted, 4);
    for (const c of batch.created) {
      const link = db.prepare('SELECT COUNT(*) AS c FROM ledger_entries WHERE ref_id=?').get(c.id).c;
      assert.equal(link, 1, `원장 기표 누락 invoice=${c.invoiceNo}`);
    }
    for (const p of partners.listPartners(companyId)) invariantBalance(db, companyId, p.id);

    // 6. 동일 월 재발행 → skipped (중복 방지)
    const retry = invoices.createInvoiceBatch({ companyId, billingMonth: BILLING_MONTH });
    assert.equal(retry.created.length, 0);
    assert.equal(retry.summary.skippedCount, 4);

    // 7. 부분 입금: 김민수(청구 363000)에 16500 입금 → PARTIAL·잔여 표기·불변식
    const student = partners.listPartners(companyId, '김민수')[0];
    const partial = ledger.recordPayment({
      companyId, partnerId: student.id, paymentDate: '2026-09-20',
      amount: 16500, method: '계좌이체', memo: '1차 입금'
    });
    assert.equal(partial.allocations[0].status, 'PARTIAL');
    assert.equal(partial.allocations[0].remaining, 346500);
    assert.equal(partial.outstanding, 346500);
    const invAfter = db.prepare('SELECT status AS s FROM invoices WHERE partner_id=?').get(student.id).s;
    assert.equal(invAfter, 'PARTIAL');
    invariantBalance(db, companyId, student.id);

    // 8. 완납 입금(잔여액) → PAID·미수 0
    const full = ledger.recordPayment({
      companyId, partnerId: student.id, paymentDate: '2026-09-25',
      amount: 346500, method: '계좌이체', memo: '잔액 입금'
    });
    assert.equal(full.allocations[0].status, 'PAID');
    assert.equal(full.outstanding, 0);
    invariantBalance(db, companyId, student.id);

    // 9. 대시보드: KPI 1원 정확·TOP5 정렬/완납 제외·최근 5건 최신순
    const summary = dashboard.getDashboardSummary({ companyId, baseMonth: BILLING_MONTH });
    assert.equal(summary.kpi.billedAmount, EXPECTED_TOTALS.total);
    assert.equal(summary.kpi.paidAmount, 363000);
    assert.equal(summary.kpi.outstandingAmount, EXPECTED_TOTALS.total - 363000);
    const debts = summary.topDebtors.map(d => d.outstanding);
    assert.deepEqual(debts, [352000, 275000, 33000]);
    assert.ok(!summary.topDebtors.some(d => d.partnerName === '김민수'));
    assert.equal(summary.recentInvoices.length, 4);
    const dates = summary.recentInvoices.map(i => i.issueDate);
    assert.deepEqual([...dates].sort().reverse(), dates);

    // 10. 전 거래처 원장 불변식 최종 대조
    for (const p of partners.listPartners(companyId)) invariantBalance(db, companyId, p.id);
  } finally {
    try { db.close(); } catch {}
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
