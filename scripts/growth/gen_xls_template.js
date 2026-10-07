'use strict';
// scripts/growth/gen_xls_template.js — 트로이목마 엑셀 템플릿 생성기 (외부 의존성 0: node:fs, node:path)
// CSV + UTF-8 BOM 우선. `--xls` 시 SpreadsheetML 2003 XML(.xls) 워크북도 생성. `--check` 시 BOM·시드 검증.
const fs = require('node:fs');
const path = require('node:path');

const RELEASES_URL = 'https://github.com/harry81/clevr/releases/latest';
const BAD_DOMAIN = ['sme', 'erp'].join('-') + '.org'; // 미소유 도메인 배제 검증용
const TEMPLATE_DIR = path.join(__dirname, '..', '..', 'assets', 'growth', 'templates');
const NOTICE = `무료·회원가입 없음·평생 무료 · 무료 다운로드: ${RELEASES_URL}`;

// 온보딩 시드와 동일한 거래처 3곳 (src/main/services/templates.js 와 정합)
const SHEETS = [
  {
    name: '01_거래처',
    headers: ['partnerCode', 'partnerName', 'bizNo', 'ceoName', 'bizType', 'bizItem', 'tel', 'notice'],
    rows: [
      ['P0001', '대양공업', '111-22-33333', '김대양', '제조업', '금속가공', '054-111-2222', NOTICE],
      ['P0002', '한일금속', '222-33-44444', '이한일', '제조업', '판금가공', '054-222-3333', NOTICE],
      ['P0003', '태성정밀', '333-44-55555', '박태성', '제조업', '정밀부품', '054-333-4444', NOTICE],
    ],
  },
  {
    name: '02_단가표',
    headers: ['partnerCode', 'partnerName', 'itemName', 'unitPrice'],
    rows: [
      ['P0001', '대양공업', '정밀가공', 50000],
      ['P0001', '대양공업', '밀링가공', 35000],
      ['P0002', '한일금속', '레이저절단', 20000],
      ['P0003', '태성정밀', '정밀가공', 55000],
    ],
  },
  {
    name: '03_청구서',
    headers: ['invoiceNo', 'issueDate', 'partnerCode', 'partnerName', 'itemName', 'quantity', 'unitPrice', 'supplyAmount', 'vatAmount', 'totalAmount', 'status'],
    // supplyAmount = unitPrice * quantity, vatAmount = supplyAmount * 0.1, totalAmount = supply + vat
    rows: [
      ['INV-202609-0001', '2026-09-30', 'P0001', '대양공업', '정밀가공', 1, 50000, 50000, 5000, 55000, '청구'],
      ['INV-202609-0002', '2026-09-30', 'P0002', '한일금속', '레이저절단', 2, 20000, 40000, 4000, 44000, '청구'],
      ['INV-202609-0003', '2026-09-30', 'P0003', '태성정밀', '정밀가공', 1, 55000, 55000, 5500, 60500, '청구'],
    ],
  },
  {
    name: '04_미수금',
    headers: ['date', 'partnerCode', 'partnerName', 'type', 'amount', 'runningBalance', 'memo'],
    rows: [
      ['2026-09-30', 'P0001', '대양공업', '청구', 55000, 55000, 'INV-202609-0001'],
      ['2026-10-05', 'P0001', '대양공업', '입금', 30000, 25000, '계좌이체'],
      ['2026-09-30', 'P0002', '한일금속', '청구', 44000, 44000, 'INV-202609-0002'],
      ['2026-09-30', 'P0003', '태성정밀', '청구', 60500, 60500, 'INV-202609-0003'],
    ],
  },
];

const BOM = '\ufeff';

function csvCell(v) {
  const s = String(v ?? '');
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(sheet) {
  const lines = [sheet.headers, ...sheet.rows].map((r) => r.map(csvCell).join(','));
  return BOM + lines.join('\r\n') + '\r\n';
}

function xmlEsc(s) {
  return String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
}

function toSpreadsheetXml() {
  const cell = (v) => `<Cell><Data ss:Type="${typeof v === 'number' ? 'Number' : 'String'}">${xmlEsc(v)}</Data></Cell>`;
  const sheets = SHEETS.map((s) => ` <Worksheet ss:Name="${xmlEsc(s.name)}"><Table>` +
    [s.headers, ...s.rows].map((r) => `  <Row>${r.map(cell).join('')}</Row>`).join('') +
    `</Table></Worksheet>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<?mso-application progid="Excel.Sheet"?>\n` +
    `<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" ` +
    `xmlns:o="urn:schemas-microsoft-com:office:office" ` +
    `xmlns:x="urn:schemas-microsoft-com:office:excel" ` +
    `xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n${sheets}\n</Workbook>\n`;
}

function writeTemplates(dir, { xls = false } = {}) {
  fs.mkdirSync(dir, { recursive: true });
  const written = [];
  for (const sheet of SHEETS) {
    const file = path.join(dir, `${sheet.name}.csv`);
    fs.writeFileSync(file, toCsv(sheet), 'utf8');
    written.push(file);
  }
  if (xls) {
    const file = path.join(dir, 'SME-ERP_거래처관리.xls');
    fs.writeFileSync(file, toSpreadsheetXml(), 'utf8');
    written.push(file);
  }
  return written;
}

// --check: 생성물이 BOM·시드 3곳·헤더를 만족하는지 검증 (실패 시 exit 1)
function check(dir) {
  const seed = ['대양공업', '한일금속', '태성정밀'];
  const sheet1 = path.join(dir, '01_거래처.csv');
  const raw = fs.readFileSync(sheet1, 'utf8');
  const errors = [];
  if (raw[0] !== BOM) errors.push('01_거래처.csv UTF-8 BOM 누락');
  const body = raw.slice(1);
  if (!body.startsWith('partnerCode,')) errors.push('헤더 불일치');
  for (const name of seed) if (!body.includes(name)) errors.push(`시드 거래처 누락: ${name}`);
  if (body.includes(BAD_DOMAIN)) errors.push('금지 도메인 잔존');
  for (const sheet of SHEETS) {
    if (!fs.existsSync(path.join(dir, `${sheet.name}.csv`))) errors.push(`파일 누락: ${sheet.name}.csv`);
  }
  return errors;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const dirIdx = args.indexOf('--out');
  const dir = dirIdx !== -1 ? args[dirIdx + 1] : TEMPLATE_DIR;
  if (args.includes('--check')) {
    const errors = check(dir);
    if (errors.length) { console.error('[FAIL] ' + errors.join('; ')); process.exit(1); }
    console.log(`[OK] 템플릿 검증 통과 (${dir})`);
  } else {
    const files = writeTemplates(dir, { xls: args.includes('--xls') });
    console.log(`[OK] 템플릿 ${files.length}개 생성 (${dir})`);
  }
}

module.exports = { SHEETS, toCsv, toSpreadsheetXml, writeTemplates, check };
