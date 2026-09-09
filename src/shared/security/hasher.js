const crypto = require('node:crypto');

const SALT_LENGTH = 16;
const HASH_LENGTH = 64;
const HASH_HEX_RE = /^[0-9a-f]{128}$/;
const SALT_HEX_RE = /^[0-9a-f]{32}$/;

function assertString(value, name) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
}

function hashPassword(password) {
  assertString(password, 'password');
  const salt = crypto.randomBytes(SALT_LENGTH);
  const hash = crypto.scryptSync(password, salt, HASH_LENGTH);
  return {
    hash: hash.toString('hex'),
    salt: salt.toString('hex')
  };
}

function verifyPassword(password, hash, salt) {
  assertString(password, 'password');
  assertString(hash, 'hash');
  assertString(salt, 'salt');
  if (!HASH_HEX_RE.test(hash) || !SALT_HEX_RE.test(salt)) return false;
  const expected = Buffer.from(hash, 'hex');
  const actual = crypto.scryptSync(password, Buffer.from(salt, 'hex'), expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

module.exports = { hashPassword, verifyPassword, SALT_LENGTH, HASH_LENGTH, HASH_HEX_RE, SALT_HEX_RE };