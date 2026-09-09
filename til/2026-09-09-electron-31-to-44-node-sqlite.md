# Electron 31 → 44 업그레이드 & node:sqlite 런타임 안정화 (P0-2)

> Reviewer [REQUEST CHANGES] P0-2 대응 | 2026-09-09

## 1. 문제: "가짜 초록(False-green)" 테스트

- Phase 0 단위 테스트는 시스템 Node v22.20.0에서만 26/26 초록이었다.
- 그러나 앱의 **실제 런타임(Electron 번들 Node)** 은 electron ^31.0.0 → **Node 20.18.0**로, `node:sqlite` 내장 모듈이 **존재하지 않았다**.
- 즉 T8에서 `main.js`(Electron main)에 `require('node:sqlite')`를 이식하는 순간 즉사할 코드를, 시스템 Node 테스트가 "통과"로 감추고 있었다.
- 재현 명령: `ELECTRON_RUN_AS_NODE=1 ./node_modules/.bin/electron -e "require('node:sqlite')"` → `ERR_UNKNOWN_BUILTIN_MODULE`.

## 2. node:sqlite 안정화 상태 (버전 이력)

| 버전 | 상태 |
|---|---|
| Node 22.5.0 | `node:sqlite` 도입(experimental, `--experimental-sqlite` 필요) |
| Node 22.13.0 | **기본 활성화**(flag 없이 로드 가능, 여전히 Experimental 경고) |
| Node 23.x | 실험 안정화 진행 |
| Electron 35.0.2 | Electron 최초 `node:sqlite` 기본 활성 (Node 22.14 번들) |
| Electron 44.3.0 (현재) | Node 24.20.0 번들 — `node:sqlite` 안정 로드 |

## 3. 업그레이드 결정 (44.3.0 채택)

- WBS §1.3·T2 완료기준①은 "node:sqlite(Node v22 내장) 또는 경량 SQLite 드라이버"를 허용. **better-sqlite3 경로는 채택하지 않음** — 네이티브 빌드(Windows electron-rebuild) 의존이 오픈소스 설치 장벽이 되고, WBS §5.2 "네이티브 빌드 에러 요인 최소화" 원칙에 위배.
- `npm view electron version` → **44.3.0** (latest stable, 2026-09 기준).
- Electron 지원 정책(최근 3개 major) 기준 **미EOL**: 44는 현재 안정 릴리스이며 후속 45/46이 나올 때까지 지원.
- 요구 상한(≥35)을 넉넉히 충족하는 최신 안정 버전을 택해 한 번에 점프(31.7.7 → 44.3.0).
- Electron 44 번들 Node = **24.20.0** — `node:sqlite` 안정 로드 확인 완료.

## 4. 검증: 시스템 Node + Electron 번들 Node 양쪽 매트릭스

| 런타임 | Node 버전 | 커맨드 | 결과 |
|---|---|---|---|
| 시스템 Node | 22.20.0 | `npm test` (tests/unit) | 31/31 PASS |
| Electron 번들 Node | 24.20.0 | `npm run test:runtime` (tests/smoke) | 4/4 PASS |

- smoke 테스트는 `tests/unit` 밖 `tests/smoke/electronRuntime.test.js`에 두어 `npm test`(시스템 Node)와 분리.
- 실행 방식: `ELECTRON_RUN_AS_NODE=1 electron --test tests/smoke/electronRuntime.test.js` — Electron 바이너리를 순수 Node로 기동해 번들 Node 런타임에서 테스트. 확인 내용: `process.versions.electron` 존재, 번들 Node ≥22.13, `DatabaseSync(':memory:')` 생성, 파일 DB WAL PRAGMA.

## 5. 참고 (플랫폼)

- `ELECTRON_RUN_AS_NODE=1` 인라인 env 문법은 POSIX 셸 기준. Windows cmd/powershell에서는 `cross-env` 또는 `set ELECTRON_RUN_AS_NODE=1 && electron ...` 필요 — CI/윈도우 개발 시 적용 검토.
- `node:sqlite`는 아직 Node 22에서는 Experimental 경고를 출력하지만 동작은 안정. Node 24에서는 경고 없이 동작(번들 24.20.0에서 경고 미출력 확인).

## 6. 커밋 연계

- `feat: Phase 0(P0 수정 포함) 구현` — hasher 인증 우회 수정(P0-1) + Electron 44 업그레이드 및 런타임 스모크 테스트(P0-2) 반영.