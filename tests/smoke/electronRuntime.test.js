const { test } = require('node:test');
const assert = require('node:assert/strict');

test('Electron 번들 런타임에서 실행됨 (process.versions.electron 존재)', () => {
  assert.ok(process.versions.electron, 'ELECTRON_RUN_AS_NODE=1 electron으로 실행해야 합니다');
  assert.ok(process.versions.node, 'process.versions.node 부재');
});

test('Electron 번들 Node 버전 ≥ 22.13 (node:sqlite 기본 활성 조건)', () => {
  const [major, minor] = process.versions.node.split('.').map(Number);
  assert.ok(
    major > 22 || (major === 22 && minor >= 13),
    `bundled Node 버전 부족: ${process.versions.node} (≥22.13 필요)`
  );
});

test('node:sqlite DatabaseSync 로드 및 :memory: DB 생성 성공', () => {
  const { DatabaseSync } = require('node:sqlite');
  assert.equal(typeof DatabaseSync, 'function');
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE t (id INTEGER)');
  const row = db.prepare('SELECT 1 AS x').get();
  assert.equal(row.x, 1);
  db.close();
});

test('node:sqlite DatabaseSync에서 WAL PRAGMA 설정 가능 (파일 DB)', () => {
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const { DatabaseSync } = require('node:sqlite');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sme-smoke-'));
  const dbPath = path.join(dir, 'smoke.db');
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL;');
  const row = db.prepare('PRAGMA journal_mode').get();
  assert.equal(row.journal_mode, 'wal');
  db.close();
});