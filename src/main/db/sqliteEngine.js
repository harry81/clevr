const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');

const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

function ensureDataDir(dbPath) {
  if (dbPath === ':memory:') return;
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function openDatabase(dbPath = ':memory:') {
  ensureDataDir(dbPath);
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA synchronous = NORMAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  return db;
}

function applySchema(db) {
  const sql = fs.readFileSync(SCHEMA_PATH, 'utf-8');
  db.exec(sql);
  return db;
}

function createDatabase(dbPath = ':memory:') {
  const db = openDatabase(dbPath);
  applySchema(db);
  return db;
}

function walCheckpointTruncate(db) {
  try {
    const row = db.prepare('PRAGMA wal_checkpoint(TRUNCATE)').get();
    const busy = row && Object.values(row)[0];
    return { ok: busy === 0, busy, row };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

module.exports = { createDatabase, openDatabase, applySchema, walCheckpointTruncate, SCHEMA_PATH };