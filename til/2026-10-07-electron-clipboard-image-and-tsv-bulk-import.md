# TIL 2026-10-07 — Electron clipboard writeImage 브릿지 & TSV Bulk Import

> T09~T11 Aha Moment 구현 중 정리. 실측: `npm test` → **157 passed**.
> 외부 의존성 0(표준/Electron 내장 API만 사용).

---

## (A) Electron clipboard `writeImage` 네이티브 브릿지

### 흐름

```
renderer canvas 2D → toDataURL('image/png')
  → IPC 'sme:clipboard:copyImage'
  → [main] 신뢰경계 검증(data:image/png;base64, allowlist)
  → nativeImage.createFromDataURL → clipboard.writeImage
```

### 왜 렌더러가 아니라 메인인가

Electron의 `clipboard` 모듈은 **메인 프로세스 API**다. 렌더러에는 `nodeIntegration: false`,
`contextIsolation: true`가 걸려 있어 직접 접근이 불가능하다. 따라서 이미지 생성(렌더러)과
클립보드 반영(메인)을 분리하고, 그 사이를 IPC 한 채널로만 연결한다.

- 렌더러 생성·검증: `renderer/js/views/ledger.js`
  - `extractReceiptFields(view)` — 지정 6필드(상호명/대표자/거래일자/공급가액/입금액/차인지급잔액)만 추출
  - `buildReceiptImage(fields)` — canvas 2D 수동 layout(외부 lib 0) → `toDataURL('image/png')`
  - `isAllowedImageDataUrl(dataUrl)` — 사전 allowlist 검증(정규식 `/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/`)
- 메인 수신·반영: `main.js`
  - IPC 핸들러 `sme:clipboard:copyImage` → `copyImageToClipboard({ dataUrl })`
  - `nativeImage.createFromDataURL(dataUrl)` → `image.isEmpty()` 확인 → `clipboard.writeImage(image)`
- 브릿지 최소노출: `preload.js` — allowlist `CHANNELS` 배열에 `sme:clipboard:copyImage` 1줄만 추가.
  preload는 allowlist에 있는 채널만 `window.api.sme.*`로 노출한다(임의 채널 확산 방지).

### 신뢰경계 검증

`dataUrl`은 렌더러에서 오는 **신뢰 경계 입력**이다. 메인에서 `typeof string` + PNG base64 allowlist를
다시 검증해 비PNG(MIME)/외부 스킴(`http:`)/HTML(`<script>`)을 거부한다. 렌더러의 사전 검증은
fail-fast용이고, 최종 강제는 메인에서 한다.

### 실패 처리

렌더러는 `try/catch`로 IPC 실패(형식 오류·빈 이미지)를 잡아 `App.toast(message, 'error')`로 노출한다.
메인은 예외를 삼키지 않고 `{ok:false, message}` 규약으로 반환한다.

---

## (B) TSV Bulk Import (엑셀 복붙)

### 흐름

```
클립보드 TSV/CSV → parsePartnersText(text) 행 분해
  → 미리보기 모달 → savePartnersBulk(companyId, rows)
  → { created, skipped, errors }
```

- 순수 파서: `src/main/services/bulkImportService.js` → `parsePartnersText(text)`
  - 헤더 감지: 첫 행에 키워드(상호/거래처/사업자)가 있으면 헤더로 스킵, 없으면 위치 기반 파싱
  - 기본 컬럼 순서: 거래처명 / 사업자번호 / 대표자 / 연락처 / 품목명 / 단가
  - 사업자번호 정규화(`1234567890` → `123-45-67890`), 단가 콤마 제거
  - 동일 거래처(bizNo 우선, 없으면 상호) 복수행 → 단가표 그룹핑
- 일괄 저장: `src/main/services/partnerService.js` → `savePartnersBulk(companyId, rows)`
  - `BEGIN IMMEDIATE` 트랜잭션
  - 중복 `bizNo`는 skip(upsert 아님)
  - 행별 오류 격리: 잘못된 행은 `errors`에 담고 **전체 중단 금지**, 나머지는 계속 등록
  - 반환 `{ created: number, skipped: number, errors: [{partnerName,message}] }`
- IPC: `src/main/ipc/smeHandlers.js`
  - `sme:partners:parseBulk` → `parseText`
  - `sme:partners:saveBulk` → `saveBulk`
- UI: `renderer/js/views/partners.js` → `openImport()` (붙여넣기 textarea → 미리보기 → 등록)

### 핵심 원칙

- 빈 클립보드는 **오류가 아니라 빈 결과**(`{rows:[],errors:[]}`)로 처리해 UI가 자연스럽게 비활성화된다.
- 파싱은 메인 순수함수로 분리해 `node:vm` 없이도 직접 단위 테스트 가능하게 했다.

### 검증

- `tests/unit/services/bulkImportService.test.js` — 정상 3행/헤더혼합/CSV/컬럼부족/중복/그룹핑
- `tests/unit/calc/savingTime.test.js` — 절약시간 5.5분/건(5분 단위 반올림)
- `tests/unit/renderer/clipboardImage.test.js` — 필드 추출 + dataURL allowlist
- 전체: `npm test` → 157 passed
