# SME-ERP 페르소나 확장 분석 (Fit / Gap)

> **문서 성격**: 10인 이하 제조업 특화 SME-ERP 코어를 **다른 1인 자영업 페르소나(1인 학원·교습소, 1인 미장원)**로 확장할 때의 적합도(Fit)와 결핍(Gap)을 코드 근거로 검증한 분석 리포트.
> **비교 대상**: 기존 제조업(코어) · 1인 학원·교습소 · 1인 미장원.
> **작성 톤**: 확장성 판단용. 확정 수치가 아닌 **코드 구조 기반 판정**이며, 미검증 항목은 각주/가정으로 분리한다.

---

## 1. 서론

SME-ERP는 “10인 이하 제조업 사장님”을 1차 타겟으로 설계되었다. 코어 데이터 모델은 **거래처(partner) – 품목/단가표 – 월 일괄 청구서 – 입금/미수(FIFO) – 거래처 원장**의 B2B 반복거래 구조다.[^wbs][^invoice]

본 문서는 이 코어가 **월 정기 청구**라는 공통점을 가진 인접 자영업(1인 학원·교습소)과, **방문별 건별 결제**라는 상이한 구조를 가진 1인 미장원에 각각 얼마나 맞는지 판정한다. 목적은 두 가지다.

1. 코어를 재사용해 확장 가능한 **1순위 페르소나**를 식별한다.
2. 확장 시 반드시 필요한 **최소 추가 작업(T14~)**을 도출해 범위를 통제한다.

---

## 2. 방법론

- **근거 수집**: 저장소의 실제 소스/문서만 사용했다 — `README.md`, `docs/AHA_MOMENTS_SPEC.md`, `docs/GROWTH_EXECUTION_SPEC.md`, `docs/SME_ERP_WBS_v1.md`, `renderer/js/views/*.js`, `src/main/services/*.js`, `src/main/db/schema.sql`, `src/shared/money.js`.
- **검증 방식**: Fit/Gap의 각 “근거”는 파일 경로 + 함수/컬럼명으로 확인하고 각주로 표기한다. 코드에서 확인되지 않거나 외부 사실(세무·시장)인 항목은 **[가정]**으로 명시한다.
- **판정 기준**:
  - **높음**: 코어 구조 변경 없이(또는 명칭 치환 수준) 그대로 정합.
  - **중간**: 개념은 대응되나 필드/관계 보강 필요.
  - **낮음**: 코어 흐름과 근본적으로 다름(별도 모듈 필요).
- **용어**: “청구”는 코어의 월 `invoices` 발행, “원장”은 `ledger_entries` 타임라인을 뜻한다.

---

## 3. Fit 표 (기능 | 미장원 | 학원 | 근거)

| 기능 | 미장원 | 학원 | 근거 |
|:---|:---:|:---:|:---|
| 온보딩 3단계+표준 템플릿 | 낮음 | 중간 | 온보딩 3단계·표준 단가표 체크박스가 **제조업 3곳/대표 품목** 고정이라 두 업종은 수동 입력이 필요(단, T09로 완화)[^onboarding][^templates][^bulk] |
| 고객/거래처 마스터 | 중간 | 중간 | `partners`(상호/사업자번호/대표자/연락처)로 “고객”을 대체할 수 있으나, 학생/학부모·방문고객 관계 모델은 없음[^schema][^partner] |
| 품목+단가표 | 높음 | 높음 | 품목명(`itemName`)+단가(`unitPrice`) 자유 입력 구조라 시술 메뉴/수강료·교재비 표현 가능[^price] |
| 월 일괄 청구 | 낮음 | 높음 | `createInvoiceBatch`가 `billingMonth` 기준 월 1회 발행 = 학원 정합, 미장원의 방문별 결제와 부정합[^invoice] |
| 부가세 자동(10% 절사) | 낮음 | 중간 | 코어는 부가세 10% 절사 고정(`Math.trunc(supply*0.1)`) — 미장원 대개 면세, 교습소/학원 과세·면세 혼재[^vat][^taxassume] |
| 엑셀 복붙 T09 | 높음 | 높음 | 기존 고객/수강생 명단을 TSV/CSV로 일괄 등록하는 데 최적[^bulk] |
| FIFO 입금·미수 | 중간 | 높음 | 학원 월 수강료 미납 추적에 정합(FIFO 충당·미수잔액), 미장원은 다건 입금 추적 정도[^fifo] |
| 카톡 원장 이미지 T11 | 높음 | 높음 | 영수증/미수 안내·학부모 월 안내에 재사용 가능(현재는 1건 수동 복사)[^kakao] |
| 로컬/무료/오프라인 | 높음 | 높음 | 100% 로컬 저장·MIT·서버 없음 → 학부모/고객 개인정보 로컬 보관이 신뢰 요소[^local] |
| A4 인쇄 PDF | 낮음 | 높음 | 월 청구서/원장 A4 PDF 발행은 학원에 적합, 미장원은 건별 영수증 수요라 부정합[^a4] |

---

## 4. Gap 표 (페르소나 | 항목 | 심각도 | 이유 | 보완)

| 페르소나 | 항목 | 심각도 | 이유 | 보완 |
|:---|:---|:---:|:---|:---|
| 학원 | 중도 입·퇴원 일할 계산 | 치명 | 청구액이 단가표 합계(=월 고정)라 15일 등록도 한 달치 청구됨[^invoice] | **T14** 청구 기간비례(일수/총일수) |
| 학원 | 형제 할인·장학/조정 | 치명 | 할인·조정 필드가 스키마에 없어 금액 왜곡[^schema] | **T15** 청구 전 조정(−)라인 |
| 학원 | 교재비 등 변동 부가항목 | 높음 | 매 청구가 단가표 전 행 합산 고정 → 매월 편집 필요[^invoice] | **T16** 항목 선택형 청구(체크+메모) |
| 학원 | 학부모 카톡 일괄 안내 | 높음 | T11은 선택 거래처 1건 이미지 수동 복사만 지원[^kakao] | **T17** 안내문 템플릿+순차 복사 |
| 학원 | 학생/학부모/반·과세유형 | 중간 | `partners`에 학년·보호자·과세유형 필드 없음[^schema] | 필드 확장(후순위) |
| 미장원 | 방문별(건별) 매출·POS | 치명 | 월 청구 모델이라 일/건별 매출 기록 불가(매출 테이블 없음)[^schema][^invoice] | 건별 판매 레코드 신설(**T18**) |
| 미장원 | 예약·시술 이력·단골 CRM | 치명 | 예약/이력/CRM 모듈·테이블 전무[^schema] | 예약/이력 모듈(범위 밖) |
| 미장원 | 현금/카드/이체 수단별 집계 | 높음 | `payments.method`는 저장만 하고 수단별 리포트 없음[^dashboard][^fifo] | 결제수단별 월 집계 |
| 미장원 | 영수증 출력 | 중간 | A4 원장만 존재, 건별 영수증 양식 없음[^a4] | T11 이미지 재사용 영수증 |
| 미장원 | 고객 재방문 알림 | 중간 | 마케팅/리마인드 기능 없음[^schema] | 후순위(범위 밖) |

---

## 5. 3자 비교

| 페르소나 | 적합도 | 핵심 정합/불일치 |
|:---|:---:|:---|
| 기존 제조업 (코어) | **높음** | 청구·미수·거래처·단가표·원장 구조가 타겟과 정확히 동형[^wbs][^invoice] |
| 1인 학원·교습소 | **중간~높음** | 월 정기 청구형이라 부분 정합. 일할·할인·변동항목 결핍[^invoice][^schema] |
| 1인 미장원 | **낮음** | 월 청구·B2B 원장 중심이라 건별 매출/예약·POS와 근본 불일치[^schema][^invoice] |

---

## 6. 종합 판정

- **제조업 = 적합.** 코어가 목적에 정확히 부합한다.
- **학원 = 부분 적합(보완 시 적합).** 월 수강료 청구·미납 미수·학부모 안내가 코어와 동형이며, 일할(T14)·할인(T15)·변동항목(T16)·일괄 안내(T17)를 보강하면 실사용 가능하다.
- **미장원 = 부적합.** 방문별 건별 매출/POS/예약이 필요해 **별도 제품 축**이다.
- **1순위 확장 타겟 = 1인 학원·교습소.** 월 수강료 청구 + 미납 관리 + 학부모 카톡이 코어와 동형이고, B2B 원장은 오히려 불필요하다(원장은 미납 추적으로 재해석 가능).[^invoice][^fifo][^kakao]

---

## 7. 최소 확장 제안 (T14~)

| 순서 | Task | 내용 | 심각도/근거 |
|:--:|:---|:---|:---|
| 1 | **T14** | 청구 기간비례(일할) 정산 — 일수/총일수 비율 | 치명[^invoice] |
| 2 | **T15** | 할인/조정(−) 라인 | 치명[^schema] |
| 3 | **T16** | 항목 선택형 청구(교재비 등 체크+메모) | 높음[^invoice] |
| 4 | **T17** | 학부모 안내문 템플릿 + 순차 복사(T11 재사용) | 높음[^kakao] |
| — | **T18** | (미장원 별도 축) 건별 매출 + 결제수단 집계 | 대공사 → 보류[^schema][^dashboard] |

> 전략: **학원 축(T14~T17)을 먼저** 완성해 코어 재사용률을 높이고, 미장원(T18)은 별도 제품 판단으로 분리한다.

---

## 8. 가정 / 불확실성

- **[가정] 면세 여부**: 교습소·미장원의 과세/면세 여부는 코드로 검증 불가 — 실제 세무 확인 필요.[^vat]
- **[가정] 학원 과세유형**: 교습소/학원의 과세·면세 혼재는 외부 사실이며 미검증.[^taxassume]
- **[가정] 단가표=월합계**: 코어 청구액이 단가표 합계라는 전제. 수량 기반 매출이면 모델 부적합.[^invoice]
- **[가정] 시장 수요**: 학원/미장원 대상 실제 수요·경쟁은 미검증.
- **[가정] 실사용자 검증 부재**: T14~T17 우선순위는 **실사용자 인터뷰 2~3건**으로 검증 필요.
- **확인됨(가정 아님)**: 카카오 자동발송은 미지원(수동 이미지 복사만) — 전용 전송 채널이 코드에 없음.[^kakao]

---

## 각주 (코드/문서 근거)

[^wbs]: `docs/SME_ERP_WBS_v1.md` §1.1~1.2 — “10인 이하 제조업 특화”, 5대 핵심 화면(온보딩/대시보드/거래처/청구서/입금·원장) 정의.
[^invoice]: `src/main/services/invoiceService.js` `createInvoiceBatch({companyId, billingMonth, partnerIds})` — `billing_month` 기준 월 1회 발행, 공급가액 = 단가표 `unitPrice` 전 행 합산, 부가세·합계 자동.
[^vat]: `src/shared/money.js` `computeVat()` — `Math.trunc(supplyAmount * 0.1)` (10% 고정, 원 단위 절사).
[^onboarding]: `renderer/js/views/onboarding.js` — 3단계 마법사(`1/3단계`~`3/3단계`), Step 3 표준 단가표 체크박스(“기본 거래처 3곳”).
[^templates]: `src/main/services/templates.js` `TEMPLATE_ITEMS`(3종)·`TEMPLATE_PARTNERS`(3곳: 대양공업·한일금속·태성정밀) — 제조업 고정 시드.
[^partner]: `src/main/services/partnerService.js` `listPartners/getPartner/savePartner/deletePartner` — 거래처 CRUD.
[^schema]: `src/main/db/schema.sql` — 테이블 7종(companies/users/partners/items/invoices/payments/ledger_entries). 할인·수량·매출(POS)·예약·CRM 테이블/컬럼 없음.
[^price]: `src/main/services/partnerService.js` `normalizePriceTable()` — `{ itemName, unitPrice }` 배열, `default_price_json`에 저장.
[^bulk]: `src/main/services/bulkImportService.js` `parsePartnersText()`/`savePartnersBulk()` + `renderer/js/views/partners.js` `openImport()` + `src/main/ipc/smeHandlers.js`(`sme:partners:parseBulk`/`sme:partners:saveBulk`).
[^fifo]: `src/main/services/ledgerService.js` `snapshotAllocations()`(발행일 오래된 순 FIFO 충당)·`recordPayment()` + `src/main/services/partnerService.js` `BALANCE_SQL`(billed/paid/outstanding).
[^kakao]: `renderer/js/views/ledger.js` `extractReceiptFields()`/`buildReceiptImage()` + `main.js` `copyImageToClipboard()`(`sme:clipboard:copyImage`) — 선택 거래처 1건 이미지 복사(전송 채널 없음).
[^a4]: `renderer/js/views/ledger.js` `printDoc()` + `main.js` `printHtml()`(`printToPDF` `pageSize:'A4'`) — 거래처별 A4 원장 인쇄.
[^local]: `README.md` “Local-First 원칙(외부 유출 제로)” + MIT 라이선스 + `main.js` `initDb()`(userData 하위 로컬 DB, 서버 없음).
[^dashboard]: `src/main/services/dashboardService.js` — 청구/입금/미수 KPI 집계만 존재, 결제수단(`payments.method`)별 집계 없음.
[^taxassume]: 세무·업종 사실(면세/과세)은 저장소 코드로 검증 불가 → [가정].

<!-- 각주 참조 라벨: taxassume 은 §3·§8의 [가정] 서술용이며 코드 근거가 아님 -->
