const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');

// T06 제품 내장형 바이럴 게이트: 원장 인쇄물 하단 1줄 마이크로 푸터(무료 오픈소스 ERP + releases/latest).
const ROOT = path.join(__dirname, '..', '..', '..');
const LEDGER_JS = path.join(ROOT, 'renderer', 'js', 'views', 'ledger.js');
const RELEASES_URL = 'https://github.com/harry81/clevr/releases/latest';

const BANNED = [
  { name: '미소유 도메인', re: new RegExp(['sme', 'erp'].join('-') + '\\.org') },
  { name: '가짜 버전 태그', re: new RegExp('v' + '1\\.0\\.0') },
];

function loadLedger() {
  const src = fs.readFileSync(LEDGER_JS, 'utf8');
  const sandbox = {
    window: {
      App: {
        views: {},
        esc: (s) => String(s ?? ''),
        won: (n) => '₩' + String(n ?? 0),
        todayStr: () => '2026-01-01',
      },
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: LEDGER_JS });
  return sandbox.window.App.views.ledger;
}

const SAMPLE_VIEW = {
  partner: { partnerName: '대양공업', bizNo: '111-22-33333' },
  summary: { billedTotal: 85000, paidTotal: 0, outstanding: 85000 },
  entries: [
    { entryDate: '2026-09-30', entryType: '청구', supplyAmount: 77273, vatAmount: 7727, paidAmount: 0, runningBalance: 85000, invoiceNo: 'INV-1' },
  ],
};

test('T06 watermark: ledger 뷰의 printDoc이 노출된다', () => {
  const ledger = loadLedger();
  assert.equal(typeof ledger.printDoc, 'function', 'ledger.printDoc 없음 (테스트 가능한 인쇄 빌더 미노출)');
});

test('T06 watermark: 인쇄 HTML 하단에 1줄 마이크로 푸터가 포함된다', () => {
  const ledger = loadLedger();
  const html = ledger.printDoc(SAMPLE_VIEW);
  assert.ok(html.includes('sme-print-footer'), 'sme-print-footer 클래스 없음');
  assert.ok(html.indexOf('본 문서는 10인 이하') > html.indexOf('</table>'), '푸터가 본문(</table>) 뒤 하단에 없음');
  assert.ok(html.includes(RELEASES_URL), 'releases/latest 링크 없음');
  assert.ok(html.includes('SME-ERP'), 'SME-ERP 브랜드 없음');
  assert.ok(html.includes('오픈소스'), '오픈소스 안내 없음');
  assert.ok(html.includes('무료'), '무료 안내 없음');
  assert.ok(html.includes('회원가입'), '회원가입 없음 안내 문구 없음');
});

test('T06 watermark: 외부 라이브러리 0건 (CDN/require 없음)', () => {
  const src = fs.readFileSync(LEDGER_JS, 'utf8');
  assert.ok(!/<script\s+src=/.test(src), '인쇄 HTML에 외부 script src 포함');
  assert.ok(!/\brequire\s*\(/.test(src), 'ledger.js에 require() 사용');
});

test('T06 watermark: ledger.js 금지 문자열 0건 + node --check 통과', () => {
  const src = fs.readFileSync(LEDGER_JS, 'utf8');
  for (const { name, re } of BANNED) {
    assert.equal(re.test(src), false, `${name} 잔존`);
  }
  try {
    execFileSync(process.execPath, ['--check', LEDGER_JS], { stdio: 'pipe' });
  } catch (err) {
    assert.fail(`ledger.js 구문 오류:\n${err.stderr || err.message}`);
  }
});

test('T06 watermark: 인쇄 버튼이 printDoc을 실제 사용한다', () => {
  const src = fs.readFileSync(LEDGER_JS, 'utf8');
  assert.match(src, /printDoc\s*\(/, 'render 내부에서 printDoc 호출 없음');
});
