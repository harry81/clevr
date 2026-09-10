# T8 IPC 브릿지 설계 (sme 네임스페이스 + 하드 게이트)

> 기준: task-manager-board §0·§1, Feature-Freeze. 구 db/localStore.js + 40여 구 IPC 채널 폐기.

## 1. 핸들러 팩토리 패턴 (Electron 없이 테스트)

- `src/main/ipc/smeHandlers.js`는 `electron`을 import하지 않는다.
  `createSmeHandlers({ db, session })`에 `:memory:` DB + 인메모리 세션을 주입하면
  순수 Node 단위 테스트로 전 채널 검증 가능 (tests/unit/ipc, 17건).
- main.js는 `registerSmeIpc()`에서 팩토리 결과를 `ipcMain.handle`에 1:1 등록만 한다.
  비즈니스 로직은 서비스 계층(T4~T7, 승인済)에 그대로 위임 — 핸들러는 인자 검증 + 엔벨로프만 담당.

## 2. 엔벨로프 계약

- 성공 `{ok:true, data}` / 실패 `{ok:false, message}`. 서비스 throw는 래퍼에서 전부 포획.
- `need(payload, ...fields)` — 필수 인자 누락 시 `{ok:false}` (throw가 아니라 메시지로).
- `sme:partners:get` 미존재, `updateStatus` 허용외 상태·미존재 id도 동일 형식.

## 3. 세션 (단일 사용자 데스크톱)

- `createSessionStore()` 인메모리 저장소를 main이 1회 생성해 주입 (테스트는 건별 생성).
- login: username 전수 검색 → 복수 회사 충돌 시 회사ID 지정 요구 에러.
  성공 시 `{id, companyId, username, role}`만 세션/반환 — **password_hash·salt 유출 없음**(테스트로 고정).
- logout/checkSession은 세션 clear/조회.

## 4. invoices:list / updateStatus를 핸들러에 둔 이유

- invoiceService(T5, 승인済)는 배치 전용. 목록/상태변경은 얇은 SQL 2개로 핸들러에 구현해
  승인된 서비스 파일을 손대지 않았다. updateStatus 허용값 UNPAID/PARTIAL/PAID 고정.
  정상 흐름의 상태 전이는 ledgerService FIFO 재계산이 담당 (수동 변경은 예외 경로).

## 5. preload 데이터 주도 매핑 + 네임스페이스 격리

- 채널 문자열 테이블 → `sme.auth.login(payload)` 중첩 API 자동 생성. 채널 추가 시 테이블 1행.
- 구 렌더러의 `api.login`식 호출은 `undefined`로 loudly 실패 → Phase 3에서 전면 교체.
  main 프로세스는 구 참조 없이 기동 (T8 최소 처리 조건 충족).
- print/app은 도메인 무관 셸 유틸리티로 `sme:` 하에 유지 (Phase 3 인쇄/종료 버튼이 사용).
  excel:parseFile은 교육자료 업로드 전용(레거시 도메인)이라 폐기.

## 6. 패키징 메모 (T14 이관)

- builder files: `db/**/*` → `src/**/*` (런타임 require 대상). 데이터 DB는 번들 안 함
  (%LOCALAPPDATA% 런타임 생성) — 기존 방침 유지.
- `nsisCustomClasspath: []`는 스키마 미지원 속성이라 제거 (빌드 검증 단계에서 발견).
- Linux `build:win:dir`: asar 패킹까지 성공(smeHandlers 포함·localStore 미포함 확인),
  rcedit-ia32.exe 실행에서 실패 — **wine32(i386) 미설치**가 원인, root 권한 필요.
  T14(Windows 실기 또는 wine32 설치 환경)에서 재시도. 블로킹 아님.
