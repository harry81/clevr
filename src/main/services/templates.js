const { normalizePriceTable } = require('./partnerService');

// onboardingService.BIZ_NO_RE와 동일 계약 — 순환 참조 방지를 위해 로컬 복제
const BIZ_NO_RE = /^\d{3}-\d{2}-\d{5}$/;

const TEMPLATE_ITEMS = [
  { itemName: '수강료', unitPrice: 300000 },
  { itemName: '교재비', unitPrice: 30000 },
  { itemName: '기타회비', unitPrice: 20000 }
];

const TEMPLATE_PARTNERS = [
  {
    partnerCode: 'P0001',
    partnerName: '김민수',
    bizNo: null,
    ceoName: '김민수',
    bizType: '교육',
    bizItem: '수강',
    tel: '010-1111-2222',
    priceTable: [
      { itemName: '수강료', unitPrice: 300000 },
      { itemName: '교재비', unitPrice: 30000 }
    ]
  },
  {
    partnerCode: 'P0002',
    partnerName: '박서연',
    bizNo: null,
    ceoName: '박서연',
    bizType: '교육',
    bizItem: '수강',
    tel: '010-2222-3333',
    priceTable: [
      { itemName: '수강료', unitPrice: 250000 }
    ]
  },
  {
    partnerCode: 'P0003',
    partnerName: '이준호',
    bizNo: null,
    ceoName: '이준호',
    bizType: '교육',
    bizItem: '수강',
    tel: '010-3333-4444',
    priceTable: [
      { itemName: '수강료', unitPrice: 300000 },
      { itemName: '기타회비', unitPrice: 20000 }
    ]
  }
];

// 시드 상수 로드 시점 검증 — 잘못된 템플릿은 조용히 주입되지 않고 즉시 실패
// 학원생은 bizNo가 선택이므로, 값이 있을 때만 형식을 검사한다.
for (const p of TEMPLATE_PARTNERS) {
  if (p.bizNo && !BIZ_NO_RE.test(p.bizNo)) throw new Error(`템플릿 거래처 사업자번호 형식 오류: ${p.partnerName}`);
  normalizePriceTable(p.priceTable);
  if (!p.priceTable.length) throw new Error(`템플릿 거래처 단가표 비어 있음: ${p.partnerName}`);
}
const codes = new Set(TEMPLATE_PARTNERS.map(p => p.partnerCode));
if (codes.size !== TEMPLATE_PARTNERS.length) throw new Error('템플릿 거래처 코드 중복');

module.exports = { TEMPLATE_ITEMS, TEMPLATE_PARTNERS };
