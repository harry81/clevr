# T6 FIFO 자동 충당 알고리즘 이론 (A3 입금 즉시)

> 기준: `task-manager-board.md` §0 무결성 3원칙, `AHA_MOMENTS_SPEC.md` §킬러 인터랙션 ③

## 1. 핵심 설계: 충당은 저장하지 않는다 (단일 진실원천)

부분입금을 "어느 청구에 얼마" 쪼개 저장하면(분할 행·배분 테이블) 정합성 책임이 분산된다.
대신 SME-ERP는 **누적 입금액(Σ payments) 하나만 진실원천**으로 두고,
충당 상태는 **FIFO 순서 + 누적입금의 순수 함수**로 매번 재계산한다:

```
invoices FIFO 정렬 (issue_date ASC, invoice_no ASC)
left = Σ payments (거래처)
for inv in order:
  allocated = min(max(left, 0), inv.total)
  left -= allocated
  remaining = inv.total - allocated
  status = remaining==0 ? PAID : (allocated>0 ? PARTIAL : UNPAID)
```

- 전부 INTEGER 연산 → 1원 정확성 보장, 부동소수 없음.
- `invoices.status` 컬럼은 조회용 스냅샷일 뿐이며, `recordPayment` 트랜잭션 안에서
  항상 재계산 후 일괄 갱신하므로 계산값과 저장값이 어긋나지 않는다.
- 청구서별 "이번 입금 충당액" = 재계산 후 − 재계산 전 (트랜잭션 내 before/after 스냅샷 차분).

## 2. FIFO 순서 계약 (서비스·테스트·UI 동일)

충당 순서 = `ORDER BY issue_date ASC, invoice_no ASC`.
발행일이 같으면 청구번호 순 → 월내 여러 청구도 결정적 순서.
이 순서를 바꾸면 과거 충당 해석이 달라지므로 **순서 변경은 스키마급 변경**으로 취급.

## 3. running_balance는 기표순(rowid) 체인

- 원장 각 행의 `running_balance` = 이전 기표 잔액 ± 당행 금액.
- 일자순이 아닌 **기표순(rowid ASC)** 으로 체인을 잇는다.
  이유: 소급 입금(9/5 입금을 9/30 청구 기표 뒤에 입력)처럼
  entry_date가 역전돼도 체인 정합성이 깨지지 않는다.
  일자순으로 재구성하면 중간 행 잔액이 체인과 어긋나 보여 불변식 테스트가 실패한다
  (TDD 과정에서 실제 발견 → 기표순으로 확정).
- T5 `lastBalance`와 동일 원칙. 타임라인 조회도 `ORDER BY rowid ASC`.
- 일자순 표시는 Phase 3 UI 표시 옵션으로 분리 (값은 기표순 체인 그대로).

## 4. 초과입금 정책: 에러 (문서화된 결정)

- `amount > 미수잔액` → throw (초과분 자동반환 없음).
- 근거 ① 불변식 `running_balance = Σ청구 − Σ입금 ≥ 0` 유지 (음수 잔액 방지).
  근거 ② UI 확인 다이얼로그 경로와 연결: 엔진이 에러 메시지에
  `(미수 X원, 초과 Y원)`을 담아 반환하면 렌더러가 확인 다이얼로그로 전환 (WBS T13 완료기준 ③).
- 미수 0원 거래처 입금도 동일 에러.

## 5. 성능 실측 (A3 반응속도)

- `recordPayment` (청구 12건 FIFO 충당 + 기표 + 상태갱신): **~1.0ms**
- `getPartnerLedger` (13행 타임라인 + 요약): **~0.4ms**
- 단일 거래처 연산이라 배치 게이트(<0.1s)와 무관하게 여유 있음.
  규모 확장 시(거래처 수백·청구 수천) 재측정 필요 — 인덱스
  `idx_invoices_partner_date`·`idx_ledger_partner_date`가 충당 조회 경로를 커버.
