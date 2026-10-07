const { test } = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');
const {
  createDatabase,
  openDatabase,
  applySchema,
  walCheckpointTruncate
} = require('../../../src/main/db/sqliteEngine');

const EXPECTED_TABLES = ['companies', 'users', 'partners', 'items', 'invoices', 'payments', 'ledger_entries'];

function tempDbPath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sme-db-'));
  return path.join(dir, 'test.db');
}

test('createDatabase: 메모리 DB에 7개 핵심 테이블 생성', () => {
  const db = createDatabase(':memory:');
  const names = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name);
  for (const t of EXPECTED_TABLES) {
    assert.ok(names.includes(t), `테이블 누락: ${t}`);
  }
  db.close();
});

test('createDatabase: 파일 DB에서 journal_mode=WAL 활성화 검증', () => {
  const dbPath = tempDbPath();
  const db = createDatabase(dbPath);
  const row = db.prepare('PRAGMA journal_mode').get();
  assert.equal(row.journal_mode, 'wal');
  db.close();
});

test('createDatabase: synchronous=NORMAL, foreign_keys=ON 검증', () => {
  const db = createDatabase(':memory:');
  assert.equal(db.prepare('PRAGMA synchronous').get().synchronous, 1);
  assert.equal(db.prepare('PRAGMA foreign_keys').get().foreign_keys, 1);
  db.close();
});

test('createDatabase: 필수 인덱스 2종 생성 검증', () => {
  const db = createDatabase(':memory:');
  const names = db.prepare("SELECT name FROM sqlite_master WHERE type='index'").all().map(r => r.name);
  assert.ok(names.includes('idx_invoices_partner_date'), 'idx_invoices_partner_date 누락');
  assert.ok(names.includes('idx_ledger_partner_date'), 'idx_ledger_partner_date 누락');
  db.close();
});

test('applySchema: 멱등성 — 두 번 실행해도 기존 데이터 유지', () => {
  const db = createDatabase(':memory:');
  db.prepare('INSERT INTO companies (id, company_name, biz_no) VALUES (?, ?, ?)')
    .run('c1', '한빛정밀', '123-45-67890');
  applySchema(db);
  const count = db.prepare('SELECT COUNT(*) AS c FROM companies').get().c;
  assert.equal(count, 1);
  db.close();
});

test('walCheckpointTruncate: 파일 DB에서 TRUNCATE checkpoint 성공(busy=0)', () => {
  const dbPath = tempDbPath();
  const db = createDatabase(dbPath);
  const result = walCheckpointTruncate(db);
  assert.equal(result.ok, true);
  db.close();
});

test('foreign_keys ON: 없는 partner_id로 invoices 삽입 시 실패', () => {
  const db = createDatabase(':memory:');
  assert.throws(() => {
    db.prepare(`INSERT INTO invoices (id, company_id, partner_id, invoice_no, billing_month, supply_amount, vat_amount, total_amount)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run('i1', 'c1', 'no-such-partner', 'INV-202609-0001', '2026-09', 10000, 1000, 11000);
  }, /FOREIGN KEY/i);
  db.close();
});

test('company_id FK: 없는 company_id로 companies 외 테이블 삽입 시 실패', () => {
  const db = createDatabase(':memory:');
  assert.throws(() => {
    db.prepare(`INSERT INTO users (id, company_id, username, password_hash, salt) VALUES (?, ?, ?, ?, ?)`)
      .run('u1', 'no-company', 'admin', 'hash', 'salt');
  }, /FOREIGN KEY/i);
  db.close();
});

// ---------- T1 partners.is_active 마이그레이션 ----------
function partnerColumns(db) {
  return db.prepare('PRAGMA table_info(partners)').all().map(c => c.name);
}

test('T1: 신규 DB partners.is_active 존재 + 기본값 1', () => {
  const db = createDatabase(':memory:');
  assert.ok(partnerColumns(db).includes('is_active'), 'is_active 컬럼 누락');
  db.prepare('INSERT INTO companies (id, company_name, biz_no) VALUES (?, ?, ?)').run('c1', '한빛정밀', '123-45-67890');
  db.prepare('INSERT INTO partners (id, company_id, partner_code, partner_name) VALUES (?, ?, ?, ?)')
    .run('p1', 'c1', 'P0001', '한빛정밀');
  assert.equal(db.prepare('SELECT is_active FROM partners WHERE id = ?').get('p1').is_active, 1);
  db.close();
});

test('T1: 레거시 DB(is_active 없는 구 스키마) → applySchema가 컬럼 추가·데이터 보존·기존 행=1', () => {
  const db = openDatabase(':memory:');
  // 구 스키마 수동 재현 (is_active 없음)
  db.exec(`CREATE TABLE companies (
    id TEXT PRIMARY KEY, company_name TEXT NOT NULL, biz_no TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')));`);
  db.exec(`CREATE TABLE partners (
    id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id),
    partner_code TEXT NOT NULL, partner_name TEXT NOT NULL, biz_no TEXT,
    default_price_json TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (company_id, partner_code));`);
  db.prepare('INSERT INTO companies (id, company_name, biz_no) VALUES (?, ?, ?)').run('c1', '한빛정밀', '123-45-67890');
  db.prepare('INSERT INTO partners (id, company_id, partner_code, partner_name) VALUES (?, ?, ?, ?)')
    .run('p1', 'c1', 'P0001', '한빛정밀');

  assert.ok(!partnerColumns(db).includes('is_active'), '사전 조건: 레거시에는 is_active 없음');
  applySchema(db);

  assert.ok(partnerColumns(db).includes('is_active'), '마이그레이션 후 is_active 누락');
  const row = db.prepare('SELECT partner_name, is_active FROM partners WHERE id = ?').get('p1');
  assert.equal(row.partner_name, '한빛정밀', '기존 데이터 보존 실패');
  assert.equal(row.is_active, 1, '기존 행은 재원(1)이어야 함');
  // 나머지 핵심 테이블·인덱스도 생성됨
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name);
  for (const t of EXPECTED_TABLES) assert.ok(tables.includes(t), `테이블 누락: ${t}`);
  assert.equal(db.prepare('PRAGMA foreign_keys').get().foreign_keys, 1, 'foreign_keys 유지 실패');
  db.close();
});

test('T1: 마이그레이션 멱등 — applySchema 2회 실행해도 is_active 1개·데이터 유지', () => {
  const db = createDatabase(':memory:');
  db.prepare('INSERT INTO companies (id, company_name, biz_no) VALUES (?, ?, ?)').run('c1', '한빛정밀', '123-45-67890');
  db.prepare('INSERT INTO partners (id, company_id, partner_code, partner_name) VALUES (?, ?, ?, ?)')
    .run('p1', 'c1', 'P0001', '한빛정밀');
  applySchema(db);
  applySchema(db);
  const cols = partnerColumns(db).filter(c => c === 'is_active');
  assert.equal(cols.length, 1, 'is_active 컬럼이 중복 생성됨');
  assert.equal(db.prepare('SELECT COUNT(*) AS c FROM partners').get().c, 1, '데이터 유실');
  db.close();
});