const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  parseVersion,
  formatTag,
  stripTagPrefix,
  bumpVersion,
  resolveTargetVersion,
  isValidVersion,
  compareVersions,
  isFirstRelease,
} = require('../../../scripts/release.js');

test('parseVersion: 정상 파싱 (v prefix/공백 허용)', () => {
  assert.deepEqual(parseVersion('0.1.0'), { major: 0, minor: 1, patch: 0 });
  assert.deepEqual(parseVersion('v0.1.0'), { major: 0, minor: 1, patch: 0 });
  assert.deepEqual(parseVersion('  1.2.3  '), { major: 1, minor: 2, patch: 3 });
  assert.deepEqual(parseVersion('v10.20.30'), { major: 10, minor: 20, patch: 30 });
});

test('parseVersion: 선행 0 허용', () => {
  assert.deepEqual(parseVersion('01.02.03'), { major: 1, minor: 2, patch: 3 });
});

test('parseVersion: 무효 입력 throw', () => {
  assert.throws(() => parseVersion(''), /Invalid version/);
  assert.throws(() => parseVersion('1.2'), /Invalid version/);
  assert.throws(() => parseVersion('1.2.3.4'), /Invalid version/);
  assert.throws(() => parseVersion('1.2.3-beta'), /Invalid version/);
  assert.throws(() => parseVersion('1.2.3+build'), /Invalid version/);
  assert.throws(() => parseVersion('v1.2'), /Invalid version/);
  assert.throws(() => parseVersion(null), /Invalid version/);
  assert.throws(() => parseVersion(undefined), /Invalid version/);
  assert.throws(() => parseVersion(123), /Invalid version/);
});

test('formatTag: vX.Y.Z 포맷', () => {
  assert.equal(formatTag({ major: 0, minor: 1, patch: 0 }), 'v0.1.0');
  assert.equal(formatTag('1.2.3'), 'v1.2.3');
});

test('stripTagPrefix: v prefix 제거 + round-trip', () => {
  assert.equal(stripTagPrefix('v0.1.0'), '0.1.0');
  assert.equal(stripTagPrefix('0.1.0'), '0.1.0');
  assert.equal(stripTagPrefix('  v1.2.3  '), '1.2.3');
  assert.throws(() => stripTagPrefix('1.2'), /Invalid version/);
});

test('parseVersion/formatTag/stripTagPrefix round-trip', () => {
  const v = parseVersion('v2.3.4');
  assert.equal(formatTag(v), 'v2.3.4');
  assert.equal(stripTagPrefix(formatTag(v)), '2.3.4');
  assert.deepEqual(parseVersion(stripTagPrefix(formatTag(v))), v);
});

test('bumpVersion: patch/minor/major 리셋 규칙', () => {
  assert.deepEqual(bumpVersion({ major: 0, minor: 1, patch: 2 }, 'patch'), { major: 0, minor: 1, patch: 3 });
  assert.deepEqual(bumpVersion({ major: 0, minor: 1, patch: 2 }, 'minor'), { major: 0, minor: 2, patch: 0 });
  assert.deepEqual(bumpVersion({ major: 0, minor: 1, patch: 2 }, 'major'), { major: 1, minor: 0, patch: 0 });
});

test('bumpVersion: 문자열 입력 + 입력 불변 + 무효 kind throw', () => {
  assert.deepEqual(bumpVersion('0.1.2', 'patch'), { major: 0, minor: 1, patch: 3 });
  const src = { major: 1, minor: 2, patch: 3 };
  const out = bumpVersion(src, 'minor');
  assert.deepEqual(src, { major: 1, minor: 2, patch: 3 });
  assert.deepEqual(out, { major: 1, minor: 3, patch: 0 });
  assert.throws(() => bumpVersion('0.1.0', 'premajor'), /Invalid bump kind/);
});

test('resolveTargetVersion: 직접 지정 (X.Y.Z)', () => {
  assert.deepEqual(
    resolveTargetVersion({ current: '0.1.0', latestTag: 'v0.1.0', arg: '0.2.0' }),
    { major: 0, minor: 2, patch: 0 },
  );
  assert.deepEqual(
    resolveTargetVersion({ current: '0.1.0', latestTag: null, arg: 'v1.0.0' }),
    { major: 1, minor: 0, patch: 0 },
  );
});

test('resolveTargetVersion: kind bump (current 기준)', () => {
  assert.deepEqual(
    resolveTargetVersion({ current: '0.1.0', latestTag: 'v0.1.0', arg: 'patch' }),
    { major: 0, minor: 1, patch: 1 },
  );
  assert.deepEqual(
    resolveTargetVersion({ current: '0.1.0', latestTag: 'v0.1.0', arg: 'minor' }),
    { major: 0, minor: 2, patch: 0 },
  );
  assert.deepEqual(
    resolveTargetVersion({ current: '0.1.0', latestTag: 'v0.1.0', arg: 'major' }),
    { major: 1, minor: 0, patch: 0 },
  );
});

test('resolveTargetVersion: 무효 arg throw', () => {
  assert.throws(() => resolveTargetVersion({ current: '0.1.0', latestTag: null, arg: 'foo' }), /Invalid arg/);
});

test('resolveTargetVersion: 첫 릴리즈 분기 3종 (arg 없음)', () => {
  // tag null → current 그대로
  assert.deepEqual(
    resolveTargetVersion({ current: '0.1.0', latestTag: null }),
    { major: 0, minor: 1, patch: 0 },
  );
  // latestTag == current → patch bump
  assert.deepEqual(
    resolveTargetVersion({ current: '0.1.0', latestTag: 'v0.1.0' }),
    { major: 0, minor: 1, patch: 1 },
  );
  // latestTag < current → current 그대로
  assert.deepEqual(
    resolveTargetVersion({ current: '0.2.0', latestTag: 'v0.1.0' }),
    { major: 0, minor: 2, patch: 0 },
  );
});

test('isFirstRelease: 태그 없을 때만 true', () => {
  assert.equal(isFirstRelease('0.1.0', null), true);
  assert.equal(isFirstRelease('0.1.0', undefined), true);
  assert.equal(isFirstRelease('0.1.0', 'v0.1.0'), false);
});

test('compareVersions: 대소 비교', () => {
  assert.equal(compareVersions('0.1.0', 'v0.1.0'), 0);
  assert.equal(compareVersions('0.1.0', '0.1.1'), -1);
  assert.equal(compareVersions('0.2.0', '0.1.9'), 1);
  assert.equal(compareVersions('1.0.0', '0.9.9'), 1);
  assert.equal(compareVersions({ major: 0, minor: 1, patch: 0 }, { major: 0, minor: 1, patch: 0 }), 0);
});

test('isValidVersion: boolean', () => {
  assert.equal(isValidVersion('0.1.0'), true);
  assert.equal(isValidVersion('v0.1.0'), true);
  assert.equal(isValidVersion('1.2'), false);
  assert.equal(isValidVersion('1.2.3-beta'), false);
  assert.equal(isValidVersion(''), false);
});

test('현재 상태 회귀: current 0.1.0 + latestTag v0.1.0 → arg 없음이면 0.1.1', () => {
  assert.deepEqual(
    resolveTargetVersion({ current: '0.1.0', latestTag: 'v0.1.0' }),
    { major: 0, minor: 1, patch: 1 },
  );
});
