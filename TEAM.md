# TEAM — 대구경북산업안전 ERP / clevr

> Workspace: `wG` | Tab: `wG:t1` | Herdr 기반 6-pane 협업팀
> 생성일: 2026-09-01 | 기준 PRD: `../PRD.md` v1.0

## 1. 팀 구조

```
나(사용자)
  └─ 소통자 (Herdr 현재 pane, 인간↔팀 브릿지)
       └─ pm (작업 분배·의사결정·일정 관리)
            ├─ planner
            ├─ coder
            ├─ reviewer
            └─ qa
```

- **나**: 최종 의사결정자. 요구사항 승인/우선순위 결정.
- **소통자**: 인간과 PM/팀 사이 통역. 컨텍스트 정리·중재·회의록. 현재 `wG:p7` opencode가 담당.
- **pm**: 팀 운영 총괄. 태스크 분해·분배, 의존성 관리, 블로커 해소, 결정 지원. 팀원 산출물 취합 후 소통자에게 보고.
- **team 4인**: 병렬 실행. pm 지시 하에만 동작, 결과는 pm 경유.

모든 agent `kind=opencode`로 통일 (Herdr `opencode` kind).

## 2. Herdr Pane 구성

### 2.1 현재 상태 (2026-09-01 14:50 네임스페이스 개선 완료)

| pane | pane label (border) | agent name | 상태 | 비고 |
|------|---------------------|------------|------|------|
| `wG:p7` | `① 소통자 · clevr-communicator` | `clevr-communicator` | working | 소통자 — `herdr pane rename` + `agent rename` 완료 |
| `wG:p9` | `② PM · clevr-pm` | `clevr-pm` | idle | 우측 상단, 이전 `pm` → `clevr-pm` rename |
| `wG:pA` | `③ Planner · clevr-planner` | `clevr-planner` | idle | 우측 중단, `wG:p9` down split |
| `wG:pB` | `④ Coder · clevr-coder` | `clevr-coder` | idle | 좌측 중단, `wG:p7` down split |
| `wG:pC` | `⑤ Reviewer · clevr-reviewer` | `clevr-reviewer` | idle | 우측 하단, `wG:pA` down split (wD:p7 `reviewer-wd`로 이전) |
| `wG:pD` | `⑥ QA · clevr-qa` | `clevr-qa` | idle | 좌측 하단, `wG:pB` down split |

네임스페이스 `clevr-` prefix로 전역 충돌 방지. pane label은 `번호+한글+agent`로 border 가시성 확보 (`show_agent_labels_on_pane_borders=true`).

### 2.2 확정 레이아웃 (`wG:t1` 6-pane, 2026-09-01)

```
┌─────────────────────┬─────────────────────┐
│ 소통자              │ pm                  │
│ wG:p7 (34x133)      │ wG:p9 (34x133)      │  ← 상단 2분할 (split_0_root, ratio 0.5 right)
├─────────────────────┼─────────────────────┤
│ coder               │ planner             │  ← 중단 2분할
│ wG:pB (17x133)      │ wG:pA (17x133)      │     wG:p7→wG:pB (split_1_0 down) / wG:p9→wG:pA (split_3_1 down)
├─────────────────────┼─────────────────────┤
│ qa                  │ reviewer            │  ← 하단 2분할
│ wG:pD (17x133)      │ wG:pC (17x133)      │     wG:pB→wG:pD (split_2_01 down) / wG:pA→wG:pC (split_4_11 down)
└─────────────────────┴─────────────────────┘
```

- 가로 266 wide → `right` 우선, 이후 `down` 4회로 2열 3행 구성.
- 모든 pane `cwd=/home/hm/work/projects/대구경북산업안전/clevr`, `--no-focus` 생성, 포커스 `wG:p7` 유지.
- `herdr pane layout` 검증 완료 — focused_pane_id `wG:p7`.

### 2.3 Agent 매핑 (확정, 네임스페이스 개선)

| 역할 | Herdr agent name | pane (확정) | pane label | kind | 상태 | 책임 |
|------|------------------|-------------|------------|------|------|------|
| **소통자** | `clevr-communicator` | `wG:p7` | ① 소통자 | opencode | working | 인간 요청 정제→clevr-pm 전달, 보고 요약, 회의록/TEAM.md 관리 |
| **pm** | `clevr-pm` | `wG:p9` | ② PM | opencode | idle, interactive_ready=true | 백로그 분해, 4인 팀에 태스크 할당, 의존성·우선순위 결정, Done 검증 |
| **planner** | `clevr-planner` | `wG:pA` | ③ Planner | opencode | idle | IA/데이터모델/API 설계, PRD F-01~F-19 분해, WBS 산출 |
| **coder** | `clevr-coder` | `wG:pB` | ④ Coder | opencode | idle | 구현 (Fastify+Prisma+SQLite/Tauri), 마이그레이션, PR 생성 |
| **reviewer** | `clevr-reviewer` | `wG:pC` | ⑤ Reviewer | opencode | idle | 코드리뷰·정합성·보안·트랜잭션 검증, 리스크 레지스트리 |
| **qa** | `clevr-qa` | `wG:pD` | ⑥ QA | opencode | idle | 테스트 계획·E2E(PRD §9), 엑셀/잔액 정합성 검증 |

> 전원 `cwd=/home/hm/work/projects/대구경북산업안전/clevr`, `herdr agent list` `interactive_ready=true`. 명명 규칙: `clevr-<role>` (정규식 `[a-z][a-z0-9_-]{1,32}` 준수, 전역 유니크). pane label은 `번호+한글+agent`로 border에 항시 표시.
> **단일 기준**: `clevr/`가 정본, `branches/branch-erp`는 레거시 읽기전용 — `clevr/docs`가 정본 문서이며 상위 `docs/`는 동기화본, 모든 작업은 `clevr/` 기준으로만 수행한다.

## 3. 협업 플로우

```
1. 나 → 소통자: 요구/질문 (자연어)
2. 소통자 → pm: 정제된 작업 요청 (목표·제약·Due 정리)
3. pm → team: 분배
     planner: 설계안 → pm 리뷰
     coder: 구현 → reviewer 리뷰
     reviewer: PASS/REQUEST_CHANGES → pm
     qa: 검증 → 버그 → pm → coder 재할당
4. pm → 소통자: 취합 보고 (결정 필요 사항 명시)
5. 소통자 → 나: 요약·선택지 제시 (3안 이내)
6. 나 승인 → 소통자 → pm → team 다음 사이클
```

- **원칙**: 팀원은 pm을 통해서만 작업 수령, 소통자/나에게 직접 보고 금지. 크로스 토크 필요 시 pm 중재.
- **Done 기준**: planner 설계 + coder 구현 + reviewer PASS + qa PASS + pm 승인.
- **블로커**: 30분 이상 지연 시 pm이 소통자에 에스컬레이션.

## 4. Herdr Bootstrap (복붙 실행)

> 호출 pane `wG:p7`에서 실행. 각 `pane split` 후 반환된 pane_id를 다음 `agent start`에 사용.

```bash
# 0. 현재 위치 확인
herdr pane current --current
herdr workspace list; herdr tab list --workspace "$HERDR_WORKSPACE_ID"; herdr pane list --workspace "$HERDR_WORKSPACE_ID"

# 1. pm pane 생성 (우측 분할)
herdr pane split --current --direction right --cwd "$PWD" --no-focus
# → .result.pane.pane_id = <PM_PANE> 로 메모

# 2. planner pane 생성 (pm 아래 or 소통자 아래 - 방향은 레이아웃에 맞춰 조정)
herdr pane split --pane <PM_PANE> --direction down --cwd "$PWD" --no-focus
# → <PLANNER_PANE>

# 3. coder pane 생성
herdr pane split --current --direction down --cwd "$PWD" --no-focus
# → <CODER_PANE>  (소통자 pane 기준 down)

# 4. reviewer pane 생성
herdr pane split --pane <PLANNER_PANE> --direction down --cwd "$PWD" --no-focus
# → <REVIEWER_PANE>

# 5. qa pane 생성
herdr pane split --pane <CODER_PANE> --direction down --cwd "$PWD" --no-focus
# → <QA_PANE>

# 6. agent 기동 (각 pane이 shell 프롬프트 대기 상태일 때) — namespaced 권장
herdr agent start clevr-pm --kind opencode --pane <PM_PANE>
herdr agent start clevr-planner --kind opencode --pane <PLANNER_PANE>
herdr agent start clevr-coder --kind opencode --pane <CODER_PANE>
herdr agent start clevr-reviewer --kind opencode --pane <REVIEWER_PANE>
herdr agent start clevr-qa --kind opencode --pane <QA_PANE>

# 소통자 pane rename + pane label (border 표시)
herdr agent rename wG:p7 clevr-communicator
herdr pane rename <PM_PANE> "② PM · clevr-pm"
herdr pane rename <PLANNER_PANE> "③ Planner · clevr-planner"
herdr pane rename <CODER_PANE> "④ Coder · clevr-coder"
herdr pane rename <REVIEWER_PANE> "⑤ Reviewer · clevr-reviewer"
herdr pane rename <QA_PANE> "⑥ QA · clevr-qa"
herdr pane rename wG:p7 "① 소통자 · clevr-communicator"
# 또는 현재 opencode가 이름 없으면:
# herdr pane get wG:p7 -- 확인 후
# herdr agent start communicator --kind opencode --pane wG:p7  (이미 opencode 실행 중이면 rename만)

# 7. 검증
herdr agent list
herdr pane list --workspace "$HERDR_WORKSPACE_ID"
```

### 단일 명령 요약 (pane ID 자동 파싱 예시)

```bash
PM=$(herdr pane split --current --direction right --cwd "$PWD" --no-focus | jq -r '.result.pane.pane_id')
PLANNER=$(herdr pane split --pane "$PM" --direction down --cwd "$PWD" --no-focus | jq -r '.result.pane.pane_id')
CODER=$(herdr pane split --current --direction down --cwd "$PWD" --no-focus | jq -r '.result.pane.pane_id')
REVIEWER=$(herdr pane split --pane "$PLANNER" --direction down --cwd "$PWD" --no-focus | jq -r '.result.pane.pane_id')
QA=$(herdr pane split --pane "$CODER" --direction down --cwd "$PWD" --no-focus | jq -r '.result.pane.pane_id')
echo "PM=$PM PLANNER=$PLANNER CODER=$CODER REVIEWER=$REVIEWER QA=$QA"
herdr agent start clevr-pm --kind opencode --pane "$PM"
herdr agent start clevr-planner --kind opencode --pane "$PLANNER"
herdr agent start clevr-coder --kind opencode --pane "$CODER"
herdr agent start clevr-reviewer --kind opencode --pane "$REVIEWER"
herdr agent start clevr-qa --kind opencode --pane "$QA"
herdr pane rename "$PM" "② PM · clevr-pm"
herdr pane rename "$PLANNER" "③ Planner · clevr-planner"
herdr pane rename "$CODER" "④ Coder · clevr-coder"
herdr pane rename "$REVIEWER" "⑤ Reviewer · clevr-reviewer"
herdr pane rename "$QA" "⑥ QA · clevr-qa"
```

## 5. 운영 규칙

| 항목 | 규칙 |
|------|------|
| **포커스** | 생성 시 `--no-focus` 엄수. 인간 포커스는 소통자(`wG:p7`) 유지. |
| **cwd** | 모든 pane `--cwd "$PWD"` (`clevr` 루트) 고정. 상대경로 혼선 방지. |
| **프롬프트** | `herdr agent prompt <name> "..." --wait --timeout 180000` 로 제출. 장문은 파일로 전달 후 경로만 prompt. |
| **대기** | 일반 작업 `--wait` (idle/done/blocked 중 첫 settled). `blocked` 시 `herdr agent read <name>` 확인 후 `send-keys`. |
| **읽기** | `herdr agent read <name> --source recent-unwrapped --lines 150` 우선. alternate screen이면 agent에 파일 출력 요청. |
| **pm 권한** | pm만 작업 분배·우선순위 변경·병합 결정. 팀원은 pm 승인 없이 scope 변경 금지. |
| **소통자 권한** | 인간↔pm 번역·요약·기록. 직접 구현/리뷰 금지. |
| **종료** | `herdr pane close <pane_id>`는 생성자가 명시적으로 요청할 때만. `herdr server stop` 금지. |

## 6. 메시지 템플릿

**소통자 → pm**
```
[요청] <요약>
배경: <PRD 링크/캡쳐 번호>
제약: <기한/기술스택>
산출물: <기대 파일 경로>
결정 필요: <선택지>
```

**pm → planner/coder/reviewer/qa**
```
[Task #N] <제목> → @<agent>
목표: ...
입력: <파일:라인>
출력: <파일 경로>
Due: ...
의존: #M 완료 후
```

**team → pm**
```
[Done #N] <제목>
변경: <파일 목록>
검증: <실행 명령/결과>
남은 리스크: ...
다음 제안: ...
```

## 7. 산출물 경로

- `PRD.md` (상위) / `clevr/docs/*` — 요구/설계 (**정본**)
- `clevr/src/*`, `clevr/db/*` — 구현
- `/tmp/<agent>.md` — 중간 산출물 (Herdr pane read 우회용)
- `TEAM.md` (본 문서) — pane ID 확정 후 갱신
> **단일 기준**: `clevr/`가 정본, `branches/branch-erp`는 레거시 읽기전용 — `clevr/docs`가 정본 문서이며 상위 `docs/`는 `cp clevr/docs/* docs/`로 동기화 유지한다. `clevr` 내 `npm start/build:win`으로만 검증한다.

## 8. 다음 액션

- [x] Bootstrap 실행 후 실제 pane_id로 §2.3 갱신 (2026-09-01 14:46)
- [x] `herdr agent list` 캡쳐 — 아래 참조
- [x] clevr 단일 기준 확정 — `branches/branch-erp` 전체를 `clevr/`로 이식 완료 (main.js:18K, preload.js:4.2K, renderer:505K, db/localStore.js:12K, build/installer.nsh, electron-builder.yml:NSIS+Portable, scripts/seed-sample.ts:9.1K, package.json:branch-erp 0.1.0+electron31+esbuild), `clevr/clevr` 중첩 제거, `clevr/docs↔docs/` 동기화 유지 (2026-09-01 15:15)
- [ ] pm 다음 작업: `clevr` 기준 `npm start` 화면 검증(Ubuntu) → Windows VM 60초 체감 녹화 준비 (WBS/Windows_Spec 이후 작업은 전부 `clevr` 기준으로 재배치)

> **단일 기준**: `clevr/`가 정본, `branches/branch-erp`는 레거시 읽기전용 — 이후 작업은 `clevr/main.js`, `clevr/renderer` 기준으로만 수행하며 `branches/branch-erp` 참조를 금지한다.

### 부록: 검증 로그 (2026-09-01 14:50 네임스페이스 개선)

```json
// herdr pane list --workspace wG (pane label 개선 후)
wG:p7 "① 소통자 · clevr-communicator" clevr-communicator working (34x133, focused)
wG:p9 "② PM · clevr-pm"               clevr-pm           idle    (34x133)
wG:pA "③ Planner · clevr-planner"     clevr-planner      idle    (17x133)
wG:pB "④ Coder · clevr-coder"         clevr-coder        idle    (17x133)
wG:pC "⑤ Reviewer · clevr-reviewer"   clevr-reviewer     idle    (17x133)
wG:pD "⑥ QA · clevr-qa"               clevr-qa           idle    (17x133)

// herdr agent list --workspace wG (namespaced)
clevr-communicator wG:p7 working (ses_fa4817303ffekE2Un2cigJniWH)
clevr-pm           wG:p9 idle interactive_ready=true (pong→ping 응답 확인)
clevr-planner      wG:pA idle interactive_ready=true
clevr-coder        wG:pB idle interactive_ready=true
clevr-reviewer     wG:pC idle interactive_ready=true
clevr-qa           wG:pD idle interactive_ready=true

// 충돌 해소: wD:p7 reviewer → reviewer-wd 로 rename, wG측 clevr-reviewer 확보
// pane rename: herdr pane rename <pane> "번호 한글 · clevr-<role>"
// agent rename: herdr agent rename <old> clevr-<role>
```

다음 명령으로 팀 기동 (namespaced):

```bash
herdr agent prompt clevr-pm "PRD.md Phase 1(F-01~04) WBS 분해 후 clevr-planner/clevr-coder에 분배" --wait --timeout 180000
herdr agent prompt clevr-planner "IA/데이터모델 설계" --wait
herdr agent read clevr-pm --source recent-unwrapped --lines 150
```
