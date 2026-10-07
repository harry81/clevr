const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createDatabase } = require('../../../src/main/db/sqliteEngine');
const { createSmeHandlers, createSessionStore } = require('../../../src/main/ipc/smeHandlers');
const { completeOnboarding } = require('../../../src/main/services/onboardingService');

const CHANNELS = [
  'sme:auth:login', 'sme:auth:logout', 'sme:auth:checkSession',
  'sme:onboarding:getStatus', 'sme:onboarding:submit',
  'sme:dashboard:getSummary',
  'sme:partners:list', 'sme:partners:get', 'sme:partners:save', 'sme:partners:delete',
  'sme:partners:setActive',
  'sme:partners:parseBulk', 'sme:partners:saveBulk',
  'sme:invoices:list', 'sme:invoices:createBatch', 'sme:invoices:updateStatus',
  'sme:ledger:getPartnerLedger', 'sme:ledger:recordPayment'
];

function setup() {
  const db = createDatabase(':memory:');
  const session = createSessionStore();
  const handlers = createSmeHandlers({ db, session });
  return { db, session, handlers };
}

function seedCompany(db) {
  return completeOnboarding(db, {
    company: { companyName: '한빛정밀', bizNo: '123-45-67890', ceoName: '홍길동' },
    admin: { username: 'admin', password: 'admin1234!' },
    items: []
  });
}

function seedPartner(handlers, companyId, partnerName = '대양공업') {
  return handlers['sme:partners:save']({
    companyId,
    partner: { partnerName, bizNo: '111-22-33333', priceTable: [{ itemName: '정밀가공', unitPrice: 10000 }] }
  });
}

test('채널 레지스트리: 6그룹 18채널 고정', () => {
  const { db, handlers } = setup();
  assert.deepEqual(Object.keys(handlers).sort(), CHANNELS.slice().sort());
});

test('전 채널 빈 payload 호출 → throw 없이 {ok:boolean} 반환', async () => {
  const { db, handlers } = setup();
  for (const name of CHANNELS) {
    const res = await handlers[name]({});
    assert.equal(typeof res.ok, 'boolean', name);
    if (!res.ok) assert.equal(typeof res.message, 'string', name);
  }
});

// ---------- auth ----------
test('auth:login 성공 → 세션 설정, 해시 유출 없음', async () => {
  const { db, handlers } = setup();
  seedCompany(db);
  const res = await handlers['sme:auth:login']({ username: 'admin', password: 'admin1234!' });
  assert.equal(res.ok, true);
  assert.equal(res.data.user.username, 'admin');
  assert.equal(res.data.user.role, 'admin');
  assert.equal(res.data.user.password_hash, undefined);
  assert.equal(res.data.user.salt, undefined);
  const sess = await handlers['sme:auth:checkSession']({});
  assert.equal(sess.data.user.username, 'admin');
});

test('auth:login 실패(오비밀번호) → {ok:false}', async () => {
  const { db, handlers } = setup();
  seedCompany(db);
  const res = await handlers['sme:auth:login']({ username: 'admin', password: 'wrong' });
  assert.equal(res.ok, false);
  assert.equal(typeof res.message, 'string');
});

test('auth:login 인자 누락 → {ok:false}', async () => {
  const { db, handlers } = setup();
  seedCompany(db);
  assert.equal((await handlers['sme:auth:login']({ username: 'admin' })).ok, false);
  assert.equal((await handlers['sme:auth:login']({})).ok, false);
});

test('auth:logout → 세션 해제', async () => {
  const { db, handlers } = setup();
  seedCompany(db);
  await handlers['sme:auth:login']({ username: 'admin', password: 'admin1234!' });
  assert.equal((await handlers['sme:auth:logout']({})).ok, true);
  assert.equal((await handlers['sme:auth:checkSession']({})).data.user, null);
});

// ---------- onboarding ----------
test('onboarding:getStatus fresh → needed true', async () => {
  const { db, handlers } = setup();
  const res = await handlers['sme:onboarding:getStatus']({});
  assert.deepEqual(res, { ok: true, data: { needed: true } });
});

test('onboarding:submit 정상 → 완료 후 needed false', async () => {
  const { db, handlers } = setup();
  const res = await handlers['sme:onboarding:submit']({
    company: { companyName: '한빛정밀', bizNo: '123-45-67890' },
    admin: { username: 'admin', password: 'admin1234!' },
    applyTemplate: false
  });
  assert.equal(res.ok, true);
  assert.equal(res.data.onboardingComplete, true);
  assert.ok(res.data.companyId);
  assert.equal((await handlers['sme:onboarding:getStatus']({})).data.needed, false);
});

test('onboarding:submit 검증실패 → {ok:false}', async () => {
  const { db, handlers } = setup();
  const res = await handlers['sme:onboarding:submit']({
    company: { companyName: '', bizNo: 'bad-format' },
    admin: { username: 'admin', password: 'admin1234!' }
  });
  assert.equal(res.ok, false);
});

test('onboarding:submit 비매칭 bizNo(전화·임의 식별자) → 허용', async () => {
  const { db, handlers } = setup();
  const res = await handlers['sme:onboarding:submit']({
    company: { companyName: '하늘학원', bizNo: '010-1234-5678' },
    admin: { username: 'admin', password: 'admin1234!' },
    applyTemplate: false
  });
  assert.equal(res.ok, true);
});

// ---------- dashboard ----------
test('dashboard:getSummary → kpi 4키 + 배열 2종', async () => {
  const { db, handlers } = setup();
  const { companyId } = seedCompany(db);
  const res = await handlers['sme:dashboard:getSummary']({ companyId, baseMonth: '2026-09' });
  assert.equal(res.ok, true);
  assert.deepEqual(Object.keys(res.data.kpi).sort(), ['billedAmount', 'growthRate', 'outstandingAmount', 'paidAmount']);
  assert.ok(Array.isArray(res.data.recentInvoices));
  assert.ok(Array.isArray(res.data.topDebtors));
});

test('dashboard:getSummary 인자 누락 → {ok:false}', async () => {
  const { db, handlers } = setup();
  assert.equal((await handlers['sme:dashboard:getSummary']({})).ok, false);
});

// ---------- partners ----------
test('partners: save→get→list→delete 사이클', async () => {
  const { db, handlers } = setup();
  const { companyId } = seedCompany(db);
  const saved = await seedPartner(handlers, companyId);
  assert.equal(saved.ok, true);
  const id = saved.data.id;

  const got = await handlers['sme:partners:get']({ companyId, partnerId: id });
  assert.equal(got.data.partnerName, '대양공업');

  const listed = await handlers['sme:partners:list']({ companyId });
  assert.equal(listed.data.length, 1);

  const searched = await handlers['sme:partners:list']({ companyId, keyword: '대양' });
  assert.equal(searched.data.length, 1);
  const missed = await handlers['sme:partners:list']({ companyId, keyword: 'xxx' });
  assert.equal(missed.data.length, 0);

  const del = await handlers['sme:partners:delete']({ companyId, partnerId: id });
  assert.equal(del.ok, true);
  assert.equal((await handlers['sme:partners:get']({ companyId, partnerId: id })).ok, false);
});

test('partners:save 검증실패/중복 사업자번호 → {ok:false}', async () => {
  const { db, handlers } = setup();
  const { companyId } = seedCompany(db);
  assert.equal((await handlers['sme:partners:save']({ companyId, partner: {} })).ok, false);
  assert.equal((await seedPartner(handlers, companyId)).ok, true);
  assert.equal((await seedPartner(handlers, companyId)).ok, false);
});

test('partners:save 빈/임의 bizNo → ok:true (bizNo 선택화)', async () => {
  const { db, handlers } = setup();
  const { companyId } = seedCompany(db);
  const empty = await handlers['sme:partners:save']({
    companyId,
    partner: { partnerName: '빈번호', bizNo: '', priceTable: [{ itemName: '수강료', unitPrice: 50000 }] }
  });
  assert.equal(empty.ok, true);
  const arbitrary = await handlers['sme:partners:save']({
    companyId, partner: { partnerName: '학원', bizNo: '학원-001' }
  });
  assert.equal(arbitrary.ok, true);
});

test('partners:saveBulk 빈 bizNo 행 검증 통과', async () => {
  const { db, handlers } = setup();
  const { companyId } = seedCompany(db);
  const res = await handlers['sme:partners:saveBulk']({
    companyId,
    rows: [
      { partnerName: '빈번호', bizNo: '', priceTable: [{ itemName: '수강료', unitPrice: 50000 }] },
      { partnerName: '임의식별', bizNo: '학원-001' }
    ]
  });
  assert.equal(res.ok, true);
  assert.equal(res.data.created, 2);
});

// ---------- partners (퇴원/비활성) ----------
test('partners:setActive 성공 / isActive 비boolean 실패', async () => {
  const { db, handlers } = setup();
  const { companyId } = seedCompany(db);
  const saved = await seedPartner(handlers, companyId);
  const off = await handlers['sme:partners:setActive']({ companyId, partnerId: saved.data.id, isActive: false });
  assert.equal(off.ok, true);
  assert.equal(off.data.isActive, false);
  const bad = await handlers['sme:partners:setActive']({ companyId, partnerId: saved.data.id, isActive: 'nope' });
  assert.equal(bad.ok, false);
});

test('partners:list status passthrough — active/inactive/all', async () => {
  const { db, handlers } = setup();
  const { companyId } = seedCompany(db);
  const a = await seedPartner(handlers, companyId, '재원처');
  await handlers['sme:partners:save']({ companyId, partner: { partnerName: '퇴원처', bizNo: '222-33-44444', priceTable: [{ itemName: '가공', unitPrice: 10000 }] } });
  const all0 = await handlers['sme:partners:list']({ companyId });
  const offId = all0.data.find(p => p.partnerName === '퇴원처').id;
  await handlers['sme:partners:setActive']({ companyId, partnerId: offId, isActive: false });

  const active = await handlers['sme:partners:list']({ companyId });
  assert.deepEqual(active.data.map(p => p.partnerName), ['재원처']);
  const inactive = await handlers['sme:partners:list']({ companyId, status: 'inactive' });
  assert.deepEqual(inactive.data.map(p => p.partnerName), ['퇴원처']);
  const all = await handlers['sme:partners:list']({ companyId, status: 'all' });
  assert.equal(all.data.length, 2);
  assert.equal(a.ok, true);
});

test('partners:delete 이력 존재 → ok:false + 한국어(비-FK) 메시지, 행 잔존', async () => {
  const { db, handlers } = setup();
  const { companyId } = seedCompany(db);
  const saved = await seedPartner(handlers, companyId);
  await handlers['sme:invoices:createBatch']({ companyId, billingMonth: '2026-09', partnerIds: [saved.data.id] });
  const del = await handlers['sme:partners:delete']({ companyId, partnerId: saved.data.id });
  assert.equal(del.ok, false);
  assert.match(del.message, /삭제할 수 없습니다/);
  assert.doesNotMatch(del.message, /FOREIGN KEY|constraint/i);
  const got = await handlers['sme:partners:get']({ companyId, partnerId: saved.data.id });
  assert.equal(got.ok, true);
});

// ---------- invoices ----------
test('invoices:createBatch → 목록/상태갱신', async () => {
  const { db, handlers } = setup();
  const { companyId } = seedCompany(db);
  const saved = await seedPartner(handlers, companyId);
  const batch = await handlers['sme:invoices:createBatch']({ companyId, billingMonth: '2026-09', partnerIds: [saved.data.id] });
  assert.equal(batch.ok, true);
  assert.equal(batch.data.summary.totalCount, 1);

  const listed = await handlers['sme:invoices:list']({ companyId, billingMonth: '2026-09' });
  assert.equal(listed.data.length, 1);
  assert.equal(listed.data[0].status, 'UNPAID');
  const invoiceId = listed.data[0].id;

  const upd = await handlers['sme:invoices:updateStatus']({ companyId, invoiceId, status: 'PAID' });
  assert.equal(upd.ok, true);
  assert.equal(upd.data.status, 'PAID');
});

test('invoices:createBatch isTaxExempt 전달 → vat 0', async () => {
  const { db, handlers } = setup();
  const { companyId } = seedCompany(db);
  const saved = await handlers['sme:partners:save']({
    companyId,
    partner: { partnerName: '면세생', priceTable: [{ itemName: '수강료', unitPrice: 200000 }] }
  });
  const batch = await handlers['sme:invoices:createBatch']({
    companyId, billingMonth: '2026-09', partnerIds: [saved.data.id], isTaxExempt: true
  });
  assert.equal(batch.ok, true);
  assert.equal(batch.data.created[0].vatAmount, 0);
  assert.equal(batch.data.created[0].totalAmount, 200000);
});

test('invoices:updateStatus 허용외 상태·미존재 → {ok:false}', async () => {
  const { db, handlers } = setup();
  const { companyId } = seedCompany(db);
  assert.equal((await handlers['sme:invoices:updateStatus']({ companyId, invoiceId: 'nope', status: 'BOGUS' })).ok, false);
  assert.equal((await handlers['sme:invoices:updateStatus']({ companyId, invoiceId: 'nope', status: 'PAID' })).ok, false);
});

// ---------- ledger ----------
test('ledger: recordPayment + getPartnerLedger 왕복', async () => {
  const { db, handlers } = setup();
  const { companyId } = seedCompany(db);
  const saved = await seedPartner(handlers, companyId);
  await handlers['sme:invoices:createBatch']({ companyId, billingMonth: '2026-09', partnerIds: [saved.data.id] });

  const pay = await handlers['sme:ledger:recordPayment']({
    companyId, partnerId: saved.data.id, paymentDate: '2026-09-15', amount: 5000, method: '계좌이체'
  });
  assert.equal(pay.ok, true);

  const view = await handlers['sme:ledger:getPartnerLedger']({ companyId, partnerId: saved.data.id });
  assert.equal(view.ok, true);
  assert.equal(view.data.summary.paidTotal, 5000);
  assert.equal(view.data.summary.outstanding, 11000 - 5000);
});

test('ledger:recordPayment 초과입금 → {ok:false}', async () => {
  const { db, handlers } = setup();
  const { companyId } = seedCompany(db);
  const saved = await seedPartner(handlers, companyId);
  await handlers['sme:invoices:createBatch']({ companyId, billingMonth: '2026-09', partnerIds: [saved.data.id] });
  const res = await handlers['sme:ledger:recordPayment']({
    companyId, partnerId: saved.data.id, paymentDate: '2026-09-15', amount: 99999999, method: '계좌이체'
  });
  assert.equal(res.ok, false);
});
