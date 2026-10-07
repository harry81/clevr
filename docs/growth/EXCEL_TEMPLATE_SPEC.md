# EXCEL_TEMPLATE_SPEC — 트로이목마 무료 엑셀 템플릿

> **Task**: T03 · **링크 정본**: https://github.com/harry81/clevr/releases/latest
> **원칙**: 외부 의존성 0 · 엑셀 100% 호환 · CSV+UTF-8 BOM 우선 · 과설계 금지.

---

## 1. 목적

실수요 사장님이 가장 많이 검색하는 `거래처 원장 양식`, `제조업 청구서 엑셀`, `미수금 관리 엑셀`
수요를 흡수하는 **무료 상위 품질 양식**을 배포하고, 양식 내부 안내에서 제품으로 전환한다.

- 유입 키워드: 거래처 원장 양식 무료 / 제조업 세금계산서 청구서 엑셀 / 미수금 관리 엑셀
- 전환 장치: 거래처 시트 `notice` 열의 안내 1줄(§5).

## 2. 파일 구성

| 파일 | 시트 | 역할 |
|:---|:---|:---|
| `assets/growth/templates/01_거래처.csv` | 거래처 | 거래처 마스터(온보딩 시드 3곳) |
| `assets/growth/templates/02_단가표.csv` | 단가표 | 거래처별 품목 단가 |
| `assets/growth/templates/03_청구서.csv` | 청구서 | 월별 청구서(부가세 자동) |
| `assets/growth/templates/04_미수금.csv` | 미수금 | 청구/입금/차인지급잔액(FIFO) |
| `assets/growth/templates/SME-ERP_거래처관리.xls` | 통합 | `--xls` 시 생성(SpreadsheetML 2003) |

## 3. 헤더 정의 (시드와 1:1 정합)

**01_거래처**: `partnerCode, partnerName, bizNo, ceoName, bizType, bizItem, tel, notice`
- 시드 **3곳**: 대양공업(P0001, 111-22-33333) · 한일금속(P0002, 222-33-44444) · 태성정밀(P0003, 333-44-55555)
- 코드·사업자번호 체계는 `src/main/services/templates.js`와 동일.

**02_단가표**: `partnerCode, partnerName, itemName, unitPrice`
- 대양공업: 정밀가공 50,000 / 밀링가공 35,000
- 한일금속: 레이저절단 20,000
- 태성정밀: 정밀가공 55,000

**03_청구서**: `invoiceNo, issueDate, partnerCode, partnerName, itemName, quantity, unitPrice, supplyAmount, vatAmount, totalAmount, status`
- 계산식: `supplyAmount = unitPrice × quantity`, `vatAmount = supplyAmount × 10%`, `totalAmount = supplyAmount + vatAmount`

**04_미수금**: `date, partnerCode, partnerName, type, amount, runningBalance, memo`
- `type` = `청구` / `입금`
- `runningBalance` = 직전 잔액 + 청구액 − 입금액 (오래된 청구부터 차감 = FIFO)

## 4. 인코딩 & 호환

- CSV 파일은 **UTF-8 BOM**(`EF BB BF`)으로 저장 → 한국어 엑셀(Windows)에서 바로 열림.
- 개행 `CRLF`, 쉼표/줄바꿈/따옴표 포함 셀은 RFC 4180 방식으로 인용.
- 필요 시 `--xls`로 SpreadsheetML 2003 XML 단일 워크북(.xls) 생성 — 엑셀에서 정상 인식.
- 외부 라이브러리·CDN·서버 없음(로컬퍼스트).

## 5. 내부 전환 장치 (notice)

거래처 시트 `notice` 열에 아래 1줄을 둔다:

```
무료·회원가입 없음·평생 무료 · 무료 다운로드: https://github.com/harry81/clevr/releases/latest
```

## 6. 생성 & 검증

```bash
# 생성 (CSV 4종, UTF-8 BOM)
node scripts/growth/gen_xls_template.js

# 통합 .xls 까지 생성
node scripts/growth/gen_xls_template.js --xls

# 검증: BOM·헤더·시드 3곳·금지 도메인 0건 (실패 시 exit 1)
node scripts/growth/gen_xls_template.js --check
```

성공 시 `[OK] 템플릿 검증 통과` 출력. 외부 의존성 0이므로 `npm install` 불필요.

## 7. 성공 판정

- 주간 양식 다운로드 ≥ 100 → 릴리스 유입 전환 ≥ 10% → 첫 실행 ≥ 5명.
- 전환율 5% 미만 시 안내 위치/문구/게시 채널을 교체(§A/B).

## 8. 금지

- 미소유 도메인 금지. 링크는 `releases/latest` 단일 정본.
- 가짜 버전 태그 표기 금지.
- 시드 거래처는 **3곳** 고정(임의 증감 금지).
