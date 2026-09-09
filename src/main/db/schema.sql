-- SME-ERP SQLite 스키마 v1 (Phase 0 T2)
-- WBS §2.1 ERD 기반 7개 핵심 테이블 + 인덱스

CREATE TABLE IF NOT EXISTS companies (
  id            TEXT PRIMARY KEY,
  company_name  TEXT NOT NULL,
  biz_no        TEXT NOT NULL,
  ceo_name      TEXT,
  biz_type      TEXT,
  biz_item      TEXT,
  address       TEXT,
  tel           TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  company_id    TEXT NOT NULL REFERENCES companies(id),
  username      TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  salt          TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'admin',
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (company_id, username)
);

CREATE TABLE IF NOT EXISTS partners (
  id                 TEXT PRIMARY KEY,
  company_id         TEXT NOT NULL REFERENCES companies(id),
  partner_code       TEXT NOT NULL,
  partner_name       TEXT NOT NULL,
  biz_no             TEXT,
  ceo_name           TEXT,
  biz_type           TEXT,
  biz_item           TEXT,
  email              TEXT,
  tel                TEXT,
  billing_day        TEXT,
  default_price_json TEXT,
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (company_id, partner_code)
);

CREATE TABLE IF NOT EXISTS items (
  id          TEXT PRIMARY KEY,
  company_id  TEXT NOT NULL REFERENCES companies(id),
  item_name   TEXT NOT NULL,
  unit_price  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS invoices (
  id             TEXT PRIMARY KEY,
  company_id     TEXT NOT NULL REFERENCES companies(id),
  partner_id     TEXT NOT NULL REFERENCES partners(id),
  invoice_no     TEXT NOT NULL,
  billing_month  TEXT NOT NULL,
  supply_amount  INTEGER NOT NULL DEFAULT 0,
  vat_amount     INTEGER NOT NULL DEFAULT 0,
  total_amount   INTEGER NOT NULL DEFAULT 0,
  issue_date     TEXT,
  status         TEXT NOT NULL DEFAULT 'UNPAID',
  tax_doc_status TEXT NOT NULL DEFAULT 'NONE',
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (company_id, invoice_no)
);

CREATE TABLE IF NOT EXISTS payments (
  id           TEXT PRIMARY KEY,
  company_id   TEXT NOT NULL REFERENCES companies(id),
  partner_id   TEXT NOT NULL REFERENCES partners(id),
  invoice_id   TEXT REFERENCES invoices(id),
  payment_date TEXT,
  amount       INTEGER NOT NULL DEFAULT 0,
  method       TEXT,
  memo         TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id               TEXT PRIMARY KEY,
  company_id       TEXT NOT NULL REFERENCES companies(id),
  partner_id       TEXT NOT NULL REFERENCES partners(id),
  entry_date       TEXT NOT NULL,
  entry_type       TEXT NOT NULL,
  supply_amount    INTEGER NOT NULL DEFAULT 0,
  vat_amount       INTEGER NOT NULL DEFAULT 0,
  paid_amount      INTEGER NOT NULL DEFAULT 0,
  running_balance  INTEGER NOT NULL DEFAULT 0,
  ref_id           TEXT,
  memo             TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_invoices_partner_date ON invoices(partner_id, billing_month);
CREATE INDEX IF NOT EXISTS idx_ledger_partner_date ON ledger_entries(partner_id, entry_date);