# Phase 1 TIL — T5 월말 일괄발행 엔진: 트랜잭션 채번·원장 기표 원자성

> WBS §5.3 학습 기록 | 2026-09-09 | A2 "월말 5초" 백엔드 코어

## 1. A2 무결성 게이트 설계 (D7 실현)

| 게이트 | 요구 | 테스트로 고정 |
|---|---|---|
| 1원 정확성 | 금액 INTEGER, VAT 절사 단일 소스 | `money.computeVat = Math.trunc(supply*0.1)` 단위 테스트 (12345→1234, 999→99) |
| 원장 불변식 | `running_balance = Σ청구 − Σ입금` | 기표 후 재구성 대조: ledger.running_balance == 재조회 Σtotal_amount |
| 반응속도 | A2 배치 <0.1s (목표 규모) | 벤치 테스트: 50건 배치, `process.hrtime.bigint()` 측정 < 100ms |

- `src/shared/money.js` — `computeVat`/`computeTotal` 단일 소스. T6(입금)도 동일 함수 재사용해 절사 규칙 이중화 방지.

## 2. 트랜잭션 내 원자적 순번 채번

### 왜 트랜잭션 안에서 채번해야 하나
- 청구번호 `INV-YYYYMM-0001`은 "현재 MAX + 1"로 결정. 만약 채번을 트랜잭션 **밖**에서 하면:
  - 두 요청(또는 중간 실패)이 같은 번호를 읽어 **중복 채번**.
  - 실패 후 재시도 시 번호 건너뜀(구멍).
- 해결: `BEGIN IMMEDIATE` **직후** `SELECT MAX(invoice_no) WHERE billing_month=?`로 최대값을 읽고 순번 부여 → 커밋 전까지 예약 락이 유지되어 동시 요청이 끼어들 수 없음.
- 이중 안전: 스키마의 `UNIQUE(company_id, invoice_no)` 제약이 혹시 모를 중복 삽입을 2차로 차단.

### 채번 구현
```js
const prefix = `INV-${billingMonth.replace('-','')}-`; // INV-202609-
// 트랜잭션 안에서:
SELECT invoice_no FROM invoices WHERE company_id=? AND billing_month=?
// → prefix 뒤 숫자 파싱 → max+1 → String(seq).padStart(4,'0')
```

## 3. 원장 기표 원자성 (매출청구 1:1)

- **원클릭 배치 = 단일 트랜잭션**: 대상 거래처 전체에 대해
  1. `invoices`에 청구서 INSERT
  2. `ledger_entries`에 `entry_type='매출청구'` 행 INSERT (ref_id = invoice id)
- 각 기표의 `running_balance = 기존 마지막 잔액 + total_amount`:
  ```sql
  SELECT running_balance FROM ledger_entries
  WHERE company_id=? AND partner_id=? ORDER BY created_at DESC, id DESC LIMIT 1
  ```
  없으면 0에서 시작 → 이후 T6 입금 기표가 이어받아 불변식 유지.
- **실패 시 전체 롤백**: 배치 중 어느 한 행이라도 실패하면(예: 존재하지 않는 거래처) 지금까지 INSERT된 invoices/ledger를 전부 ROLLBACK.
  - 실험적 검증: partnerIds=[유효A, 무효B] → A가 먼저 INSERT된 뒤 B에서 실패 → **A의 청구서·기표도 0건**으로 남는 것을 테스트가 확인(일부 성공 없음).

## 4. 남은 과제 (T6 연결점)
- `running_balance`를 현재 "마지막 잔액 + 새 기표" 방식으로 갱신. T6(입금)에서 FIFO 충당 시 **불변식을 재구성 대조**하는 테스트로 이어감: `잔액 = Σ청구(total) − Σ입금(amount)`.
- T12 UI에서 이 엔진을 호출하면 A2 "원클릭 월말 5초" 완성 (배치 벤치 11.8ms/50건).
- T13 입금 화면은 `ledgerService`의 FIFO 충당을 사용 — 채번·기표와 동일한 BEGIN IMMEDIATE 원칙 재사용.