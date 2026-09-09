const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createDatabase } = require('../../../src/main/db/sqliteEngine');
const { createPartnerService } = require('../../../src/main/services/partnerService');

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