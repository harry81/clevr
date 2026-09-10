const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

// R1 공개 게이트: renderer/ 내 레거시 잔존 0건 + sme.* 사용 확인.
// 스캔 대상: renderer/ 전체 (html/js/css). 구 DAWIN 단일 index.html을
// SME-ERP SPA로 대체하면 금지 패턴이 자연 소거되어야 한다.
const RENDERER_DIR = path.join(__dirname, '..', '..', '..', 'renderer');

const BANNED = [
  { name: 'GENSYS 기관코드', re: /GENSYS/ },
  { name: '1234 데모 비밀번호 리터럴', re: /['"]1234['"]/ },
  { name: 'b1acc 데모 계정', re: /b1acc/i },
  { name: 'B1 데모 지점코드 리터럴', re: /['"]B1['"]/ },
  { name: '구 window.api.* 채널 (sme 제외)', re: /window\.api\.(?!sme\b)/ },
  { name: 'DAWIN 레거시', re: /DAWIN/i }
];

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

function hits(pattern) {
  const found = [];
  for (const file of walk(RENDERER_DIR)) {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (pattern.test(line)) {
        found.push(`${path.relative(RENDERER_DIR, file)}:${i + 1}`);
        pattern.lastIndex = 0;
      }
    });
    pattern.lastIndex = 0;
  }
  return found;
}

for (const { name, re } of BANNED) {
  test(`R1 잔존 제거: ${name} 0건`, () => {
    const found = hits(new RegExp(re.source, re.flags));
    assert.equal(found.length, 0, `${name} 잔존:\n${found.slice(0, 20).join('\n')}`);
  });
}

test('R1 전환 확인: window.api.sme.* 사용 존재', () => {
  let count = 0;
  for (const file of walk(RENDERER_DIR)) {
    if (!file.endsWith('.js')) continue;
    const src = fs.readFileSync(file, 'utf8');
    count += (src.match(/window\.api\.sme\./g) || []).length;
  }
  assert.ok(count > 0, 'renderer/js에서 window.api.sme.* 호출이 없음');
});

test('renderer/js 전 파일 node --check 통과', () => {
  for (const file of walk(RENDERER_DIR)) {
    if (!file.endsWith('.js')) continue;
    try {
      execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
    } catch (err) {
      assert.fail(`${path.relative(RENDERER_DIR, file)} 구문 오류:\n${err.stderr || err.message}`);
    }
  }
});
