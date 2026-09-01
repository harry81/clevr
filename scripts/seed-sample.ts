/**
 * scripts/seed-sample.ts — WIN-C 샘플 5거래처+1고지서 시드 (F-04 10필드 MVP)
 * branches/branch-erp + clevr/scripts 동기화
 * 실행: npx tsx scripts/seed-sample.ts [--branch B1]  또는  npm run seed:sample
 * DB: %LOCALAPPDATA%\SME-ERP\data\mycompany.db WAL (JSON 호환) — OneDrive 분리, PRE_OP wal_checkpoint
 * 제약: vat=TRUNC(amt*0.1), BEGIN IMMEDIATE+busy_retry 3회, idempotent
 */
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// branch-erp localStore 재사용 (JSON) — Prisma 전환 시 prisma.partner.createMany로 교체
// eslint-disable-next-line @typescript-eslint/no-var-requires
const LocalStore = require('../db/localStore');

type Args = { companyId: string; branchCode: string; dryRun: boolean };

function parseArgs(): Args {
  const a = process.argv.slice(2);
  const get = (k: string) => {
    const i = a.indexOf(k);
    return i >= 0 ? a[i + 1] : undefined;
  };
  return {
    companyId: get('--company') || get('--companyId') || 'GENSYS',
    branchCode: get('--branch') || get('--branchCode') || 'B1',
    dryRun: a.includes('--dry-run'),
  };
}

// VAT=TRUNC(amt*0.1) — PRD F-04 한국세무코어
function vatTrunc(amt: number): number {
  return Math.trunc(amt * 0.1);
}

// 5거래처 — Partner 10필드 MVP (거래처명/사업자/대표/주소/담당자/과금/지역/연락처/메모 + 계약번호)
// 계약번호는 __-____ 포맷, 사업자번호 마스크 513-85-16780 체크
const SAMPLE_PARTNERS = [
  {
    custCode: 'WIN-0001',
    contractNo: '25-0001',
    partnerNm: '(주)대구안전산업',
    bizNo: '513-85-16780',
    ceoNm: '김대표',
    zip: '41911',
    addr1: '대구 달성군 구지로 100',
    addr2: '',
    bizType: '제조업',
    bizItem: '안전관리대행',
    tel: '053-123-4567',
    fax: '053-123-4568',
    mobile: '010-1234-5678',
    mgrNm: '김담당',
    email: 'daegu@safety.kr',
    supportType: '대행',
    regionCd: '대구',
    payMethodCd: '계좌이체',
    giroYn: 'Y',
    amt: 200000,
  },
  {
    custCode: 'WIN-0002',
    contractNo: '25-0002',
    partnerNm: '경북산업안전센터',
    bizNo: '514-12-34567',
    ceoNm: '이대표',
    zip: '41000',
    addr1: '경북 구미시 산업로 20',
    addr2: '2층',
    bizType: '서비스업',
    bizItem: '안전컨설팅',
    tel: '054-234-5678',
    fax: '054-234-5679',
    mobile: '010-2345-6789',
    mgrNm: '이담당',
    email: 'gb@safety.kr',
    supportType: '지원',
    regionCd: '구미',
    payMethodCd: '지로',
    giroYn: 'Y',
    amt: 80000,
  },
  {
    custCode: 'WIN-0003',
    contractNo: '25-0003',
    partnerNm: '대경안전컨설팅',
    bizNo: '515-98-76543',
    ceoNm: '박대표',
    zip: '41912',
    addr1: '대구 달성군 현풍면 50',
    addr2: '',
    bizType: '컨설팅',
    bizItem: '위험성평가',
    tel: '053-345-6789',
    fax: '',
    mobile: '010-3456-7890',
    mgrNm: '박담당',
    email: 'daekyeong@safety.kr',
    supportType: '대행',
    regionCd: '대구',
    payMethodCd: '계좌이체',
    giroYn: 'N',
    amt: 230000,
  },
  {
    custCode: 'WIN-0004',
    contractNo: '25-0004',
    partnerNm: '(주)한울안전',
    bizNo: '516-11-22233',
    ceoNm: '최대표',
    zip: '41100',
    addr1: '경북 경산시 진량읍 30',
    addr2: '',
    bizType: '제조업',
    bizItem: '안전교육',
    tel: '053-456-7890',
    fax: '053-456-7891',
    mobile: '010-4567-8901',
    mgrNm: '최담당',
    email: 'hanul@safety.kr',
    supportType: '지원',
    regionCd: '경산',
    payMethodCd: '지로',
    giroYn: 'Y',
    amt: 120000,
  },
  {
    custCode: 'WIN-0005',
    contractNo: '25-0005',
    partnerNm: '(주)세명산업안전',
    bizNo: '517-33-44455',
    ceoNm: '정대표',
    zip: '41911',
    addr1: '대구 달성군 구지 10',
    addr2: '1층',
    bizType: '건설업',
    bizItem: '안전관리지원',
    tel: '053-567-8901',
    fax: '053-567-8902',
    mobile: '010-5678-9012',
    mgrNm: '정담당',
    email: 'semyung@safety.kr',
    supportType: '대행',
    regionCd: '대구',
    payMethodCd: '계좌이체',
    giroYn: 'Y',
    amt: 60000,
  },
] as const;

// 1고지서 — yyyymm=2026-08, P0001 대상, 대행수수료 기반 청구 (F-05 일괄등록 결과 시뮬레이션)
const SAMPLE_INVOICE = {
  month: '2026-08',
  yyyymm: '2026-08',
  managementNo: '25-0001-202608',
  custCode: 'WIN-0001',
  contractNo: '25-0001',
  customerName: '(주)대구안전산업',
  agencyType: '대행',
  supportType: '대행',
  dueDate: '2026-09-10',
  issueDate: '2026-09-01',
  content: '2026년 08월 안전관리 대행수수료',
  amount: 200000,
  amt: 200000,
  tax: vatTrunc(200000),
  vat: vatTrunc(200000),
  total: 200000 + vatTrunc(200000),
  status: '발행',
  unpaid: false,
};

async function main() {
  const { companyId, branchCode, dryRun } = parseArgs();
  console.log(`[seed-sample] company=${companyId} branch=${branchCode} dryRun=${dryRun}`);

  // LocalStore 초기화 — %LOCALAPPDATA%\SME-ERP\data\mycompany.db (WAL)
  // main.js와 동일: app.getPath('userData') 주입 없이 LOCALAPPDATA 환경변수 분기
  const store = new LocalStore();

  // PRE_OP wal_checkpoint(TRUNCATE) — 백업/시드 전 WAL 플러시 (WBS T-00-01)
  if (typeof store.preOpCheckpoint === 'function') {
    store.preOpCheckpoint();
  } else if (typeof store.walCheckpointTruncate === 'function') {
    store.walCheckpointTruncate();
  }

  if (dryRun) {
    console.log('[dry-run] 5 partners + 1 invoice preview:');
    SAMPLE_PARTNERS.forEach((p) => {
      const vat = vatTrunc(p.amt);
      console.log(`  - ${p.custCode} ${p.partnerNm} ${p.bizNo} amt=${p.amt} vat=${vat} total=${p.amt + vat}`);
    });
    console.log(`  - invoice ${SAMPLE_INVOICE.managementNo} ${SAMPLE_INVOICE.yyyymm} -> ${SAMPLE_INVOICE.custCode} amt=${SAMPLE_INVOICE.amt} vat=${SAMPLE_INVOICE.vat}`);
    return;
  }

  // BEGIN IMMEDIATE + busy_retry 3회는 LocalStore._save() 내부에서 자동 처리 (WBS T-00-03)

  // 5거래처 — idempotent: custCode 기준 존재 시 skip, 해지 보정
  let createdCustomers = 0;
  let skippedCustomers = 0;
  const existingCustomers: any[] = store.list('customers', companyId, branchCode);
  const byCustCode = new Map(existingCustomers.map((c: any) => [c.custCode, c]));

  for (const p of SAMPLE_PARTNERS) {
    const vat = vatTrunc(p.amt);
    const total = p.amt + vat;
    const found = byCustCode.get(p.custCode);
    if (found) {
      skippedCustomers++;
      continue;
    }
    const record: any = {
      custCode: p.custCode,
      contractNo: p.contractNo,
      name: p.partnerNm,
      partnerNm: p.partnerNm,
      bizNo: p.bizNo,
      ceo: p.ceoNm,
      ceoName: p.ceoNm,
      zip: p.zip,
      addr1: p.addr1,
      addr2: p.addr2,
      bizType: p.bizType,
      bizItem: p.bizItem,
      tel: p.tel,
      fax: p.fax,
      mobile: p.mobile,
      mgrNm: p.mgrNm,
      email: p.email,
      contractType: p.supportType,
      supportType: p.supportType,
      region: p.regionCd,
      regionCd: p.regionCd,
      payMethodCd: p.payMethodCd,
      giroYn: p.giroYn,
      amount: p.amt,
      amt: p.amt,
      vat,
      tax: vat,
      total,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      terminated: false,
    };
    store.save('customers', companyId, branchCode, record);
    createdCustomers++;
  }

  // 1고지서 — managementNo 기준 중복 방지
  let createdInvoices = 0;
  const existingInvoices: any[] = store.list('invoices', companyId, branchCode);
  const byMgmt = new Set(existingInvoices.map((v: any) => v.managementNo));
  if (!byMgmt.has(SAMPLE_INVOICE.managementNo)) {
    const customersAfter = store.list('customers', companyId, branchCode);
    const target = customersAfter.find((c: any) => c.custCode === SAMPLE_INVOICE.custCode);
    if (target) {
      store.save('invoices', companyId, branchCode, {
        id: SAMPLE_INVOICE.managementNo,
        month: SAMPLE_INVOICE.yyyymm,
        yyyymm: SAMPLE_INVOICE.yyyymm,
        customerId: target.id,
        custCode: SAMPLE_INVOICE.custCode,
        contractNo: SAMPLE_INVOICE.contractNo,
        customerName: SAMPLE_INVOICE.customerName,
        agencyType: SAMPLE_INVOICE.agencyType,
        manager: target.mgrNm || '담당자',
        managementNo: SAMPLE_INVOICE.managementNo,
        dueDate: SAMPLE_INVOICE.dueDate,
        issueDate: SAMPLE_INVOICE.issueDate,
        content: SAMPLE_INVOICE.content,
        amount: SAMPLE_INVOICE.amt,
        amt: SAMPLE_INVOICE.amt,
        tax: SAMPLE_INVOICE.vat,
        vat: SAMPLE_INVOICE.vat,
        total: SAMPLE_INVOICE.total,
        status: SAMPLE_INVOICE.status,
        unpaid: SAMPLE_INVOICE.unpaid,
      });
      createdInvoices = 1;
    } else {
      console.warn('[seed-sample] target customer not found for invoice:', SAMPLE_INVOICE.custCode);
    }
  }

  console.log(`[seed-sample] done: customers created=${createdCustomers} skipped=${skippedCustomers} / invoices created=${createdInvoices}`);
  console.log(`[seed-sample] DB: ${(store as any).file}`);
}

// tsx / node 모두 지원
main().catch((e) => {
  console.error('[seed-sample] failed:', e);
  process.exit(1);
});
