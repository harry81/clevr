const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createDatabase } = require('../../../src/main/db/sqliteEngine');
const { createPartnerService, normalizeBizNo } = require('../../../src/main/services/partnerService');

function setup() {
  const db = createDatabase(':memory:');
  db.prepare('INSERT INTO companies (id, company_name, biz_no) VALUES (?, ?, ?)').run('c1', '한빛정밀', '123-45-67890');
  db.prepare('INSERT INTO companies (id, company_name, biz_no) VALUES (?, ?, ?)').run('c2', '타회사', '987-65-43210');
  return { db, service: createPartnerService(db), companyId: 'c1' };
}

function seedInvoiceAndPayment(db, { companyId, partnerId, total, paid }) {
  const vat = Math.trunc((total - 100) * 0.1) || 0;
  db.prepare(
    `INSERT INTO invoices (id, company_id, partner_id, invoice_no, billing_month, supply_amount, vat_amount, total_amount, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(`inv-${partnerId}-${total}`, companyId, partnerId, `INV-${total}`, '2026-09', total, 0, total, 'UNPAID');
  if (paid > 0) {
    db.prepare(
      `INSERT INTO payments (id, company_id, partner_id, amount, payment_date)
       VALUES (?, ?, ?, ?, ?)`
    ).run(`pay-${partnerId}-${paid}`, companyId, partnerId, paid, '2026-09-10');
  }
}

test('savePartner: 신규 거래처 등록 — id/partnerCode 자동 생성', () => {
  const { db, service, companyId } = setup();
  const saved = service.savePartner(companyId, { partnerName: '한빛정밀' });
  assert.ok(saved.id);
  assert.ok(saved.partnerCode);
  const row = db.prepare('SELECT * FROM partners WHERE id = ?').get(saved.id);
  assert.equal(row.partner_name, '한빛정밀');
  assert.equal(row.company_id, companyId);
  db.close();
});

test('savePartner: 품목단가표 저장 및 조회 복원', () => {
  const { service, companyId } = setup();
  const priceTable = [
    { itemName: '정밀가공A', unitPrice: 12500 },
    { itemName: '정밀가공B', unitPrice: 25000 }
  ];
  const saved = service.savePartner(companyId, { partnerName: '한빛정밀', priceTable });
  assert.deepEqual(saved.priceTable, priceTable);
  const reloaded = service.getPartner(companyId, saved.id);
  assert.deepEqual(reloaded.priceTable, priceTable);
});

test('savePartner: 잘못된 품목단가표 → 예외', () => {
  const { service, companyId } = setup();
  assert.throws(() => service.savePartner(companyId, { partnerName: 'A', priceTable: [{ itemName: '', unitPrice: 100 }] }), /itemName|품목명/i);
  assert.throws(() => service.savePartner(companyId, { partnerName: 'A', priceTable: [{ itemName: 'B', unitPrice: -100 }] }), /unitPrice|단가/i);
  assert.throws(() => service.savePartner(companyId, { partnerName: 'A', priceTable: [{ itemName: 'B', unitPrice: 12.5 }] }), /unitPrice|단가/i);
  assert.throws(() => service.savePartner(companyId, { partnerName: 'A', priceTable: 'not-array' }), /배열/i);
});

test('savePartner: 동일 회사 내 중복 사업자번호 → 예외', () => {
  const { service, companyId } = setup();
  service.savePartner(companyId, { partnerName: '한빛정밀', bizNo: '123-45-67890' });
  assert.throws(
    () => service.savePartner(companyId, { partnerName: '다른회사', bizNo: '123-45-67890' }),
    /사업자등록번호/i
  );
});

test('savePartner: 다른 회사의 동일 사업자번호는 허용', () => {
  const { service, companyId } = setup();
  service.savePartner(companyId, { partnerName: '한빛정밀', bizNo: '123-45-67890' });
  const saved = service.savePartner('c2', { partnerName: '타회사거래처', bizNo: '123-45-67890' });
  assert.ok(saved.id);
});

test('savePartner: 기존 거래처 수정(id 지정)', () => {
  const { db, service, companyId } = setup();
  const saved = service.savePartner(companyId, { partnerName: '한빛정밀', tel: '054-111-1111' });
  const updated = service.savePartner(companyId, { id: saved.id, partnerName: '한빛정밀가공', tel: '054-222-2222' });
  assert.equal(updated.partnerName, '한빛정밀가공');
  assert.equal(updated.tel, '054-222-2222');
  const row = db.prepare('SELECT * FROM partners WHERE id = ?').get(saved.id);
  assert.equal(row.partner_name, '한빛정밀가공');
});

test('savePartner: 수정 시 자기 자신과의 사업자번호 중복은 허용', () => {
  const { service, companyId } = setup();
  const saved = service.savePartner(companyId, { partnerName: '한빛정밀', bizNo: '123-45-67890' });
  const updated = service.savePartner(companyId, { id: saved.id, partnerName: '한빛정밀2', bizNo: '123-45-67890' });
  assert.equal(updated.partnerName, '한빛정밀2');
});

test('deletePartner: 삭제 성공', () => {
  const { db, service, companyId } = setup();
  const saved = service.savePartner(companyId, { partnerName: '한빛정밀' });
  const result = service.deletePartner(companyId, saved.id);
  assert.equal(result.ok, true);
  assert.equal(db.prepare('SELECT COUNT(*) AS c FROM partners WHERE company_id = ?').get(companyId).c, 0);
});

test('listPartners: 거래처명 부분검색(LIKE) + 정렬(가나다)', () => {
  const { service, companyId } = setup();
  service.savePartner(companyId, { partnerName: '가나다공업', bizNo: '111-11-11111' });
  service.savePartner(companyId, { partnerName: '한빛정밀', bizNo: '222-22-22222' });
  service.savePartner(companyId, { partnerName: '한국가공', bizNo: '333-33-33333' });
  const hit = service.listPartners(companyId, '한');
  assert.equal(hit.length, 2);
  assert.deepEqual(hit.map(p => p.partnerName), ['한국가공', '한빛정밀']);
});

test('listPartners: 사업자번호 부분검색', () => {
  const { service, companyId } = setup();
  service.savePartner(companyId, { partnerName: '한빛정밀', bizNo: '123-45-67890' });
  service.savePartner(companyId, { partnerName: '한국가공', bizNo: '987-65-43210' });
  const hit = service.listPartners(companyId, '678');
  assert.equal(hit.length, 1);
  assert.equal(hit[0].partnerName, '한빛정밀');
});

test('listPartners: 키워드 없으면 전체 목록', () => {
  const { service, companyId } = setup();
  service.savePartner(companyId, { partnerName: '가나다' });
  service.savePartner(companyId, { partnerName: '한빛' });
  assert.equal(service.listPartners(companyId).length, 2);
});

// ---------- T2' bizNo 선택화 (1인 사업자/학원) ----------
test('savePartner: 빈 bizNo 저장 통과', () => {
  const { service, companyId } = setup();
  const saved = service.savePartner(companyId, { partnerName: '빈번호회원', bizNo: '' });
  assert.ok(saved.id);
  assert.ok(!saved.bizNo);
});

test('savePartner: 임의 문자열 식별자는 저장 통과 + 동일 식별자 중복 검사 면제', () => {
  const { service, companyId } = setup();
  const a = service.savePartner(companyId, { partnerName: '학원A', bizNo: '학원-001' });
  const b = service.savePartner(companyId, { partnerName: '학원B', bizNo: '학원-001' });
  assert.ok(a.id && b.id, '비매칭 임의 식별자는 중복 검사 대상이 아니어야 함');
});

// ---------- T6 bizNo 정규화 (Advisory #1) ----------
test('T6: normalizeBizNo — 10자리 하이픈화 / 이동전화·임의값 원문 / 빈값 null', () => {
  assert.equal(normalizeBizNo('1234567890'), '123-45-67890');
  assert.equal(normalizeBizNo('123-45-67890'), '123-45-67890');
  assert.equal(normalizeBizNo('01012345678'), '01012345678');
  assert.equal(normalizeBizNo('0101234567'), '0101234567');
  assert.equal(normalizeBizNo('학원-001'), '학원-001');
  assert.equal(normalizeBizNo(''), null);
  assert.equal(normalizeBizNo(null), null);
  assert.equal(normalizeBizNo(undefined), null);
});

test('회귀: 서울 유선전화(02-1234-5678) 등 10자리 일반 번호는 원문 보존', () => {
  assert.equal(normalizeBizNo('02-1234-5678'), '02-1234-5678');
  assert.equal(normalizeBizNo('0212345678'), '0212345678');
  assert.equal(normalizeBizNo('031-1234-5678'), '031-1234-5678');
  assert.equal(normalizeBizNo('0511234567'), '0511234567');
});

test('회귀: 유선전화는 저장 시에도 원문 보존(021-23-45678 오변환 없음)', () => {
  const { service, companyId } = setup();
  const saved = service.savePartner(companyId, { partnerName: '유선번호', bizNo: '02-1234-5678' });
  assert.equal(saved.bizNo, '02-1234-5678');
});

test('T6: 하이픈 없는 10자리 정규화 저장 + 정규화 후 중복 거부', () => {
  const { service, companyId } = setup();
  const a = service.savePartner(companyId, { partnerName: 'A', bizNo: '1234567890' });
  assert.equal(a.bizNo, '123-45-67890');
  assert.throws(
    () => service.savePartner(companyId, { partnerName: 'B', bizNo: '1234567890' }),
    /사업자등록번호/
  );
});

test('T6: 이동전화 대역은 사업자번호로 정규화되지 않음(원문 저장·중복 면제)', () => {
  const { service, companyId } = setup();
  const a = service.savePartner(companyId, { partnerName: 'A', bizNo: '01012345678' });
  assert.equal(a.bizNo, '01012345678');
  const b = service.savePartner(companyId, { partnerName: 'B', bizNo: '01012345678' });
  assert.ok(b.id, '이동전화는 중복 검사 대상이 아니어야 함');
});

// ---------- T2 퇴원(비활성) 처리 ----------
test('T2: 신규 등록 거래처는 기본 재원(isActive === true)', () => {
  const { service, companyId } = setup();
  const saved = service.savePartner(companyId, { partnerName: '한빛정밀' });
  assert.equal(saved.isActive, true);
  assert.equal(service.getPartner(companyId, saved.id).isActive, true);
});

test('T2: setActive(false)→퇴원, setActive(true)→재원 복귀', () => {
  const { service, companyId } = setup();
  const saved = service.savePartner(companyId, { partnerName: '한빛정밀' });
  const off = service.setActive(companyId, saved.id, false);
  assert.equal(off.isActive, false);
  assert.equal(service.getPartner(companyId, saved.id).isActive, false);
  const on = service.setActive(companyId, saved.id, true);
  assert.equal(on.isActive, true);
});

test('T2: setActive 미존재 파트너 → 한국어 throw', () => {
  const { service, companyId } = setup();
  assert.throws(() => service.setActive(companyId, 'no-such', false), /찾을 수 없습니다/);
  assert.throws(() => service.setActive(companyId, 'x', 'nope'), /true\/false/);
});

test('T2: listPartners 상태 필터 — 기본 active / inactive / all', () => {
  const { service, companyId } = setup();
  const a = service.savePartner(companyId, { partnerName: '가나다공업', bizNo: '111-11-11111' });
  service.savePartner(companyId, { partnerName: '한빛정밀', bizNo: '222-22-22222' });
  service.setActive(companyId, a.id, false);

  assert.deepEqual(service.listPartners(companyId).map(p => p.partnerName), ['한빛정밀']);
  assert.deepEqual(service.listPartners(companyId, '', { status: 'inactive' }).map(p => p.partnerName), ['가나다공업']);
  assert.deepEqual(service.listPartners(companyId, '', { status: 'all' }).map(p => p.partnerName), ['가나다공업', '한빛정밀']);
  assert.throws(() => service.listPartners(companyId, '', { status: 'bogus' }), /active\/inactive\/all/);
});

test('T2: 청구 이력 있는 거래처 삭제 → 한국어 거부 + 행 잔존', () => {
  const { db, service, companyId } = setup();
  const a = service.savePartner(companyId, { partnerName: '한빛정밀' });
  seedInvoiceAndPayment(db, { companyId, partnerId: a.id, total: 11000, paid: 0 });
  assert.throws(() => service.deletePartner(companyId, a.id), /삭제할 수 없습니다/);
  assert.equal(db.prepare('SELECT COUNT(*) AS c FROM partners WHERE id = ?').get(a.id).c, 1);
});

test('T2: 입금만/원장만 이력도 삭제 거부', () => {
  const { db, service, companyId } = setup();
  const p1 = service.savePartner(companyId, { partnerName: '입금만' });
  db.prepare('INSERT INTO payments (id, company_id, partner_id, amount, payment_date) VALUES (?, ?, ?, ?, ?)')
    .run('pay-only', companyId, p1.id, 1000, '2026-09-10');
  assert.throws(() => service.deletePartner(companyId, p1.id), /삭제할 수 없습니다/);

  const p2 = service.savePartner(companyId, { partnerName: '원장만' });
  db.prepare(`INSERT INTO ledger_entries (id, company_id, partner_id, entry_date, entry_type, running_balance)
              VALUES (?, ?, ?, ?, ?, ?)`).run('led-only', companyId, p2.id, '2026-09-30', '매출청구', 1000);
  assert.throws(() => service.deletePartner(companyId, p2.id), /삭제할 수 없습니다/);
});

test('T2: 퇴원 상태에서 이름 수정 → isActive 유지(재원 복귀 안 됨)', () => {
  const { service, companyId } = setup();
  const saved = service.savePartner(companyId, { partnerName: '한빛정밀' });
  service.setActive(companyId, saved.id, false);
  const updated = service.savePartner(companyId, { id: saved.id, partnerName: '한빛정밀가공' });
  assert.equal(updated.partnerName, '한빛정밀가공');
  assert.equal(updated.isActive, false);
});

test('거래처별 현재 미수잔액 = Σ청구(합계) − Σ입금', () => {
  const { db, service, companyId } = setup();
  const a = service.savePartner(companyId, { partnerName: '한빛정밀' });
  const b = service.savePartner(companyId, { partnerName: '한국가공' });
  seedInvoiceAndPayment(db, { companyId, partnerId: a.id, total: 11000, paid: 4000 });
  seedInvoiceAndPayment(db, { companyId, partnerId: a.id, total: 22000, paid: 0 });
  seedInvoiceAndPayment(db, { companyId, partnerId: b.id, total: 5000, paid: 5000 });

  const partners = service.listPartners(companyId);
  const pa = partners.find(p => p.id === a.id);
  const pb = partners.find(p => p.id === b.id);
  assert.equal(pa.billedAmount, 33000);
  assert.equal(pa.paidAmount, 4000);
  assert.equal(pa.outstandingBalance, 29000);
  assert.equal(pb.billedAmount, 5000);
  assert.equal(pb.paidAmount, 5000);
  assert.equal(pb.outstandingBalance, 0);

  const detail = service.getPartner(companyId, a.id);
  assert.equal(detail.outstandingBalance, 29000);
});