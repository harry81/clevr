const crypto = require('node:crypto');
const { hashPassword } = require('../../shared/security/hasher');

const BIZ_NO_RE = /^\d{3}-\d{2}-\d{5}$/;

function isOnboardingNeeded(db) {
  const row = db.prepare('SELECT COUNT(*) AS c FROM companies').get();
  return row.c === 0;
}

function validateOnboardingData(data) {
  if (!data || typeof data !== 'object') throw new Error('company data required');
  const { company, admin } = data;
  if (!company || typeof company !== 'object') throw new Error('company 정보가 필요합니다');
  if (!company.companyName) throw new Error('회사명이 필요합니다');
  if (!company.bizNo) throw new Error('사업자등록번호가 필요합니다');
  if (!BIZ_NO_RE.test(company.bizNo)) {
    throw new Error('사업자등록번호 형식이 올바르지 않습니다 (예: 123-45-67890)');
  }
  if (!admin || typeof admin !== 'object') throw new Error('관리자 계정 정보가 필요합니다');
  if (!admin.username) throw new Error('관리자 아이디가 필요합니다');
  if (!admin.password) throw new Error('관리자 비밀번호가 필요합니다');
}

function validateItem(item) {
  if (!item || typeof item !== 'object' || !item.itemName) {
    throw new Error('품목명이 필요합니다');
  }
  if (typeof item.unitPrice !== 'number' || !Number.isFinite(item.unitPrice) || item.unitPrice < 0) {
    throw new Error('품목 단가(unitPrice)는 0 이상의 숫자여야 합니다');
  }
}

function completeOnboarding(db, data) {
  validateOnboardingData(data);
  const { company, admin, items = [] } = data;
  const companyId = crypto.randomUUID();
  const userId = crypto.randomUUID();
  const { hash, salt } = hashPassword(admin.password);

  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(`INSERT INTO companies (id, company_name, biz_no, ceo_name, biz_type, biz_item, address, tel)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(companyId, company.companyName, company.bizNo, company.ceoName || null,
        company.bizType || null, company.bizItem || null, company.address || null, company.tel || null);

    db.prepare(`INSERT INTO users (id, company_id, username, password_hash, salt, role)
                VALUES (?, ?, ?, ?, ?, ?)`)
      .run(userId, companyId, admin.username, hash, salt, 'admin');

    const insertItem = db.prepare(`INSERT INTO items (id, company_id, item_name, unit_price)
                                   VALUES (?, ?, ?, ?)`);
    for (const item of items) {
      validateItem(item);
      insertItem.run(crypto.randomUUID(), companyId, item.itemName, item.unitPrice);
    }

    db.exec('COMMIT');
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch {}
    throw err;
  }

  return { companyId, userId, onboardingComplete: true };
}

module.exports = { isOnboardingNeeded, completeOnboarding, BIZ_NO_RE };