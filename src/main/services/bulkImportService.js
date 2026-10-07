const { createPartnerService } = require('./partnerService');

// T09 Magic Import — 클립보드 TSV/CSV 텍스트를 거래처 행으로 파싱하고 일괄 저장한다.
// 기본 컬럼 순서: 거래처명, 사업자번호, 대표자, 연락처, 품목명, 단가.
// 첫 행에 헤더 키워드(상호/거래처/사업자)가 있으면 헤더로 보고 건너뛴다(없으면 위치 기반).
const HEADER_KEYWORDS = ['상호', '거래처', '사업자'];

function detectDelimiter(line) {
  return line.includes('\t') ? '\t' : ',';
}

function cellAt(cells, idx) {
  return cells[idx] === undefined || cells[idx] === null ? '' : String(cells[idx]).trim();
}

function isHeaderRow(line) {
  const cells = line.split(detectDelimiter(line)).map((s) => s.trim());
  return cells.some((c) => HEADER_KEYWORDS.some((k) => c.includes(k)));
}

function normalizeBizNo(value) {
  const s = String(value ?? '').trim();
  if (!s) return null;
  const d = s.replace(/\D/g, '');
  return d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}` : s;
}

function parseUnitPrice(value) {
  const digits = String(value ?? '').replace(/[^0-9]/g, '');
  return digits ? Number(digits) : null;
}

// 순수 파서: { rows: 거래처[], errors: [{line, message}] }
function parsePartnersText(text) {
  const lines = String(text ?? '').replace(/\r\n?/g, '\n').split('\n');
  const entries = [];
  lines.forEach((raw, i) => {
    if (raw.trim() !== '') entries.push({ line: i + 1, raw });
  });
  if (!entries.length) return { rows: [], errors: [] };

  const start = isHeaderRow(entries[0].raw) ? 1 : 0;
  const errors = [];
  const parsed = [];

  for (let i = start; i < entries.length; i++) {
    const { line, raw } = entries[i];
    const cells = raw.split(detectDelimiter(raw)).map((s) => s.trim());
    const partnerName = cellAt(cells, 0);
    if (!partnerName) {
      errors.push({ line, message: '거래처명이 없습니다' });
      continue;
    }
    const row = {
      partnerName,
      bizNo: normalizeBizNo(cellAt(cells, 1)),
      ceoName: cellAt(cells, 2) || null,
      tel: cellAt(cells, 3) || null,
      priceTable: [],
    };
    const itemName = cellAt(cells, 4);
    if (itemName) {
      const unitPrice = parseUnitPrice(cellAt(cells, 5));
      if (unitPrice === null) {
        errors.push({ line, message: `${itemName}: 단가가 올바르지 않습니다` });
        continue;
      }
      row.priceTable.push({ itemName, unitPrice });
    }
    parsed.push(row);
  }

  // 동일 거래처(bizNo 우선, 없으면 상호) 복수행 → 단가표 그룹핑
  const groups = new Map();
  for (const row of parsed) {
    const key = row.bizNo || row.partnerName;
    const group = groups.get(key) || { partnerName: row.partnerName, bizNo: row.bizNo, ceoName: null, tel: null, priceTable: [] };
    group.ceoName = group.ceoName || row.ceoName;
    group.tel = group.tel || row.tel;
    for (const item of row.priceTable) {
      const found = group.priceTable.find((it) => it.itemName === item.itemName);
      if (found) found.unitPrice = item.unitPrice;
      else group.priceTable.push(item);
    }
    groups.set(key, group);
  }

  return { rows: [...groups.values()], errors };
}

function createBulkImportService(db) {
  const partners = createPartnerService(db);
  return {
    parseText: parsePartnersText,
    saveBulk: (companyId, rows) => partners.savePartnersBulk(companyId, rows),
  };
}

module.exports = { parsePartnersText, createBulkImportService };
