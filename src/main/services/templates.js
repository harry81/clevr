const { normalizePriceTable } = require('./partnerService');

// onboardingService.BIZ_NO_RE와 동일 계약 — 순환 참조 방지를 위해 로컬 복제
const BIZ_NO_RE = /^\d{3}-\d{2}-\d{5}$/;

const TEMPLATE_ITEMS = [
  { itemName: '정밀가공', unitPrice: 50000 },
  { itemName: '밀링가공', unitPrice: 35000 },
  { itemName: '레이저절단', unitPrice: 20000 }
];

const TEMPLATE_PARTNERS = [
  {
    partnerCode: 'P0001',
    partnerName: '대양공업',
    bizNo: '111-22-33333',
    ceoName: '김대양',
    bizType: '제조업',
    bizItem: '금속가공',
    tel: '054-111-2222',
    priceTable: [
      { itemName: '정밀가공', unitPrice: 50000 },
      { itemName: '밀링가공', unitPrice: 35000 }
    ]
  },
  {
    partnerCode: 'P0002',
    partnerName: '한일금속',
    bizNo: '222-33-44444',
    ceoName: '이한일',
    bizType: '제조업',
    bizItem: '판금가공',
    tel: '054-222-3333',
    priceTable: [
      { itemName: '레이저절단', unitPrice: 20000 }
    ]
  },
  {
    partnerCode: 'P0003',
    partnerName: '태성정밀',
    bizNo: '333-44-55555',
    ceoName: '박태성',
    bizType: '제조업',
    bizItem: '정밀부품',
    tel: '054-333-4444',
    priceTable: [
      { itemName: '정밀가공', unitPrice: 55000 }
    ]
  }
];

// 시드 상수 로드 시점 검증 — 잘못된 템플릿은 조용히 주입되지 않고 즉시 실패
for (const p of TEMPLATE_PARTNERS) {
  if (!BIZ_NO_RE.test(p.bizNo)) throw new Error(`템플릿 거래처 사업자번호 형식 오류: ${p.partnerName}`);
  normalizePriceTable(p.priceTable);
  if (!p.priceTable.length) throw new Error(`템플릿 거래처 단가표 비어 있음: ${p.partnerName}`);
}
const codes = new Set(TEMPLATE_PARTNERS.map(p => p.partnerCode));
if (codes.size !== TEMPLATE_PARTNERS.length) throw new Error('템플릿 거래처 코드 중복');

module.exports = { TEMPLATE_ITEMS, TEMPLATE_PARTNERS };
