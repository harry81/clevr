const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createDatabase } = require('../../../src/main/db/sqliteEngine');
const { isOnboardingNeeded, completeOnboarding } = require('../../../src/main/services/onboardingService');
const { verifyPassword } = require('../../../src/shared/security/hasher');

function validData() {
  return {
    company: {
      companyName: '한빛정밀',
      bizNo: '123-45-67890',
      ceoName: '홍길동',
      bizType: '제조업',
      bizItem: '정밀가공',
      address: '경북 구미시 산업로 123',
      tel: '054-123-4567'
    },
    admin: { username: 'admin', password: 'admin1234!' },
    items: [
      { itemName: '정밀가공A', unitPrice: 12500 },
      { itemName: '정밀가공B', unitPrice: 25000 }
    ]
  };
}

test('isOnboardingNeeded: 초기 DB에서 true 반환', () => {
  const db = createDatabase(':memory:');
  assert.equal(isOnboardingNeeded(db), true);
  db.close();
});

test('isOnboardingNeeded: 온보딩 완료 후 false 반환', () => {
  const db = createDatabase(':memory:');
  completeOnboarding(db, validData());
  assert.equal(isOnboardingNeeded(db), false);
  db.close();
});

test('completeOnboarding: 회사/관리자/품목 생성 및 결과 반환', () => {
  const db = createDatabase(':memory:');
  const result = completeOnboarding(db, validData());
  assert.ok(result.companyId);
  assert.ok(result.userId);
  assert.equal(result.onboardingComplete, true);

  const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(result.companyId);
  assert.equal(company.company_name, '한빛정밀');
  assert.equal(company.biz_no, '123-45-67890');

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.userId);
  assert.equal(user.username, 'admin');
  assert.equal(user.role, 'admin');
  assert.equal(user.company_id, result.companyId);

  const items = db.prepare('SELECT * FROM items WHERE company_id = ?').all(result.companyId);
  assert.equal(items.length, 2);
  db.close();
});

test('completeOnboarding: GENSYS 데모 계정이 생성되지 않음', () => {
  const db = createDatabase(':memory:');
  completeOnboarding(db, validData());
  const all = db.prepare('SELECT * FROM users').all();
  assert.equal(all.length, 1);
  assert.equal(all[0].username, 'admin');
  assert.ok(all.every(u => u.username !== 'GENSYS' && u.company_id !== 'GENSYS'));
  db.close();
});

test('completeOnboarding: 관리자 비밀번호가 단방향 해시로 저장', () => {
  const db = createDatabase(':memory:');
  const data = validData();
  completeOnboarding(db, data);
  const user = db.prepare('SELECT * FROM users').get();
  assert.notEqual(user.password_hash, data.admin.password);
  assert.notEqual(user.password_hash, '1234');
  assert.ok(user.salt);
  assert.equal(verifyPassword(data.admin.password, user.password_hash, user.salt), true);
  db.close();
});

test('completeOnboarding: 사업자등록번호 형식 오류 시 예외', () => {
  const db = createDatabase(':memory:');
  const bad = validData();
  bad.company.bizNo = '1234567890';
  assert.throws(() => completeOnboarding(db, bad), /사업자등록번호/i);
  db.close();
});

test('completeOnboarding: 필수값 누락 시 예외', () => {
  const db = createDatabase(':memory:');
  assert.throws(() => completeOnboarding(db, {}), /company/i);

  const noCompany = validData();
  delete noCompany.company.companyName;
  assert.throws(() => completeOnboarding(db, noCompany), /회사명|company/i);

  const noAdmin = validData();
  delete noAdmin.admin.password;
  assert.throws(() => completeOnboarding(db, noAdmin), /비밀번호|password/i);
  db.close();
});

test('completeOnboarding: 트랜잭션 원자성 — 잘못된 품목 시 전체 롤백', () => {
  const db = createDatabase(':memory:');
  const data = validData();
  data.items = [{ itemName: '불량품목', unitPrice: -100 }];
  assert.throws(() => completeOnboarding(db, data), /unitPrice/i);
  assert.equal(db.prepare('SELECT COUNT(*) AS c FROM companies').get().c, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS c FROM users').get().c, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS c FROM items').get().c, 0);
  db.close();
});