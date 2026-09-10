# TIL — Electron Windows 패키징·릴리즈: Wine 회피·icon.ico·Actions 파이프라인

## 1. Wine32/i386 의존성: Linux에서 win 빌드가 깨지는 이유와 회피책

- electron-builder의 win 타깃(NSIS + portable, `electron-builder.yml:20-25`)은
  내부적으로 Windows 전용 바이너리를 실행한다: NSIS 컴파일러(`makensis`),
  `rcedit`(exe 메타·아이콘 주입), `signtool` 호출 경로.
  Linux 호스트에서는 이들을 Wine 위에서 돌리므로 `wine`, 32비트 호스트
  라이브러리(`wine32`, `ia32-libs` 계열), NSIS용 시스템 패키지가 필요하다.
- 왜 32비트인가: rcedit·NSIS 스텁이 32비트 PE이기 때문이다.
  64비트 전용 Wine(`wine64`만)에서는 PE32 로더·WoW64 대응 DLL이 없어
  `rcedit-x86.exe` 실행 단계에서 실패한다. 그래서 Debian/Ubuntu 가이드가
  `dpkg --add-architecture i386 && apt install wine32`를 요구한다.
- `windows-latest` 러너를 쓰면 회피되는 이유: 네이티브 Win32 API·COM·
  Authenticode 체인이 그대로 있어 Wine 에뮬레이션 계층이 불필요하다.
  이번 워크플로(`.github/workflows/release.yml:13`)가 `runs-on: windows-latest`인
  것은 취향이 아니라 Wine32 의존성 전체를 제거하는 구조적 선택이다.
- 실측: 이 레포 `dist/`에 `SME-ERP-Setup-0.1.0.exe`(114,948,844B),
  `SME-ERP-Portable-0.1.0.exe`(114,588,679B)가 산출되어 있으나 Linux 직접
  `build:win`(`package.json:8`)은 위 의존성 없이는 rcedit 단계에서 막힌다.
  CI를 Windows 러너로 고정하면 로컬 Linux 환경과 무관하게 재현된다.

## 2. 다중 레이어 icon.ico 규격: 단일 PNG 리네임이 깨지는 이유

- ICO는 이미지 한 장이 아니라 디렉터리 + N개 엔트리의 컨테이너:
  `ICONDIR(6B: reserved/type/count) + ICONDIRENTRY(16B × N: w/h/planes/bpp/bytes/offset)`.
  표준 세트는 16/32/48/256px, 32-bit BGRA(알파 포함). 256px 슬롯은
  Vista 이후 PNG 압축을 허용하지만 BMP/BGRA도 유효하다.
- 실측(`build/icon.ico`, 372,526B): `count=7`,
  `16/24/32/48/64/128/256px` 전부 `planes=1, bpp=32`,
  256px 엔트리(`bytes=270376`) 선두가 `28 00 00 00`(BITMAPINFOHEADER 40B)로
  PNG 매직(`89 50 4E 47…`)이 아니다 — 즉 이 파일은 7층 전부 BMP/BGRA,
  PNG 압축 슬롯 없음. `256×256×4=262,144B + 헤더`와 정합한다.
- 단일 PNG를 `.ico`로 리네임하면 깨지는 이유: 확장자만 바뀌고 ICONDIR
  구조가 없으므로 Win32 `LoadImage`·익스플로러 썸네일·rcedit 리소스 주입이
  디렉터리를 파싱하지 못한다. electron-builder는 `win.icon`(`electron-builder.yml:26`)
  을 읽어 rcedit로 exe 리소스 섹션에 주입하는데, 구조가 깨지면
  빌드 실패 또는 기본 Electron 아이콘으로 폴백한다.
- 사용처 세 갈래: ① exe 메타·작업표시줄·Alt-Tab(16/32/48px 소형 슬롯),
  ② NSIS 설치 마법사 헤더·언인스톨러 아이콘(`nsis` 섹션, `electron-builder.yml:28-41`),
  ③ 탐색기 고해상도 썸네일(256px). 한 슬롯만 있으면 특정 DPI·뷰에서
  흐릿하거나 깨진다 — 그래서 다중 레이어가 규격상 요구된다.
- 생성법: ` Pillow`(예: `Image.save("icon.ico", sizes=[(16,16),(32,32),(48,48),(256,256)])`),
  ImageMagick(`convert icon-*.png icon.ico`), 또는
  `electron-icon-builder --input=icon.png --output=build` — 어느 쪽이든
  산출 후 `count/bpp`를 위처럼 파싱해 검증한다.

## 3. GitHub Actions 릴리즈 자동화 파이프라인: 태그 → 테스트 게이트 → 업로드

- 트리거(`.github/workflows/release.yml:3-6`): `on: push: tags: ['v*']`.
  `v0.1.0` 푸시 한 방이 릴리즈 전체를 기동한다. 브랜치 푸시에는 반응하지
  않아 일반 개발 사이클과 분리된다.
- 러너·툴체인(`:12-22`): `runs-on: windows-latest` + `setup-node@v4`
  (`node-version: 20`, `cache: npm`). Node 20 고정은 `electron@^44.3.0`·
  `electron-builder@^24.13.3`(`package.json:17-19`) 요구와 정합한다.
- 게이트(`:24-31`): `npm ci` → `npm test`(`package.json:10`,
  `node --test "tests/unit/**/*.test.js"`) → `npm run build:win`.
  테스트 실패 시 빌드 스텝에 도달하지 않으므로 깨진 바이너리가
  릴리즈에 붙는 일이 없다. 실측: `npm test` 115 tests / 115 pass / 0 fail.
- 업로드(`:33-43`): `softprops/action-gh-release@v2`에
  `files:` 멀티라인 `dist/SME-ERP-Setup-*.exe`, `dist/SME-ERP-Portable-*.exe`,
  `dist/*.blockmap`(각각 yml `:35`, `:44`의 `artifactName` 패턴과 정합),
  `fail_on_unmatched_files: true`(glob 미매칭 시 즉시 실패 — 빈 릴리즈 방지),
  `generate_release_notes: true`, `GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}`.
- 권한(`:8-9`): `permissions: contents: write` 명시.
  GITHUB_TOKEN 기본 권한이 `read-only`(Org/Repo Settings → Actions →
  General → Workflow permissions)인 환경에서도 릴리즈 생성·에셋 업로드가
  가능하도록 워크플로 파일에서 승격 선언한다. 레포 설정이
  `Read and write permissions`이면 중복이지만 무해하고, `read-only`이면 필수다.
- blockmap 역할: `dist/SME-ERP-Setup-0.1.0.exe.blockmap`(120,831B 실측)과 같이
  NSIS 산출물 옆에 생성되는 differential-update용 맵. 이 레포는
  `publish: null`(`electron-builder.yml:52`)로 electron-updater를 제거한
  Pure-NSIS 자체 업데이터 경로이므로 자동 업데이트에 쓰이지 않지만,
  무결성 대조·향후 differential 복구용 산출물로 릴리즈에 동봉 유지한다.
- YAML 검증: `python3 -c "yaml.safe_load(...)"` 파싱 통과.
  참고로 PyYAML은 bare `on:`을 YAML 1.1 `True`로 읽어 `{"true": …}`로 보이지만
  GitHub Actions 파서는 정상 인식하므로 수정 불필요 — 린트 오탐에 속지 말 것.
