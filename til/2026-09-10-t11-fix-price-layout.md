# TIL — T11-fix: 품목단가표 레이아웃 정상화 + 단가 천단위 콤마

## 1. 배경: Planner 브라우저 E2E 사용성 피드백 반영

- 거래처 등록 드로어와 온보딩 3단계의 품목단가표 행에서 두 가지 불편이 지적됐다:
  ① 단가가 `72000`처럼 콤마 없이 보여 금액 자릿수 파악이 어렵고,
  ② 품목명/단가 인풋의 너비 배분이 가상 선택자에 의존해 삭제 버튼이 추가된
  행(3열)에서 깨질 여지가 있었다.
- 백엔드(`normalizePriceTable`·IPC)는 손대지 않고 `renderer/` + 테스트만 수정.
  금액은 **표시는 콤마, 저장은 정수**라는 단일 원칙으로 양쪽 뷰에 동일 적용했다.

## 2. 콤마 3단계 패턴: 입력 → 저장 → 복원

- **입력(input 이벤트)**: `el.value.replace(/\D/g, '')`로 숫자만 추출 →
  빈 값이면 빈 문자열 유지(지우기 UX 보존), 있으면
  `Number(digits).toLocaleString('ko-KR')`로 재서식. `72000` 타이핑이
  `72,000` 표시가 된다. 캐럿 점프 등 고급 처리는 범위 밖으로 두고 단순성을 택했다.
- **저장(콤마 제거·정수 파싱)**: 기존 `collect()`의
  `replace(/[^0-9]/g, '')`가 콤마를 자연히 걸러내므로 파싱 로직은 무수정 —
  `72,000` → `72000` 정수로 서버 전송. 서버의 0 이상 정수 검증과 1:1 정합.
  DB에는 콤마 없는 정수가 저장됨을 Reviewer 실기동으로 실증.
- **복원(fmtPrice)**: `itemRow()` 렌더 시 `fmtPrice(price)`로 감싸
  숫자·숫자문자열은 콤마 표시, `''`·`null`·공백은 빈 문자열로 정규화.
  편집 재오픈·온보딩 품목 추가 후 재렌더에서도 표시가 일관된다.

## 3. _commaBound 중복 바인딩 방지

- 드로어는 DOM을 유지한 채 행이 추가되므로 `bindPriceComma()` 호출마다
  `el._commaBound` 플래그로 이미 바인딩된 인풋을 건너뛴다.
  온보딩은 `draw()`가 전체를 재렌더하므로 플래그 없이도 되지만,
  동일 헬퍼 형태로 맞춰 양쪽 뷰의 서식 로직을 대칭으로 유지했다.

## 4. flex 2:1 + min-width:0 정상화

- 기존 `.sme-itemrow input:first-child:last-child` 가상 선택자는
  삭제 버튼(3번째 자식)이 들어간 partners 행에서 의도와 다르게 매칭될 수 있었다.
  명시적 클래스로 교체:
  `.pt-item-name/.ob-item-name{flex:2;min-width:0}` +
  `.pt-item-price/.ob-item-price{flex:1;min-width:0;text-align:right}` +
  `.pt-item-del{flex:0 0 auto}`.
- `min-width:0`이 핵심: flex 아이템의 기본 최소 너비(auto)가 긴 숫자 문자열에
  밀려 오버플로되는 것을 차단. 단가 우측 정렬은 금액 열 읽기에 맞춘 선택.
  Reviewer 실기동에서 2:1 비율·오버플로 0·콘솔 에러 0 확인.

## 5. 테스트 게이트 확장

- `partnersView.test.js` 8→10건: `toLocaleString` 존재(partners·onboarding 양쪽),
  가상 선택자 제거 + 명시적 5클래스 존재 검증 추가. 기존 R1 게이트
  (금지패턴·`node --check`·탭·로드)는 전부 유지. Red(신규 2건 실패) → Green(10/10).
