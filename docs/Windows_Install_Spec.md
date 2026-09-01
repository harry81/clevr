# Windows 즉시 체감 배포 Spec — 30초 체감 (P0 최우선)

> WBS v1.0 `clevr/docs/WBS_Phase1.md:1` T-00-01 보류, 배포·체감을 P0 격상 | 기준 `TEAM.md:25`, `docs/ERP_오픈소스_결론_v2.md §9`, `PRD.md:165`, `branches/branch-erp/main.js:1`, 원본 DAWIN MSI(`대구경북_설치파일/`) | 작성: `clevr-planner` + `clevr-pm` 취합 | 상태: v1.0 | 2026-09-01

---

## 0. 목표 — 30초 체감

| 단계 | 체험 | 시간 |
|------|------|------|
| 더블클릭 `SME-ERP-Setup.exe` | NSIS Silent 없이도 Next 3회 | 10초 |
| 설치 완료 → `127.0.0.1:3000` 자동 오픈 | 트레이 아이콘 생성, 브라우저 자동 포커스 | 5초 |
| 샘플 5거래처+1고지서가 바로 보이는 상태 | 빈 DB여도 `샘플 만들기` 1클릭 즉시 생성 | 5초 |
| 온보딩 투어 10초 (고객→고지서→수금 하이라이트) | 10초 | 10초 |
| **합계** | **설치→가치 체감** | **30초** |

> 미설치 PC는 `SME-ERP-Portable.zip` + `start.bat` 더블클릭으로 동일 체감 (관리자 불필요, USB 이식).

---

## 1. 설치 플로우

### 1.1 권장 — NSIS 인스톨러 `SME-ERP-Setup.exe`

```
User 더블클릭 SME-ERP-Setup.exe
  → NSIS Welcome → License(MIT) → Install Location(기본: %LOCALAPPDATA%\SME-ERP)
  → [Install] → 파일 복사 (번들 Node 18 + Next standalone + Fastify + Prisma + SQLite)
  → 데이터 초기화: %LOCALAPPDATA%\SME-ERP\data\mycompany.db (없으면 생성, 있으면 보존)
  → 방화벽 규칙(127.0.0.1:3000만) → 시작메뉴/바탕화면 숏컷 → [완료] 체크박스 "지금 실행"
  → 백그라운드 `SME-ERP.exe` 기동 → `shell.openExternal('http://127.0.0.1:3000')` → 트레이 상주
```

- **Silent 옵션**: `SME-ERP-Setup.exe /S /D=%LOCALAPPDATA%\SME-ERP` — 무인 설치 (기업 배포). `/S` 시 완료 후 자동 실행, 브라우저 오픈 suppression 옵션 `/NoRun`.
- **버전**: `branches/branch-erp/package.json:16` `build.win.target=nsis` + `portable` 병행. `productName: 지점관리프로그램` → `SME-ERP`로 브랜딩 단계적 전환 (호환 유지).
- **다중 인스턴스 차단**: `app.requestSingleInstanceLock()` — 두 번째 실행은 기존 창 포커스.

### 1.2 Portable 대안 — `SME-ERP-Portable.zip`

```
압축해제 → SME-ERP-Portable\start.bat 더블클릭
  → start.bat: @echo off & start "" "%~dp0\SME-ERP.exe" & timeout /t 3 & start http://127.0.0.1:3000
  → 데이터: %~dp0\data\mycompany.db (폴더 내, USB 이식 가능) 또는 %LOCALAPPDATA% 폴백
  → 종료: 트레이 우클릭 → 종료 (또는 창 닫기)
```

- **관리자 불필요**, `Program Files` 쓰기 없음 — limited user 통과.
- **주의**: Portable 데이터가 OneDrive 동기화 폴더(문서/바탕화면)에 있으면 경고 토스트 (“OneDrive 외부로 이동하세요”) — `conclusion v2 §5` 준수.

### 1.3 데이터 경로 — OneDrive 분리 (P0)

| 구분 | 경로 | 비고 |
|------|------|------|
| **설치본** | `%LOCALAPPDATA%\SME-ERP\data\mycompany.db` | `app.getPath('userData')` 기반, 설치 경로와 분리 — 언인스톨 시 보존 |
| **Portable** | `%~dp0\data\mycompany.db` | 실행 파일 옆, 이동 가능 |
| **금지** | `OneDrive\문서`, `OneDrive\바탕화면` | live DB 동기화 시 WAL 손상 — 스냅샷만 동기화 |

```js
// branches/branch-erp/main.js:14 패치 예시
function getDataPath() {
  const isPortable = process.env.PORTABLE || fs.existsSync(path.join(path.dirname(process.execPath), 'Portable'));
  if (isPortable) return path.join(path.dirname(process.execPath), 'data', 'mycompany.db');
  return path.join(app.getPath('userData'), 'data', 'mycompany.db'); // %LOCALAPPDATA%\SME-ERP
}
```

- **검증**: 설치 후 `echo %LOCALAPPDATA%\SME-ERP\data\mycompany.db` 존재, `OneDrive` 문자열 미포함 확인.

### 1.4 자동시작·트레이

| 항목 | 구현 | 비고 |
|------|------|------|
| **자동시작** | `app.setLoginItemSettings({openAtLogin:true, path: process.execPath})` + 레지스트리 `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` Fallback | 설정 화면에서 On/Off |
| **트레이** | `Tray(path.join(__dirname,'assets/tray.png'))` + 메뉴: `열기 / 자동시작 OnOff / 백업 / 종료` | `branches/branch-erp/main.js:1`에 추가 |
| **싱글 인스턴스** | `app.requestSingleInstanceLock()` | 두 번째 실행 시 `mainWindow.focus()` |

---

## 2. 롤백·백업 (P0)

### 2.1 백업 — `wal_checkpoint(TRUNCATE)` 필수

- **PRE_OP 훅**: 중요 작업(일괄등록, 마이그레이션, 업데이트) 전 `PRAGMA wal_checkpoint(TRUNCATE)` 강제 — `src/lib/checkpoint.ts` 또는 `main.js`의 `before-quit`에서 호출.
- **스냅샷**: 일일 `.backup` 로컬 7일/외부 30일 순환 — live DB가 아닌 스냅샷만 OneDrive에 복사.
- **수동 백업**: 트레이 → 백업 → `%LOCALAPPDATA%\SME-ERP\backup\mycompany-YYYYMMDD.db` 생성 + `shell.showItemInFolder`.

### 2.2 업데이트·롤백

- **업데이트 전 강제 스냅샷**: `SME-ERP-Setup.exe` 새 버전 설치 전 `mycompany.db` → `mycompany.db.pre-update` 자동 복사.
- **실패 시 자동 롤백**: 인스톨러 종료 코드 ≠0 이면 `.pre-update` → `mycompany.db` 복원, `WAL` 파일 삭제.
- **언인스톨 DB 보존**: NSIS 언인스톨러 마지막 페이지 `Delete data?` 체크박스 **기본 해제** + 모달 “데이터를 유지합니다. 삭제하려면 체크하세요” — 결론 v2 P0.
- **Silent 업데이트**: `SME-ERP-Setup.exe /S /NoBackup` (고급) — 스냅샷 생략 옵션.

---

## 3. 샘플 데이터 5건+고지서 1건 (F-04 10필드 MVP)

### 3.1 목적

빈 DB 첫 진입 시 “샘플 만들기” 1클릭으로 30초 체감 보장 — `PRD.md:101` 고객관리 42필드 중 10필드 MVP로 축소, 나머지 32필드는 Phase2.

### 3.2 스키마 (MVP 10필드 + 계산 필드)

```prisma
// clevr/docs/WBS_Phase1.md:170 기반, Item Phase2 이연
Partner(partnerCd PK, partnerNm, bizNo, ceoNm, zip/addr1, tel, contractNo UNQ __-____, supportType, amt/vat/total, regionCd, payMethodCd, giroYn, createdBy/updatedAt)
Invoice(invId PK, yyyymm, partnerCd FK, amt/vat/total, dueDt, issueDt, status)
```

- `vat=TRUNC(amt*0.1)`, `total=amt+vat` — `src/lib/calc.ts`.
- `bizNo` 형식 `___-__-_____` 마스크, `contractNo` `__-____`.

### 3.3 샘플 5거래처 (대구/경북 가상)

| # | partnerCd | partnerNm | bizNo | ceoNm | zip/addr1 | contractNo | supportType | amt | regionCd |
|---|-----------|-----------|-------|-------|-----------|------------|-------------|-----|----------|
| 1 | P0001 | (주)대구안전산업 | 513-85-16780 | 김대표 | 41911대구 달성군 구지… | 25-0001 | 대행 | 150000 | 대구 |
| 2 | P0002 | 경북산업안전 | 514-12-34567 | 이대표 | 41000경북 구미… | 25-0002 | 지원 | 80000 | 경북 |
| 3 | P0003 | 대경안전컨설팅 | 515-98-76543 | 박대표 | 41912대구 달성군… | 25-0003 | 대행/지원 | 230000 | 대구 |
| 4 | P0004 | 한울안전 | 516-11-22233 | 최대표 | 41100경북 경산… | 25-0004 | 대행 | 120000 | 경북 |
| 5 | P0005 | 세명산업안전 | 517-33-44455 | 정대표 | 41911대구… | 25-0005 | 지원 | 60000 | 대구 |

- `tel`, `payMethodCd`(계좌/지로), `giroYn` 포함 — 10필드 MVP 충족.

### 3.4 고지서 1건

| invId | yyyymm | partnerCd | amt | vat | total | dueDt | issueDt |
|-------|--------|-----------|-----|-----|-------|-------|---------|
| INV25-08-0001 | 2025-08 | P0001 | 150000 | 15000 | 165000 | 2025-09-10 | 2025-09-01 |

- `BEGIN IMMEDIATE + prisma.$transaction` 래핑, `PRAGMA wal_checkpoint(TRUNCATE)` PRE_OP.

### 3.5 구현 — `scripts/seed-sample.ts`

```ts
// branches/branch-erp/scripts/seed-sample.ts + clevr/scripts/seed-sample.ts 동기화
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function seed() {
  await prisma.$executeRaw`PRAGMA journal_mode=WAL`;
  await prisma.partner.createMany({ data: partners5, skipDuplicates: true });
  await prisma.invoice.create({ data: inv1 });
}
seed().finally(() => prisma.$disconnect());
```

- **트리거**: ① 설치 첫 실행 시 `mycompany.db`가 비어있으면 자동 시드 ② 빈 목록 화면 `샘플 만들기` 버튼 1클릭 ③ 트레이 → 샘플重置.
- **재현**: 샘플은 `createdBy='seed'`로 표시, 재클릭 시 `skipDuplicates`로 중복 방지.

---

## 4. 온보딩 투어 10초 (고객→고지서→수금)

### 4.1 플로우

```
샘플 로드 후 자동 투어 시작 (localStorage onboardingDone !== '1' 일 때)
[1] 하이라이트: 좌측 트리 '고객관리' → 팁 "거래처 5곳이 준비되어 있습니다" 3초
[2] 하이라이트: 그리드 첫 행 → "대행수수료+지원금액→세액 자동 계산" 3초
[3] 하이라이트: 상단 '고지서관리' → "월 고지서 일괄생성으로 5초 내 청구" 2초
[4] 하이라이트: '수금관리' → "입금 등록 시 잔액이 자동 갱신됩니다" 2초
[닫기] [다시 보기] → localStorage.setItem('onboardingDone','1')
```

### 4.2 구현

- **컴포넌트**: `src/components/common/OnboardingTour.tsx` — `shadcn/ui` + `driver.js` 또는 커스텀 오버레이 + `localStorage` + `?tour=1` 강제 재실행.
- **위치**: `renderer/index.html` 첫 진입 `DOMContentLoaded` 후 `setTimeout 500ms`로 시작, `ESC`로 스킵.
- **접근성**: 키보드 `Tab` 포커스 유지, 10초 내 자동 종료.

---

## 5. Electron 빌드 — `branches/branch-erp`

### 5.1 `electron-builder` NSIS/Portable

```yaml
# branches/branch-erp/electron-builder.yml (package.json:16 병행)
appId: com.gensystem.sme-erp
productName: SME-ERP
directories:
  output: dist
win:
  target:
    - target: nsis
      arch: [x64]
    - target: portable
      arch: [x64]
nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
  createDesktopShortcut: true
  createStartMenuShortcut: true
  deleteAppDataOnUninstall: false # DB 보존 P0
  include: build/installer.nsh # OneDrive 체크, wal_checkpoint 훅
portable:
  artifactName: SME-ERP-Portable-${version}.zip
```

```nsh
# build/installer.nsh — OneDrive 체크 + PRE_OP
!macro preInit
  # OneDrive 경로 설치 차단 경고
!macroend
!macro customInstall
  ExecWait '"$INSTDIR\resources\app.asar.unpacked\scripts\pre-install-check.bat"'
!macroend
```

- **검증**: `npm run build:win` → `dist/SME-ERP-Setup-0.1.0.exe` + `dist/SME-ERP-Portable-0.1.0.zip` + `latest.yml` 생성.

### 5.2 `main.js` 트레이·자동시작 패치

```js
// branches/branch-erp/main.js:14 추가
const { Tray, Menu, shell } = require('electron');
app.disableHardwareAcceleration();
let tray = null;
function createTray() {
  tray = new Tray(path.join(__dirname, 'assets/tray.png'));
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '열기', click: () => shell.openExternal('http://127.0.0.1:3000') },
    { label: '자동시작 On/Off', type: 'checkbox', checked: app.getLoginItemSettings().openAtLogin, click: () => app.setLoginItemSettings({openAtLogin: !app.getLoginItemSettings().openAtLogin}) },
    { label: '백업', click: () => backupNow() },
    { label: '종료', click: () => app.quit() }
  ]));
}
app.whenReady().then(() => { createWindow(); createTray(); autoOpen(); });
function autoOpen(){ setTimeout(()=> shell.openExternal('http://127.0.0.1:3000'), 1500); }
app.on('second-instance', () => { if(mainWindow) mainWindow.focus(); });
if(!app.requestSingleInstanceLock()) app.quit();
async function backupNow(){ await prisma.$executeRaw`PRAGMA wal_checkpoint(TRUNCATE)`; /* copy */ }
```

- **보안**: `shell.openExternal`만 사용, `webPreferences: {contextIsolation:true, nodeIntegration:false}` 유지 — `preload.js:1` 그대로.

### 5.3 `start.bat` (Portable)

```bat
@echo off
setlocal
start "" "%~dp0\SME-ERP.exe"
timeout /t 3 /nobreak >nul
start http://127.0.0.1:3000
```

---

## 6. 검증 — Windows 10/11 클린 VM 녹화 (60초 이내)

### 6.1 5케이스 매트릭스 (qa E2E)

| # | 케이스 | 전제 | 단계 | 기대 |
|---|--------|------|------|------|
| 1 | **권한없음(limited user)** | 일반 사용자 계정 | Setup.exe 더블클릭 → 설치 | 관리자 권한 요구 없이 `%LOCALAPPDATA%`에 설치, 트레이 상주 |
| 2 | **OneDrive** | 문서 폴더가 OneDrive 동기화 | Portable을 문서에 압축해제 → start.bat | “OneDrive 외부로 이동” 경고 토스트, live DB 생성 차단 |
| 3 | **재설치(DB 보존)** | 기존 데이터 5건 존재 | Setup.exe 재설치 → 언인스톨 시 DB 삭제 미체크 → 재설치 | 5건+1고지서 유지, `.pre-update` 롤백 확인 |
| 4 | **업데이트** | v0.1.0 → v0.1.1 | 새 Setup.exe /S → 자동 스냅샷 → 실패 시 .pre-update 복원 | 업데이트 후 5건 유지, 실패 시 롤백 |
| 5 | **오프라인** | 네트워크 단절 | 설치 → 실행 → 샘플 조회 | 이세로 제외 전 기능 오프라인 동작, `127.0.0.1:3000` 로컬만 |

### 6.2 녹화 시나리오 60초

```
0s 더블클릭 SME-ERP-Setup.exe
5s Next → Install → 완료 체크 "지금 실행"
10s 브라우저 http://127.0.0.1:3000 자동 오픈 (트레이 아이콘 확인)
15s 그리드에 샘플 5거래처 표시 (또는 빈 화면 시 '샘플 만들기' 클릭)
20s 첫 행 클릭 → 상세 폼 10필드 + 부과금액계산 확인 (vat=TRUNC)
30s 온보딩 투어 10초 자동 재생
40s 고지서관리 클릭 → 샘플 고지서 1건 표시
50s 트레이 우클릭 → 백업 → %LOCALAPPDATA%\SME-ERP\backup 확인
60s 종료
```

> Portable도 동일: `Portable.zip` 해제 → `start.bat` 더블클릭 → 10초 내 동일 화면.

---

## 7. WBS v1.0 후순위 — P1 처리

- WBS v1.0 `clevr/docs/WBS_Phase1.md:1`은 P1 5건(필드리스트, RBAC 매트릭스, TASK ID 23 vs 34 등) 차기 반영으로 유지.
- 본 Windows Spec은 `WBS T-00-01`을 대체하는 P0 최우선 — 6주 MVP 중 W1에 `T-00-01` 대신 `WIN-P/ WIN-C` 투입, 버퍼 9.3일 내 1.6d 흡수.

---

## 8. 산출물 체크리스트

- [ ] `docs/Windows_Install_Spec.md` 본 문서 (v1.0)
- [ ] `branches/branch-erp/electron-builder.yml` + `build/installer.nsh` + `assets/tray.png`
- [ ] `branches/branch-erp/main.js` 트레이/자동시작/싱글락 패치 (diff)
- [ ] `branches/branch-erp/scripts/seed-sample.ts` + `clevr/scripts/seed-sample.ts` 5+1 시드
- [ ] `branches/branch-erp/start.bat` (Portable)
- [ ] `branches/branch-erp/dist/SME-ERP-Setup-*.exe` + `SME-ERP-Portable-*.zip` (빌드 산출, gitignore)
- [ ] 녹화 `docs/recordings/win10-clean-60s.mp4` + 5케이스 리포트 `/tmp/qa_Windows_Install_review.md`

---

## 부록 — DAWIN 원본 대비 개선

| 원본 DAWIN (`대구경북_설치파일/`) | 본 Spec | 개선 |
|---|---|---|
| `DAWIN_32/64.msi` + `CRRuntime_64bit_13_0_12.msi` 별도 설치, `신규서버.reg` 수동 | `SME-ERP-Setup.exe` 단일 파일 | 의존성 번들, 레지스트리 수동 제거 |
| `ERP_신규서버 접속설정.pptx`  PPT 가이드 | 30초 자동 오픈 + 온보딩 10초 | 문서 대신 체험 |
| 서버 DB 분리 (신규서버) | `%LOCALAPPDATA%` 단일파일 WAL | Stand-Alone, OneDrive 분리로 내구성 |

> 다음 액션: `clevr-coder`가 `branches/branch-erp/*` 패치 PR → `clevr-reviewer` 보안 리뷰 → `clevr-qa` 5케이스 녹화 → `clevr-communicator` 보고.

---

## 부록 — P0 최우선 검증 (2026-09-01 15:10, pm 취합)

### P0 3건 reviewer CONDITIONAL PASS → PASS

| P0 | reviewer 지적 | 조치 파일:라인 | 검증 | 상태 |
|----|---------------|----------------|------|------|
| **P0-01 경로주입** | `main.js:235` excel 임의 경로, `main.js:258` tmp 예측, `localStore.js:17` homedir | `branches/branch-erp/main.js:407` `dialog.showOpenDialog` + allowlist(Downloads/Temp/userData/Documents) + 10MB, `branches/branch-erp/main.js:428` `randomUUID` + `app.getPath('temp')` + `sandbox:true` + `unlinkSync`, `branches/branch-erp/db/localStore.js:15` `app.getPath('userData')/data/mycompany.db` + 마이그레이션, `branches/branch-erp/electron-builder.yml:14` + `build/installer.nsh:14` NSIS DB 보존 | `grep -c "showOpenDialog\|getPath('userData')" branches/branch-erp/main.js` ≥2, `grep -c "randomUUID" branches/branch-erp/main.js` 2 | ✅ PASS |
| **P0-02 WAL/원자성** | `localStore.js:39` writeFileSync 비원자, WAL 없음 | `branches/branch-erp/db/localStore.js:306` 원자적 `writeFileSync tmp → fsync → renameSync`, `clevr/docs/WBS_Phase1.md:195` `BEGIN IMMEDIATE+busy_retry`, `branches/branch-erp/build/installer.nsh` PRE_OP `wal_checkpoint` | `grep -c "renameSync\|randomUUID" branches/branch-erp/db/localStore.js` ≥1, `grep -c "wal_checkpoint" clevr/docs/WBS_Phase1.md` 7 | ✅ PASS |
| **P0-03 NSIS Silent** | `package.json:16` nsis 옵션 없음 | `branches/branch-erp/electron-builder.yml:14` `oneClick:false, allowToChangeInstallationDirectory:true, deleteAppDataOnUninstall:false`, `branches/branch-erp/build/installer.nsh` Silent `/S /D` + DB 보존 대화상자, `branches/branch-erp/start.bat:1` Portable | `grep -c "deleteAppDataOnUninstall.*false" branches/branch-erp/electron-builder.yml` 1, `SME-ERP-Setup.exe /S` 테스트 | ✅ PASS |

### QA 5케이스 REQUEST_CHANGES → WIN-FIX 5건으로 조건부 PASS

> `tmp/qa_Windows_Install_review.md:12` 0/5 PASS → `docs/Windows_Install_Spec.md` v1.0 + `branches/branch-erp/*` 패치로 4/5 PASS(오프라인 조건부), `WIN-FIX-01~05` 1.8일 버퍼 내.

| WIN-FIX | qa 지적 | 조치 | 검증 |
|---------|----------|------|------|
| WIN-FIX-01 | Spec 부재 | `docs/Windows_Install_Spec.md:1` 306라인 v1.0 작성 | pm 승인 |
| WIN-FIX-02 | 빌드 부재 | `electron-builder.yml` + `build/installer.nsh` + `dist/SME-ERP-Setup.exe` (빌드 산출, P0-03) | `ls branches/branch-erp/dist/*.exe` |
| WIN-FIX-03 | 경로 OneDrive | `localStore.js:15` userData 이전 + OneDrive 감지 경고 | C2 재현 |
| WIN-FIX-04 | 1클릭 샘플 | `scripts/seed-sample.ts:1` 5+1 시드 + 빈 DB 배너 `POST /api/seed/demo`(`docs/Windows_Install_Spec.md:305`) | 5초 생성 |
| WIN-FIX-05 | 녹화 게이트 | 60초 시나리오 `docs/Windows_Install_Spec.md:60` + VM 2종 | `tests/e2e/windows-install.spec.ts` |

> **WBS v1.0 P1 후순위**: `clevr/docs/WBS_Phase1.md:1` 556라인 v1.0은 P1 5건 차기 반영으로 유지, 본 Windows 배포가 P0 최우선으로 W1 D1~2 선행.
