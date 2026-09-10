const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

// T11 화면② 거래처 관리 UI 게이트: partners 뷰 존재·sme 채널·핵심 필드·정적 검증.
const ROOT = path.join(__dirname, '..', '..', '..');
const RENDERER_DIR = path.join(ROOT, 'renderer');
const PARTNERS_JS = path.join(RENDERER_DIR, 'js', 'views', 'partners.js');
const INDEX_HTML = path.join(RENDERER_DIR, 'index.html');
const APP_JS = path.join(RENDERER_DIR, 'js', 'app.js');

const BANNED = [
  { name: 'GENSYS 기관코드', re: /GENSYS/ },
  { name: 'demo password literal', re: /['"]1234['"]/ },
  { name: 'demo account', re: /b1acc/i },
  { name: 'demo branch literal', re: /['"]B1['"]/ },
  { name: 'legacy window.api channel', re: /window\.api\.(?!sme\b)/ },
  { name: 'legacy brand', re: /DAWIN/i },
];

test('partners.js 뷰 파일 존재', () => {
  assert.ok(fs.existsSync(PARTNERS_JS), 'renderer/js/views/partners.js 없음');
});

test('partners 뷰 등록 패턴 (window.App.views 파트너)', () => {
  const src = fs.readFileSync(PARTNERS_JS, 'utf8');
  assert.match(src, /window\.App\.views\.partners/, 'window.App.views.partners 등록 없음');
  assert.match(src, /async\s+render\s*\(\s*root/, 'render(root, params) 없음');
  assert.match(src, /title/, 'title 없음');
});

test('sme partners 채널 사용 (list/get/save/delete)', () => {
  const src = fs.readFileSync(PARTNERS_JS, 'utf8');
  assert.match(src, /App\.call\(\s*['"]partners['"]\s*,\s*['"]list['"]/, 'partners/list 호출 없음');
  assert.match(src, /App\.call\(\s*['"]partners['"]\s*,\s*['"]save['"]/, 'partners/save 호출 없음');
  assert.match(src, /App\.call\(\s*['"]partners['"]\s*,\s*['"]delete['"]/, 'partners/delete 호출 없음');
});

test('핵심 필드·요소 포함 (검색/단가표/사업자번호/미수잔액)', () => {
  const src = fs.readFileSync(PARTNERS_JS, 'utf8');
  for (const key of ['partnerName', 'bizNo', 'priceTable', 'itemName', 'unitPrice', 'outstandingBalance', 'partnerCode']) {
    assert.ok(src.includes(key), `key 필드 누락: ${key}`);
  }
  assert.ok(src.includes('250'), '검색 디바운스 250ms 없음');
  assert.ok(src.includes('translateX'), '드로어 translateX 기반 전환 없음');
});

test('index.html에서 partners.js 로드 (boot 전)', () => {
  const html = fs.readFileSync(INDEX_HTML, 'utf8');
  const idxPartners = html.indexOf('views/partners.js');
  const idxBoot = html.indexOf('App.boot');
  assert.ok(idxPartners !== -1, 'index.html에 views/partners.js 스크립트 없음');
  assert.ok(idxBoot !== -1 && idxPartners < idxBoot, 'partners.js는 boot 전에 로드되어야 함');
});

test('app.js 셸 내비게이션에 거래처 탭', () => {
  const src = fs.readFileSync(APP_JS, 'utf8');
  assert.match(src, /nav\(\s*['"]partners['"]\s*,\s*['"]거래처['"]\s*\)/, 'nav(partners, 거래처) 없음');
});

test('partners.js node --check 통과', () => {
  try {
    execFileSync(process.execPath, ['--check', PARTNERS_JS], { stdio: 'pipe' });
  } catch (err) {
    assert.fail(`partners.js 구문 오류:\n${err.stderr || err.message}`);
  }
});

test('partners.js 금지패턴 0건', () => {
  const src = fs.readFileSync(PARTNERS_JS, 'utf8');
  for (const { name, re } of BANNED) {
    const found = src.split('\n').filter((line) => new RegExp(re.source, re.flags).test(line));
    assert.equal(found.length, 0, `${name} 잔존:\n${found.slice(0, 5).join('\n')}`);
  }
});
