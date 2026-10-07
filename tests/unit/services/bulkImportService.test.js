const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createDatabase } = require('../../../src/main/db/sqliteEngine');
const { createPartnerService } = require('../../../src/main/services/partnerService');
const { parsePartnersText, createBulkImportService } = require('../../../src/main/services/bulkImportService');

// T09 Magic Import: 클립보드 TSV/CSV 파서(순수) + 일괄 저장(중복 bizNo skip, 행별 error).

function setup() {
  const db = createDatabase(':memory:');
  db.prepare('INSERT INTO companies (id, company_name, biz_no) VALUES (?, ?, ?)').run('c1', '한빛정밀', '123-45-67890');
  return { db, service: createPartnerService(db), companyId: 'c1' };
}

// ---------- parsePartnersText ----------

test('parse: 헤더 없는 정상 3행(TSV) → 거래처/단가 파싱', () => {
  const text = [
    '한빛정밀\t123-45-67890\t홍길동\t054-111-2222\t정밀가공\t50000',
    '가나다공업\t111-22-33333\t김가나\t054-222-3333\t밀링가공\t35000',
    '대성금속\t222-33-44444\t이대성\t054-333-4444\t레이저절단\t20000',
  ].join('\n');
  const { rows, errors } = parsePartnersText(text);
  assert.equal(errors.length, 0);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].partnerName, '한빛정밀');
  assert.equal(rows[0].bizNo, '123-45-67890');
  assert.equal(rows[0].ceoName, '홍길동');
  assert.deepEqual(rows[0].priceTable, [{ itemName: '정밀가공', unitPrice: 50000 }]);
});

test('parse: 헤더 감지(상호/사업자) + 사업자번호·단가 정규화', () => {
  const text = [
    '상호\t사업자번호\t대표자\t연락처\t품목명\t단가',
    '한빛정밀\t1234567890\t홍길동\t054-111-2222\t정밀가공\t50,000',
    '가나다공업\t111-22-33333\t김가나\t\t밀링가공\t35000',
  ].join('\n');
  const { rows, errors } = parsePartnersText(text);
  assert.equal(errors.length, 0);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].bizNo, '123-45-67890');
  assert.equal(rows[0].priceTable[0].unitPrice, 50000);
});

test('parse: 이동전화 대역은 사업자번호로 정규화하지 않음(공유 normalizeBizNo)', () => {
  const { rows } = parsePartnersText('학생A\t01012345678\t\t\t수강료\t300000');
  assert.equal(rows[0].bizNo, '01012345678');
});

test('parse: CSV(콤마) 구분자 지원', () => {
  const { rows } = parsePartnersText('한빛정밀,123-45-67890,홍길동,054-111-2222,정밀가공,50000');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].partnerName, '한빛정밀');
});

test('parse: 신규 헤더(이름 / 상호 · 연락처 / 식별번호) 수용 + 빈 식별번호 허용', () => {
  const text = [
    '이름 / 상호\t연락처 / 식별번호\t대표자\t연락처\t항목명\t금액',
    '한빛정밀\t\t홍길동\t054-111-2222\t수강료\t50000',
    '가나다공업\t111-22-33333\t김가나\t\t수강료\t35000',
  ].join('\n');
  const { rows, errors } = parsePartnersText(text);
  assert.equal(errors.length, 0);
  assert.equal(rows.length, 2);
  const first = rows.find((r) => r.partnerName === '한빛정밀');
  assert.equal(first.bizNo, null);
});

test('parse: 신규 헤더(회원 · 식별번호) 수용 (하위 호환 — 사업자번호 헤더도 기존 테스트가 보증)', () => {
  const text = [
    '회원명\t식별번호\t대표자\t연락처\t항목명\t금액',
    '한빛정밀\t학원-001\t홍길동\t054-111-2222\t수강료\t50000',
  ].join('\n');
  const { rows, errors } = parsePartnersText(text);
  assert.equal(errors.length, 0);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].bizNo, '학원-001');
});

test('saveBulk: 빈/임의 bizNo 행도 등록 통과 (중복 검사 면제)', () => {
  const { db, service, companyId } = setup();
  const res = service.savePartnersBulk(companyId, [
    { partnerName: '빈번호', bizNo: '', priceTable: [{ itemName: '수강료', unitPrice: 50000 }] },
    { partnerName: '학원A', bizNo: '학원-001' },
    { partnerName: '학원B', bizNo: '학원-001' },
  ]);
  assert.equal(res.created, 3);
  assert.equal(res.errors.length, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS c FROM partners').get().c, 3);
});

test('parse: 컬럼 부족/단가 오류 → 행별 error, 전체 중단 없음', () => {
  const text = [
    '한빛정밀\t123-45-67890\t홍길동\t054-111-2222\t정밀가공\t50000',
    '\t111-11-11111\t\t\t\t',
    '가나다공업\t222-22-22222\t김가나\t\t밀링가공\t',
    '대성금속\t333-33-33333\t이대성\t\t레이저절단\t20000',
  ].join('\n');
  const { rows, errors } = parsePartnersText(text);
  assert.equal(rows.length, 2);
  assert.equal(errors.length, 2);
  assert.ok(errors.every((e) => Number.isInteger(e.line) && e.message));
});

test('parse: 동일 거래처(bizNo) 복수행 → 단가 그룹핑', () => {
  const text = [
    '한빛정밀\t123-45-67890\t홍길동\t054-111-2222\t정밀가공\t50000',
    '한빛정밀\t123-45-67890\t\t\t밀링가공\t35000',
  ].join('\n');
  const { rows } = parsePartnersText(text);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].priceTable, [
    { itemName: '정밀가공', unitPrice: 50000 },
    { itemName: '밀링가공', unitPrice: 35000 },
  ]);
});

test('parse: 빈 클립보드/공백 → rows·errors 빈 배열', () => {
  assert.deepEqual(parsePartnersText(''), { rows: [], errors: [] });
  assert.deepEqual(parsePartnersText('   \n  \n'), { rows: [], errors: [] });
  assert.deepEqual(parsePartnersText(null), { rows: [], errors: [] });
});

// ---------- savePartnersBulk ----------

test('saveBulk: 신규 등록 + 중복 bizNo skip(upsert 아님)', () => {
  const { db, service, companyId } = setup();
  const res = service.savePartnersBulk(companyId, [
    { partnerName: '한빛정밀', bizNo: '123-45-67890', priceTable: [{ itemName: '정밀가공', unitPrice: 50000 }] },
    { partnerName: '중복상사', bizNo: '123-45-67890' },
    { partnerName: '가나다공업', bizNo: '111-22-33333' },
  ]);
  assert.equal(res.created, 2);
  assert.equal(res.skipped, 1);
  assert.equal(res.errors.length, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS c FROM partners').get().c, 2);
  db.close();
});

test('saveBulk: 기존 등록된 bizNo도 skip', () => {
  const { service, companyId } = setup();
  service.savePartner(companyId, { partnerName: '한빛정밀', bizNo: '123-45-67890' });
  const res = service.savePartnersBulk(companyId, [
    { partnerName: '한빛정밀가공', bizNo: '123-45-67890' },
    { partnerName: '가나다공업', bizNo: '111-22-33333' },
  ]);
  assert.equal(res.created, 1);
  assert.equal(res.skipped, 1);
});

test('saveBulk: 행별 검증 오류는 errors에 담고 나머지는 등록', () => {
  const { db, service, companyId } = setup();
  const res = service.savePartnersBulk(companyId, [
    { partnerName: '', bizNo: '111-11-11111' },
    { partnerName: '한빛정밀', bizNo: '123-45-67890' },
    { partnerName: '불량단가', priceTable: [{ itemName: '정밀가공', unitPrice: -1 }] },
  ]);
  assert.equal(res.created, 1);
  assert.equal(res.errors.length, 2);
  assert.equal(db.prepare('SELECT COUNT(*) AS c FROM partners').get().c, 1);
});

test('bulkImportService: createBulkImportService.saveBulk가 parse→저장 위임', () => {
  const { db, companyId } = setup();
  const bulk = createBulkImportService(db);
  const { rows } = bulk.parseText('한빛정밀\t123-45-67890\t홍길동\t\t정밀가공\t50000');
  const res = bulk.saveBulk(companyId, rows);
  assert.equal(res.created, 1);
  assert.equal(db.prepare('SELECT partner_name FROM partners WHERE company_id = ?').get(companyId).partner_name, '한빛정밀');
});
