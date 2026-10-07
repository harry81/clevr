const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// T11 원장 카톡 전송용 이미지 — 필드 추출/데이터URL allowlist 순수함수 단위 게이트.
const LEDGER_JS = path.join(__dirname, '..', '..', '..', 'renderer', 'js', 'views', 'ledger.js');

function loadLedger() {
  const src = fs.readFileSync(LEDGER_JS, 'utf8');
  const sandbox = {
    window: {
      App: {
        views: {},
        esc: (s) => String(s ?? ''),
        won: (n) => '₩' + String(n ?? 0),
        todayStr: () => '2026-10-07',
      },
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: LEDGER_JS });
  return sandbox.window.App.views.ledger;
}

const VIEW = {
  partner: { partnerName: '대양공업', ceoName: '김대양', bizNo: '111-22-33333' },
  summary: { billedTotal: 85000, paidTotal: 30000, outstanding: 55000 },
  entries: [
    { entryDate: '2026-09-30', runningBalance: 85000 },
    { entryDate: '2026-10-05', runningBalance: 55000 },
  ],
};

test('extractReceiptFields: 뷰에 순수함수 노출', () => {
  assert.equal(typeof loadLedger().extractReceiptFields, 'function');
});

test('extractReceiptFields: 지정 6필드만 추출', () => {
  const fields = loadLedger().extractReceiptFields(VIEW);
  assert.deepEqual(Object.keys(fields).sort(), ['balance', 'ceoName', 'date', 'paidAmount', 'partnerName', 'supplyAmount']);
  assert.deepEqual({ ...fields }, {
    partnerName: '대양공업',
    ceoName: '김대양',
    date: '2026-10-05',
    supplyAmount: 85000,
    paidAmount: 30000,
    balance: 55000,
  });
});

test('extractReceiptFields: entries 없으면 date 빈 문자열', () => {
  const fields = loadLedger().extractReceiptFields({
    partner: { partnerName: 'A' },
    summary: { billedTotal: 0, paidTotal: 0, outstanding: 0 },
    entries: [],
  });
  assert.equal(fields.date, '');
  assert.equal(fields.ceoName, '');
});

test('isAllowedImageDataUrl: PNG base64만 허용', () => {
  const ok = loadLedger().isAllowedImageDataUrl;
  assert.equal(ok('data:image/png;base64,iVBORw0KGgoAAAANSUhEUg=='), true);
  assert.equal(ok('data:image/jpeg;base64,AAAA'), false);
  assert.equal(ok('data:image/svg+xml;base64,PHN2Zz4='), false);
  assert.equal(ok('http://evil.example/x.png'), false);
  assert.equal(ok('data:image/png;base64,<script>'), false);
  assert.equal(ok(''), false);
  assert.equal(ok(null), false);
  assert.equal(ok(undefined), false);
  assert.equal(ok(123), false);
});

test('isAllowedImageDataUrl: 외부 lib/require 없음(무결성)', () => {
  const src = fs.readFileSync(LEDGER_JS, 'utf8');
  assert.ok(!/<script\s+src=/.test(src), '외부 script src 포함');
  assert.ok(!/\brequire\s*\(/.test(src), 'ledger.js에 require() 사용');
});
