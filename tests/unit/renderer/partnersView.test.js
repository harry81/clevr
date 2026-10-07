const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

// T11 화면② 거래처 관리 UI 게이트: partners 뷰 존재·sme 채널·핵심 필드·정적 검증.
const ROOT = path.join(__dirname, '..', '..', '..');
const RENDERER_DIR = path.join(ROOT, 'renderer');
const PARTNERS_JS = path.join(RENDERER_DIR, 'js', 'views', 'partners.js');
const ONBOARDING_JS = path.join(RENDERER_DIR, 'js', 'views', 'onboarding.js');
const APP_CSS = path.join(RENDERER_DIR, 'styles', 'app.css');
const INDEX_HTML = path.join(RENDERER_DIR, 'index.html');
const APP_JS = path.join(RENDERER_DIR, 'js', 'app.js');
const INVOICES_JS = path.join(RENDERER_DIR, 'js', 'views', 'invoices.js');
const DASHBOARD_JS = path.join(RENDERER_DIR, 'js', 'views', 'dashboard.js');
const LEDGER_JS = path.join(RENDERER_DIR, 'js', 'views', 'ledger.js');

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

test('app.js 셸 내비게이션에 회원/거래처 탭 + 청구도우미 로고', () => {
  const src = fs.readFileSync(APP_JS, 'utf8');
  assert.match(src, /nav\(\s*['"]partners['"]\s*,\s*['"]회원\/거래처['"]\s*\)/, 'nav(partners, 회원/거래처) 없음');
  assert.ok(src.includes('청구도우미'), 'app.js 상단 로고 청구도우미 없음');
});

test('T1: 1인 사업자 친화 라벨 3종 노출', () => {
  const pt = fs.readFileSync(PARTNERS_JS, 'utf8');
  assert.ok(pt.includes('이름 / 상호'), '이름 / 상호 라벨 없음');
  assert.ok(pt.includes('연락처 / 식별번호 (선택)'), '연락처 / 식별번호 (선택) 라벨 없음');
  assert.ok(pt.includes('청구 항목 및 금액 (수강료·회비)'), '청구 항목 및 금액 (수강료·회비) 라벨 없음');
});

test('T1: 회원 bizNo 선택 입력 — 마스크/형식 필수 검증 제거', () => {
  const src = fs.readFileSync(PARTNERS_JS, 'utf8');
  assert.ok(!src.includes('maskBizNo'), 'partners.js bizNo 마스크 잔존');
  assert.ok(!src.includes('사업자번호를 입력하세요'), 'partners.js bizNo 필수 검증 잔존');
  assert.ok(!/id="pt-bizno"[^>]*inputmode/.test(src), 'pt-bizno inputmode 숫자 강제 잔존');
});

test('T1: 온보딩 라벨 개편 + 회사 bizNo 마스크 제거', () => {
  const ob = fs.readFileSync(ONBOARDING_JS, 'utf8');
  assert.ok(ob.includes('이름 / 상호'), 'onboarding 이름 / 상호 라벨 없음');
  assert.ok(ob.includes('연락처 / 식별번호 (선택)'), 'onboarding 연락처 / 식별번호 (선택) 라벨 없음');
  assert.ok(ob.includes('청구도우미'), 'onboarding 청구도우미 브랜드 없음');
  assert.ok(!ob.includes('maskBizNo'), 'onboarding bizNo 마스크 잔존');
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

test('단가 천단위 콤마 서식 (partners + onboarding)', () => {
  const pt = fs.readFileSync(PARTNERS_JS, 'utf8');
  assert.ok(pt.includes('toLocaleString'), 'partners.js 단가 콤마 서식(toLocaleString) 없음');
  const ob = fs.readFileSync(ONBOARDING_JS, 'utf8');
  assert.ok(ob.includes('toLocaleString'), 'onboarding.js 단가 콤마 서식(toLocaleString) 없음');
});

test('T5: 퇴원/재원 토글 — setActive 호출 + 라벨·상태 필터', () => {
  const src = fs.readFileSync(PARTNERS_JS, 'utf8');
  assert.match(src, /App\.call\(\s*['"]partners['"]\s*,\s*['"]setActive['"]/, 'partners/setActive 호출 없음');
  assert.ok(src.includes('퇴원 처리'), '퇴원 처리 라벨 없음');
  assert.ok(src.includes('재원으로 복귀'), '재원으로 복귀 라벨 없음');
  assert.ok(src.includes('퇴원생 보기'), '퇴원생 보기 필터 없음');
  assert.match(src, /status:\s*showInactive/, 'status 필터 전달 없음');
});

test('T5: 삭제 실패 대안(퇴원 처리로 변경) + FK 치환·role=alert', () => {
  const src = fs.readFileSync(PARTNERS_JS, 'utf8');
  assert.ok(src.includes('퇴원 처리로 변경'), '삭제 실패 대안 버튼 없음');
  assert.match(src, /FOREIGN KEY\|constraint/i, 'FK raw 치환 방어 없음');
  assert.ok(src.includes('role="alert"'), 'role=alert 에러 영역 없음');
});

test('품목단가표 행 레이아웃 명시적 클래스 (가상 선택자 제거)', () => {
  const css = fs.readFileSync(APP_CSS, 'utf8');
  assert.ok(!css.includes('.sme-itemrow input:first-child'), '.sme-itemrow input:first-child 잔존');
  assert.ok(!css.includes('.sme-itemrow input:last-child'), '.sme-itemrow input:last-child 잔존');
  for (const cls of ['.pt-item-name', '.pt-item-price', '.pt-item-del', '.ob-item-name', '.ob-item-price']) {
    assert.ok(css.includes(cls), `app.css 명시적 클래스 누락: ${cls}`);
  }
});

// ---------- 2차: T1 브랜딩 / T3 명세서 용어 / T4 템플릿 / T5 면세 ----------
test('T1: 로그인 슬로건 청구도우미', () => {
  const login = fs.readFileSync(path.join(RENDERER_DIR, 'js', 'views', 'login.js'), 'utf8');
  assert.ok(login.includes('청구도우미'), 'login.js 브랜드 청구도우미 없음');
  assert.ok(login.includes('월 정기 청구·미납 관리 청구도우미'), 'login.js 슬로건 없음');
});

test('T3: 장부 용어(노출부) — nav/대시보드/명세서', () => {
  const app = fs.readFileSync(APP_JS, 'utf8');
  assert.match(app, /nav\(\s*['"]ledger['"]\s*,\s*['"]입금\/명세서['"]\s*\)/, 'nav(ledger, 입금/명세서) 없음');
  const dash = fs.readFileSync(DASHBOARD_JS, 'utf8');
  assert.ok(dash.includes('납부 명세서 바로가기'), '대시보드 납부 명세서 바로가기 없음');
  assert.ok(!dash.includes('원장 바로가기'), '원장 바로가기 잔존');
  const led = fs.readFileSync(LEDGER_JS, 'utf8');
  assert.ok(led.includes('납부 명세서 / 영수증'), '명세서 제목 없음');
  assert.ok(led.includes('남은 미납액'), '남은 미납액 라벨 없음');
  assert.ok(led.includes('명세서 인쇄(A4)'), '명세서 인쇄 버튼 없음');
  assert.ok(led.includes('납부명세서_'), '파일명 템플릿 없음');
  assert.ok(!led.includes('차인지급잔액'), '차인지급잔액 잔존');
});

test('T4: 온보딩 표준 템플릿 라벨 학원화', () => {
  const ob = fs.readFileSync(ONBOARDING_JS, 'utf8');
  assert.ok(ob.includes('학원'), '온보딩 학원화 라벨 없음');
  assert.ok(ob.includes('표준 청구 항목 템플릿'), '텍스트 템플릿 라벨 없음');
});

test('T5: 청구 모달 면세 토글 + isTaxExempt 전달', () => {
  const inv = fs.readFileSync(INVOICES_JS, 'utf8');
  assert.ok(inv.includes('면세'), '면세 체크박스 라벨 없음');
  assert.match(inv, /isTaxExempt/, 'isTaxExempt 전달 없음');
  assert.match(inv, /type="checkbox"[^>]*id="pv-exempt"/, 'pv-exempt 체크박스 없음');
});
