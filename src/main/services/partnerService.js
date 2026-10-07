const crypto = require('node:crypto');

const BALANCE_SQL = `
  COALESCE((SELECT SUM(i.total_amount) FROM invoices i
            WHERE i.company_id = p.company_id AND i.partner_id = p.id), 0) AS billed_amount,
  COALESCE((SELECT SUM(pm.amount) FROM payments pm
            WHERE pm.company_id = p.company_id AND pm.partner_id = p.id), 0) AS paid_amount,
  COALESCE((SELECT SUM(i.total_amount) FROM invoices i
            WHERE i.company_id = p.company_id AND i.partner_id = p.id), 0)
  - COALESCE((SELECT SUM(pm.amount) FROM payments pm
              WHERE pm.company_id = p.company_id AND pm.partner_id = p.id), 0) AS outstanding_balance
`;

// 1인 사업자/학원 친화 정책: 10자리(하이픈 포함) 실사업자번호만 중복 검사 대상.
const BIZ_NO_RE = /^\d{3}-\d{2}-\d{5}$/;

// T6: 입력 원문이 하이픈 없는 순수 10자리 숫자이고 국내 전화 대역(0으로 시작)이
// 아닐 때만 'XXX-XX-XXXXX'로 하이픈화한다. 그 외(전화·구분자 포함·임의 식별자·빈값)는
// 원문을 그대로 보존한다(빈값은 null). 예: '02-1234-5678' → 원문 유지.
function normalizeBizNo(value) {
  const s = String(value ?? '').trim();
  if (!s) return null;
  if (!/^\d{10}$/.test(s) || /^0/.test(s)) return s;
  return `${s.slice(0, 3)}-${s.slice(3, 5)}-${s.slice(5)}`;
}

function normalizePriceTable(priceTable) {
  if (priceTable === null || priceTable === undefined) return [];
  if (!Array.isArray(priceTable)) throw new Error('품목단가표는 배열이어야 합니다');
  return priceTable.map((item, idx) => {
    if (!item || typeof item !== 'object' || !item.itemName) {
      throw new Error(`품목단가표 ${idx + 1}번째 항목: 품목명(itemName)이 필요합니다`);
    }
    if (typeof item.unitPrice !== 'number' || !Number.isInteger(item.unitPrice) || item.unitPrice < 0) {
      throw new Error(`품목단가표 ${idx + 1}번째 항목(${item.itemName}): 단가(unitPrice)는 0 이상 정수여야 합니다`);
    }
    return { itemName: item.itemName, unitPrice: item.unitPrice };
  });
}

function createPartnerService(db) {
  function toPartner(row) {
    if (!row) return null;
    return {
      id: row.id,
      companyId: row.company_id,
      partnerCode: row.partner_code,
      partnerName: row.partner_name,
      bizNo: row.biz_no,
      ceoName: row.ceo_name,
      bizType: row.biz_type,
      bizItem: row.biz_item,
      email: row.email,
      tel: row.tel,
      billingDay: row.billing_day,
      priceTable: row.default_price_json ? JSON.parse(row.default_price_json) : [],
      isActive: row.is_active === 0 ? false : true,
      createdAt: row.created_at,
      billedAmount: row.billed_amount ?? 0,
      paidAmount: row.paid_amount ?? 0,
      outstandingBalance: row.outstanding_balance ?? 0
    };
  }

  const BASE_SELECT = `SELECT p.*, ${BALANCE_SQL} FROM partners p`;

  function findDuplicateBizNo(companyId, bizNo, excludeId) {
    if (!bizNo || !BIZ_NO_RE.test(bizNo)) return false;
    if (excludeId) {
      return db.prepare('SELECT 1 FROM partners WHERE company_id = ? AND biz_no = ? AND id != ? LIMIT 1').get(companyId, bizNo, excludeId) != null;
    }
    return db.prepare('SELECT 1 FROM partners WHERE company_id = ? AND biz_no = ? LIMIT 1').get(companyId, bizNo) != null;
  }

  function nextPartnerCode(companyId) {
    const rows = db.prepare('SELECT partner_code FROM partners WHERE company_id = ?').all(companyId);
    let max = 0;
    for (const r of rows) {
      const m = /^P(\d+)$/.exec(r.partner_code);
      if (m) max = Math.max(max, Number(m[1]));
    }
    return 'P' + String(max + 1).padStart(4, '0');
  }

  function getPartner(companyId, partnerId) {
    const row = db.prepare(`${BASE_SELECT} WHERE p.id = ? AND p.company_id = ?`).get(partnerId, companyId);
    return toPartner(row);
  }

  function statusClause(status) {
    if (status === 'active') return ' AND p.is_active = 1';
    if (status === 'inactive') return ' AND p.is_active = 0';
    if (status === 'all') return '';
    throw new Error('상태 필터는 active/inactive/all 중 하나여야 합니다');
  }

  function listPartners(companyId, keyword = '', options = {}) {
    const statusSql = statusClause((options && options.status) || 'active');
    if (keyword) {
      const pattern = `%${keyword}%`;
      const rows = db.prepare(
        `${BASE_SELECT} WHERE p.company_id = ? AND (p.partner_name LIKE ? OR p.biz_no LIKE ?)${statusSql}
         ORDER BY p.partner_name ASC, p.created_at ASC`
      ).all(companyId, pattern, pattern);
      return rows.map(toPartner);
    }
    const rows = db.prepare(
      `${BASE_SELECT} WHERE p.company_id = ?${statusSql} ORDER BY p.partner_name ASC, p.created_at ASC`
    ).all(companyId);
    return rows.map(toPartner);
  }

  function setActive(companyId, partnerId, isActive) {
    if (typeof isActive !== 'boolean') throw new Error('isActive는 true/false여야 합니다');
    const result = db.prepare('UPDATE partners SET is_active = ? WHERE id = ? AND company_id = ?')
      .run(isActive ? 1 : 0, partnerId, companyId);
    if (result.changes === 0) throw new Error('거래처를 찾을 수 없습니다');
    return getPartner(companyId, partnerId);
  }

  function savePartner(companyId, partner) {
    if (!companyId) throw new Error('companyId가 필요합니다');
    if (!partner || typeof partner !== 'object') throw new Error('partner 데이터가 필요합니다');
    if (!partner.partnerName) throw new Error('거래처명(partnerName)이 필요합니다');
    const priceTable = normalizePriceTable(partner.priceTable);
    const bizNo = normalizeBizNo(partner.bizNo);

    if (partner.id) {
      if (findDuplicateBizNo(companyId, bizNo, partner.id)) {
        throw new Error('동일 회사에 이미 등록된 사업자등록번호입니다');
      }
      const result = db.prepare(
        `UPDATE partners SET partner_name = ?, biz_no = ?, ceo_name = ?, biz_type = ?, biz_item = ?,
           email = ?, tel = ?, billing_day = ?, default_price_json = ?
         WHERE id = ? AND company_id = ?`
      ).run(
        partner.partnerName, bizNo, partner.ceoName || null, partner.bizType || null, partner.bizItem || null,
        partner.email || null, partner.tel || null, partner.billingDay || null, JSON.stringify(priceTable),
        partner.id, companyId
      );
      if (result.changes === 0) throw new Error('거래처를 찾을 수 없습니다');
      return getPartner(companyId, partner.id);
    }

    if (findDuplicateBizNo(companyId, bizNo)) {
      throw new Error('동일 회사에 이미 등록된 사업자등록번호입니다');
    }
    const id = crypto.randomUUID();
    const partnerCode = partner.partnerCode || nextPartnerCode(companyId);
    db.prepare(
      `INSERT INTO partners (id, company_id, partner_code, partner_name, biz_no, ceo_name, biz_type, biz_item, email, tel, billing_day, default_price_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id, companyId, partnerCode, partner.partnerName, bizNo,
      partner.ceoName || null, partner.bizType || null, partner.bizItem || null,
      partner.email || null, partner.tel || null, partner.billingDay || null, JSON.stringify(priceTable)
    );
    return getPartner(companyId, id);
  }

  // T09 Magic Import — 행 목록을 일괄 등록. 중복 bizNo는 skip(upsert 아님), 행별 오류는 errors로 수집.
  function savePartnersBulk(companyId, rows) {
    if (!companyId) throw new Error('companyId가 필요합니다');
    if (!Array.isArray(rows)) throw new Error('rows는 배열이어야 합니다');
    const created = [];
    const skipped = [];
    const errors = [];
    db.exec('BEGIN IMMEDIATE');
    try {
      const insert = db.prepare(
        `INSERT INTO partners (id, company_id, partner_code, partner_name, biz_no, ceo_name, biz_type, biz_item, email, tel, billing_day, default_price_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const row of rows) {
        try {
          if (!row || typeof row !== 'object' || !row.partnerName) {
            throw new Error('거래처명(partnerName)이 필요합니다');
          }
          const priceTable = normalizePriceTable(row.priceTable || []);
          const bizNo = normalizeBizNo(row.bizNo);
          if (findDuplicateBizNo(companyId, bizNo)) { skipped.push(row.partnerName); continue; }
          const id = crypto.randomUUID();
          const partnerCode = row.partnerCode || nextPartnerCode(companyId);
          insert.run(
            id, companyId, partnerCode, row.partnerName, bizNo,
            row.ceoName || null, row.bizType || null, row.bizItem || null,
            row.email || null, row.tel || null, row.billingDay || null, JSON.stringify(priceTable)
          );
          created.push(row.partnerName);
        } catch (err) {
          errors.push({ partnerName: row && row.partnerName ? row.partnerName : null, message: err.message });
        }
      }
      db.exec('COMMIT');
    } catch (err) {
      try { db.exec('ROLLBACK'); } catch {}
      throw err;
    }
    return { created: created.length, skipped: skipped.length, errors };
  }

  const HISTORY_DELETE_MSG = '청구·입금 기록이 있는 거래처는 삭제할 수 없습니다. 대신 [퇴원 처리]를 하면 다음 달 청구에서 제외됩니다.';

  function hasHistory(companyId, partnerId) {
    for (const table of ['invoices', 'payments', 'ledger_entries']) {
      const row = db.prepare(`SELECT 1 FROM ${table} WHERE company_id = ? AND partner_id = ? LIMIT 1`).get(companyId, partnerId);
      if (row) return true;
    }
    return false;
  }

  function deletePartner(companyId, partnerId) {
    if (hasHistory(companyId, partnerId)) throw new Error(HISTORY_DELETE_MSG);
    try {
      const result = db.prepare('DELETE FROM partners WHERE id = ? AND company_id = ?').run(partnerId, companyId);
      return { ok: result.changes > 0 };
    } catch (err) {
      if (/FOREIGN KEY|constraint/i.test(err.message || '')) throw new Error(HISTORY_DELETE_MSG);
      throw err;
    }
  }

  return { getPartner, listPartners, savePartner, savePartnersBulk, setActive, deletePartner };
}

module.exports = { createPartnerService, normalizePriceTable, normalizeBizNo };