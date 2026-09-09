const { test } = require('node:test');
const assert = require('node:assert/strict');
const { hashPassword, verifyPassword, HASH_LENGTH, SALT_LENGTH } = require('../../../src/shared/security/hasher');

test('hashPassword: 비밀번호 해시 생성', () => {
  const result = hashPassword('admin1234!');
  assert.equal(typeof result.hash, 'string');
  assert.equal(typeof result.salt, 'string');
  assert.ok(result.hash.length > 0);
  assert.ok(result.salt.length > 0);
});

test('hashPassword: salt는 16바이트(hex 32자), hash는 고정 길이', () => {
  const result = hashPassword('secret');
  assert.equal(result.salt.length, SALT_LENGTH * 2);
  assert.equal(result.hash.length, HASH_LENGTH * 2);
});

test('hashPassword: 동일 비밀번호라도 salt가 달라 해시가 매번 다름', () => {
  const a = hashPassword('same-pw');
  const b = hashPassword('same-pw');
  assert.notEqual(a.hash, b.hash);
  assert.notEqual(a.salt, b.salt);
});

test('verifyPassword: 올바른 비밀번호 → true', () => {
  const { hash, salt } = hashPassword('admin1234!');
  assert.equal(verifyPassword('admin1234!', hash, salt), true);
});

test('verifyPassword: 틀린 비밀번호 → false', () => {
  const { hash, salt } = hashPassword('admin1234!');
  assert.equal(verifyPassword('wrong-pw', hash, salt), false);
});

test('verifyPassword: 잘못된 salt → false', () => {
  const { hash } = hashPassword('admin1234!');
  assert.equal(verifyPassword('admin1234!', hash, 'a'.repeat(32)), false);
});

test('verifyPassword: 잘못된 hash → false', () => {
  const { salt } = hashPassword('admin1234!');
  assert.equal(verifyPassword('admin1234!', 'b'.repeat(128), salt), false);
});

test('verifyPassword: 무효 hex hash(zzzz) → false (인증 우회 방지)', () => {
  const { salt } = hashPassword('admin1234!');
  assert.equal(verifyPassword('anything', 'zzzz', salt), false);
});

test('verifyPassword: hash는 정상이나 무효 hex salt(zzzz) → false', () => {
  const { hash } = hashPassword('admin1234!');
  assert.equal(verifyPassword('admin1234!', hash, 'zzzz'), false);
});

test('verifyPassword: hash 길이 127자(형식 불일치) → false', () => {
  const { salt } = hashPassword('admin1234!');
  assert.equal(verifyPassword('admin1234!', 'a'.repeat(127), salt), false);
});

test('verifyPassword: 정상 hex hash 전체 0(128자) + 임의 비밀번호 → false (우회 불가)', () => {
  const { salt } = hashPassword('admin1234!');
  assert.equal(verifyPassword('anything', '0'.repeat(128), salt), false);
});

test('verifyPassword: 정상 라운드트립 유지 (회귀)', () => {
  const { hash, salt } = hashPassword('admin1234!');
  assert.equal(verifyPassword('admin1234!', hash, salt), true);
});

test('hashPassword: 빈 문자열 → 예외', () => {
  assert.throws(() => hashPassword(''), /password/i);
});

test('hashPassword: 문자열이 아닌 인자 → 예외', () => {
  assert.throws(() => hashPassword(null), /password/i);
  assert.throws(() => hashPassword(undefined), /password/i);
  assert.throws(() => hashPassword(1234), /password/i);
});

test('verifyPassword: 유효하지 않은 인자 → 예외', () => {
  const { hash, salt } = hashPassword('admin1234!');
  assert.throws(() => verifyPassword('', hash, salt), /password/i);
  assert.throws(() => verifyPassword('admin1234!', null, salt), /hash/i);
  assert.throws(() => verifyPassword('admin1234!', hash, null), /salt/i);
});