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
      createdAt: row.created_at,
      billedAmount: row.billed_amount ?? 0,
      paidAmount: row.paid_amount ?? 0,
      outstandingBalance: row.outstanding_balance ?? 0
    };
  }

  const BASE_SELECT = `SELECT p.*, ${BALANCE_SQL} FROM partners p`;

  function findDuplicateBizNo(companyId, bizNo, excludeId) {
    if (!bizNo) return false;
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

  function listPartners(companyId, keyword = '') {
    if (keyword) {
      const pattern = `%${keyword}%`;
      const rows = db.prepare(
        `${BASE_SELECT} WHERE p.company_id = ? AND (p.partner_name LIKE ? OR p.biz_no LIKE ?)
         ORDER BY p.partner_name ASC, p.created_at ASC`
      ).all(companyId, pattern, pattern);
      return rows.map(toPartner);
    }
    const rows = db.prepare(`${BASE_SELECT} WHERE p.company_id = ? ORDER BY p.partner_name ASC, p.created_at ASC`).all(companyId);
    return rows.map(toPartner);
  }

  function savePartner(companyId, partner) {
    if (!companyId) throw new Error('companyId가 필요합니다');
    if (!partner || typeof partner !== 'object') throw new Error('partner 데이터가 필요합니다');
    if (!partner.partnerName) throw new Error('거래처명(partnerName)이 필요합니다');
    const priceTable = normalizePriceTable(partner.priceTable);
    const bizNo = partner.bizNo || null;

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

  function deletePartner(companyId, partnerId) {
    const result = db.prepare('DELETE FROM partners WHERE id = ? AND company_id = ?').run(partnerId, companyId);
    return { ok: result.changes > 0 };
  }

  return { getPartner, listPartners, savePartner, deletePartner };
}

module.exports = { createPartnerService, normalizePriceTable };