const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createDatabase } = require('../../src/main/db/sqliteEngine');
const { completeOnboarding } = require('../../src/main/services/onboardingService');
const { createPartnerService } = require('../../src/main/services/partnerService');
const { createInvoiceService } = require('../../src/main/services/invoiceService');
const { createLedgerService } = require('../../src/main/services/ledgerService');

const LEDGER_JS = path.join(__dirname, '..', '..', 'renderer', 'js', 'views', 'ledger.js');

function loadLedger() {
  const src = fs.readFileSync(LEDGER_JS, 'utf8');
  const sandbox = {
    window: {
      App: {
        views: {},
        esc: (s) => String(s ?? ''),
        won: (n) => '₩' + String(n ?? 0),
        todayStr: () => '2026-09-30',
      },
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: LEDGER_JS });
  return sandbox.window.App.views.ledger;
}

// 1인 학원 페르소나 E2E: 빈 bizNo 학원생 등록 → 수강료 템플릿 → 면세 청구 → 부분 입금 → 불변식 → 명세서 푸터
test('학원 페르소나 E2E: 면세 청구·부분 입금·명세서 푸터', () => {
  const db = createDatabase(':memory:');
  try {
    const partners = createPartnerService(db);
    const invoices = createInvoiceService(db);
    const ledger = createLedgerService(db);

    // 1) 빈 bizNo 학원 온보딩 + 학원 청구항목 템플릿
    const ob = completeOnboarding(db, {
      company: { companyName: '하늘학원', bizNo: '', ceoName: '원장' },
      admin: { username: 'admin', password: 'admin1234!' },
      items: []
    }, { applyTemplate: true });
    const { companyId } = ob;
    assert.equal(ob.templateApplied, true);
    const itemNames = db.prepare('SELECT item_name AS n FROM items WHERE company_id = ?').all(companyId).map(r => r.n);
    assert.ok(itemNames.includes('수강료'), '수강료 템플릿 누락');
    assert.equal(db.prepare('SELECT biz_no FROM companies WHERE id = ?').get(companyId).biz_no, '', '회사 빈 bizNo 미저장');

    // 2) 빈 bizNo 학원생 회원 등록 (bizNo 선택화)
    const student = partners.savePartner(companyId, {
      partnerName: '학생A', bizNo: '',
      priceTable: [{ itemName: '수강료', unitPrice: 300000 }]
    });
    assert.ok(student.id);
    assert.ok(!student.bizNo, '빈 bizNo가 저장되어서는 안 됨');

    // 3) 면세 월 일괄 청구 (isTaxExempt → vat 0, 총액=공급가액)
    const batch = invoices.createInvoiceBatch({
      companyId, billingMonth: '2026-09', partnerIds: [student.id], isTaxExempt: true
    });
    assert.equal(batch.summary.totalCount, 1);
    assert.equal(batch.summary.vatTotal, 0);
    assert.equal(batch.created[0].vatAmount, 0);
    assert.equal(batch.created[0].totalAmount, 300000);
    const inv = db.prepare('SELECT vat_amount AS v, total_amount AS t FROM invoices WHERE partner_id = ?').get(student.id);
    assert.equal(inv.v, 0);
    assert.equal(inv.t, 300000);
    const le = db.prepare("SELECT * FROM ledger_entries WHERE partner_id = ? AND entry_type = '매출청구'").get(student.id);
    assert.equal(le.vat_amount, 0);
    assert.equal(le.running_balance, 300000);

    // 4) 부분 입금 → 남은 미납액
    const pay = ledger.recordPayment({
      companyId, partnerId: student.id, paymentDate: '2026-09-20', amount: 120000, memo: '1차'
    });
    assert.equal(pay.outstanding, 180000);

    // 5) 원장 불변식: 마지막 running_balance == Σ청구 - Σ입금
    const billed = db.prepare('SELECT COALESCE(SUM(total_amount),0) AS s FROM invoices WHERE partner_id = ?').get(student.id).s;
    const paid = db.prepare('SELECT COALESCE(SUM(amount),0) AS s FROM payments WHERE partner_id = ?').get(student.id).s;
    const last = db.prepare('SELECT running_balance AS r FROM ledger_entries WHERE partner_id = ? ORDER BY rowid DESC LIMIT 1').get(student.id).r;
    assert.equal(last, billed - paid);
    assert.equal(last, 180000);

    // 6) 명세서 푸터 문자열 (청구도우미 + 무료 + releases URL)
    const ledgerView = loadLedger();
    const view = ledger.getPartnerLedger({ companyId, partnerId: student.id });
    const html = ledgerView.printDoc(view);
    assert.ok(html.includes('청구도우미'), '명세서 푸터 청구도우미 없음');
    assert.ok(html.includes('1인 사업자를 위한 100% 무료'), '명세서 푸터 무료 문구 없음');
    assert.ok(html.includes('https://github.com/harry81/clevr/releases/latest'), 'releases URL 없음');
    assert.ok(html.includes('납부 명세서 / 영수증'), '명세서 제목 없음');
  } finally {
    db.close();
  }
});
