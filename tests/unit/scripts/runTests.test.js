const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { findTestFiles } = require('../../../scripts/run-tests.js');

// scripts/run-tests.js 탐색 로직 게이트: 재귀·정렬·확장자 필터 (셸 glob 비의존).
function makeFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sme-runtests-'));
  const mk = (rel, content = '') => {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
    return full;
  };
  return { root, mk };
}

test('findTestFiles: 하위 디렉토리까지 재귀 수집', () => {
  const { root, mk } = makeFixture();
  const top = mk('a.test.js');
  const nested = mk('services/b.test.js');
  mk('services/helpers.js');
  mk('services/readme.md');
  assert.deepEqual(findTestFiles(root), [top, nested].sort());
});

test('findTestFiles: 결과가 정렬된다', () => {
  const { root, mk } = makeFixture();
  mk('z.test.js');
  mk('a.test.js');
  mk('m/mid.test.js');
  const found = findTestFiles(root);
  assert.deepEqual(found, found.slice().sort());
  assert.ok(found.length === 3);
});

test('findTestFiles: *.test.js만 포함(다른 확장자 제외)', () => {
  const { root, mk } = makeFixture();
  const keep = mk('keep.test.js');
  mk('skip.test.jsx');
  mk('skip.spec.js');
  mk('skip.test.ts');
  assert.deepEqual(findTestFiles(root), [keep]);
});

test('findTestFiles: 존재하지 않는 디렉토리 → 빈 배열', () => {
  assert.deepEqual(findTestFiles(path.join(os.tmpdir(), 'sme-runtests-does-not-exist-xyz')), []);
});

test('findTestFiles: 빈 디렉토리 → 빈 배열', () => {
  const { root } = makeFixture();
  assert.deepEqual(findTestFiles(root), []);
});
