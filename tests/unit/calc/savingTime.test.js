const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// T10 청구 완료 도파민 모달 — 절약시간 산정 순수함수 단위 게이트.
// 계수: 5.5분/건(planner 확정), UI 가독성을 위해 5분 단위 반올림.
const INVOICES_JS = path.join(__dirname, '..', '..', '..', 'renderer', 'js', 'views', 'invoices.js');

function loadInvoices() {
  const src = fs.readFileSync(INVOICES_JS, 'utf8');
  const sandbox = {
    window: { App: { views: {}, won: (n) => '₩' + n, esc: (s) => String(s ?? '') } },
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: INVOICES_JS });
  return sandbox.window.App.views.invoices;
}

test('estimateSavingTime: 뷰에 순수함수 노출', () => {
  assert.equal(typeof loadInvoices().estimateSavingTime, 'function');
});

test('estimateSavingTime: 5.5분/건 × 건수, 5분 단위 반올림', () => {
  const s = loadInvoices().estimateSavingTime;
  assert.equal(s(0).minutes, 0);
  assert.equal(s(1).minutes, 5);
  assert.equal(s(2).minutes, 10);
  assert.equal(s(10).minutes, 55);
  assert.equal(s(38).minutes, 210);
});

test('estimateSavingTime: 라벨 포맷(분/시간/시간+분)', () => {
  const s = loadInvoices().estimateSavingTime;
  assert.equal(s(0).label, '0분');
  assert.equal(s(1).label, '5분');
  assert.equal(s(12).label, '1시간 5분');
  assert.equal(s(38).label, '3시간 30분');
});

test('estimateSavingTime: 음수/NaN/문자 방어', () => {
  const s = loadInvoices().estimateSavingTime;
  assert.equal(s(-3).minutes, 0);
  assert.equal(s(NaN).minutes, 0);
  assert.equal(s('abc').minutes, 0);
  assert.equal(s(undefined).minutes, 0);
});

test('savingTime: 5.5 계수 주석 명시', () => {
  const src = fs.readFileSync(INVOICES_JS, 'utf8');
  assert.ok(src.includes('5.5'), '5.5분/건 계수 미기재');
});

test('savingTime: 하드코딩 금지 — summary.totalCount 사용', () => {
  const src = fs.readFileSync(INVOICES_JS, 'utf8');
  assert.ok(src.includes('summary.totalCount'), 'summary.totalCount 미사용(하드코딩 의심)');
});
