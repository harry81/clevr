# TIL — Phase 3 SPA 재구축: 레거시 8000줄 index.html → sme 전용 5화면

## 1. 왜 전면 교체인가 (R1 공개 게이트)

- 구 `renderer/index.html`(525KB)는 DAWIN/GENSYS/구 `window.api.*` 177건에 결합.
  신규 백엔드는 `sme:*` 채널만 등록하므로 구 화면은 전부 무기능 — 점진 이식보다
  SPA 전면 재구축이 회귀 리스크·잔존 리스크 모두 낮다고 판단.
- R1 게이트를 단위 테스트로 고정: `tests/unit/renderer/legacyFree.test.js`가
  `renderer/` 전체를 스캔해 금지 패턴 6종(GENSYS·'1234'·b1acc·'B1'·비sme api·DAWIN)
  0건 + `window.api.sme.*` 사용 존재 + js 전 파일 `node --check`를 강제.
  구 트리에서 7/8 실패(Red) → 재구축 후 8/8(Green).

## 2. 구조 (번들러 없음, 바닐라)

- `index.html`(셸) + `js/app.js`(세션/라우터/공통) + `js/views/*.js`(화면 5종) + `styles/app.css`.
- 클래식 스크립트 + `window.App` 네임스페이스 (file:// ES모듈 CORS 회피).
- 모든 IPC는 `App.call(group, method, payload)` 단일 경유 — preload `nest()` 매핑과
  1:1 대응. 호출 전수(12개)와 preload 채널(17개) 대조를 리뷰 시점에 정적 확인.
- `design-system.css` 토큰 재사용(폴백 병기). 모든 동적 문자열은 `esc()` 처리.

## 3. 화면별 핵심 판단

- **온보딩**: submit 후 세션이 없으므로 입력 자격증명으로 `auth.login` 자동 수행 →
  대시보드 직행 (60초 완주). 사업자번호 마스킹은 표시용, 검증은 `000-00-00000` 정규식.
- **청구 프리뷰**: `partners.list`의 `priceTable[0]`을 공급가 미리보기로 사용 —
  서버 배치 엔진과 동일한 단가 소스(불일치 원천 차단). 단가 0은 선택 제외.
- **원장**: `getPartnerLedger` 1회 호출로 헤더+폼+타임라인 렌더. 입금 후 전체 `draw()`
  (부분 갱신보다 불변식 정합이 우선 — 응답이 ms 단위라 렉 없음).
- **인쇄**: `@media print` 대신 `sme.print.html`에 독립 HTML 문서 전달 (T8 브릿지 재사용).

## 4. P2 정리

- `xlsx`(excel:parseFile 제거로 무사용), `tsx`(시드 스크립트 삭제로 무사용) 의존성 제거.
- `main.js` 127.0.0.1:3000 외부 브라우저 자동오픈 데드코드 제거 (리슨 서버 없음).
- `shell` import는 유지 (`printHtml`의 `openPath`가 사용).
