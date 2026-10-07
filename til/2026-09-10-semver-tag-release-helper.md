# TIL — SemVer·Git 태그 트리거·릴리즈 헬퍼 설계

- 실측 기준: `package.json:2` `version 0.1.0`, `git tag --list` → `v0.1.0` 존재, `main` 브랜치.

## 1. SemVer (MAJOR.MINOR.PATCH, 0.x 의미, bump 규칙)

- 형식: `MAJOR.MINOR.PATCH` — 숫자 3자리 점 구분, 정규식은 `scripts/release.js:7`의
  `/^v?(\d+)\.(\d+)\.(\d+)$/` (앞뒤 공백은 `trim` 후 허용, `v` prefix 선택 허용,
  prerelease(`-beta`)·build(`+build`)는 불일치로 reject).
- 0.x 의미: `MAJOR=0`은 초기 개발 구간이라 `0.1.0 → 0.1.1` 같은 patch bump도
  사실상 breaking일 수 있다 — 그래서 `resolveTargetVersion`(`scripts/release.js:95-121`)은
  "이미 릴리즈된 버전에서 arg 없이 돌리면 patch bump"를 기본값으로 고정해
  실수로 같은 태그를 재사용하지 않게 한다.
- bump 규칙 (`bumpVersion`, `scripts/release.js:42-50`):
  - `patch`: `0.1.2 → 0.1.3` (그대로 +1).
  - `minor`: `0.1.2 → 0.2.0` (patch=0 리셋).
  - `major`: `0.1.2 → 1.0.0` (minor=patch=0 리셋).
  - 입력 객체는 복사 후 반환(불변), 문자열 입력도 `parseVersion` 경유 허용,
    `patch|minor|major` 외는 throw.

## 2. Git 태그 기반 배포 트리거 (v* → Actions, lightweight vs annotated, blockmap/artifact 연동)

- 트리거: `.github/workflows/release.yml:3-6`의 `on: push: tags: ['v*']` —
  `git push origin v0.1.1` 한 방이 릴리즈 전체를 기동한다.
  스크립트가 만드는 태그는 `formatTag`(`scripts/release.js:24-28`)의 `vX.Y.Z` 형태라
  이 glob과 정확히 연동된다 (`stripTagPrefix`로 `v` 제거·검증, `:30-34`).
- lightweight vs annotated:
  - 본 헬퍼는 `git tag vX.Y.Z` (lightweight) 사용 — Actions `push.tags` 매칭에는
    충분하고 추가 서명 인프라가 필요 없다.
  - annotated(`-a`)/signed(`-s`)가 필요해지면 태그 생성 한 줄만 교체하면 된다;
    순수 함수(버전 결정)와 효과(CLI git 호출)가 분리되어 있어 영향 범위가 좁다.
- artifact 연동: 워크플로 `:33-43`의 `softprops/action-gh-release@v2`가
  `dist/SME-ERP-Setup-*.exe`, `dist/SME-ERP-Portable-*.exe`, `dist/*.blockmap`을
  업로드한다. 태그명(`vX.Y.Z`)이 곧 GitHub Release명이 되므로 버전 문자열의
  단일 진실 공급원(single source of truth)은 `package.json`이다 —
  CLI는 `package.json`을 먼저 읽고(`[1/8]`), 태그는 그 결과에서만 파생시킨다.

## 3. 릴리즈 헬퍼 설계 (순수/효과 분리, 게이트 순서, dry-run/push 옵션, 첫릴리즈 분기)

- 순수/효과 분리:
  - 순수(테스트 가능, `module.exports`): `parseVersion`·`formatTag`·`stripTagPrefix`·
    `bumpVersion`·`resolveTargetVersion`·`isValidVersion`·`compareVersions`·`isFirstRelease`.
  - 효과(CLI, `require.main===module` 가드 안쪽): `execFileSync`로 감싼
    `git describe`·`git status`·`npm test`·`git commit/tag/push` —
    전부 `execFileSync(cmd, args)` 배열 형태로 셸 인젝션 없이 호출.
- 게이트 순서 (`main`, `scripts/release.js:150-253`):
  1. `package.json` 읽기·검증 → 2. `git describe --tags --abbrev=0` (실패 시 `null`) →
  3. `git status --porcelain` dirty면 중단 (`--yes`로도 우회 불가, 안내만) →
  4. `git branch --show-current`가 `main/master` 아니면 경고 후 `--yes` 없이 중단 →
  5. 목표 버전 결정 → 6. `npm test` (실패 시 중단, `--dry-run`이면 스킵 명시) →
  7. `package.json` 업데이트(dry-run 제외) → `git add package.json && git commit`
  (변경 있을 때만) → 8. `git tag vX.Y.Z` (이미 존재 시 중단) →
  `--push`면 `git push` + `git push origin tag`, 아니면 push 안내 출력.
- dry-run/push 옵션:
  - `--dry-run`: 테스트·파일쓰기·커밋·태그 전부 스킵하고 계획만 출력
    (`[6/8] skip npm test`, `[7/8] dry-run: would set ...`).
  - `--push`: 기본값은 안내만 출력하고, 명시 시에만 푸시 (실수 푸시 방지).
  - `--yes`: 분기 경고만 승인, dirty 게이트는 우회 불가 (안전핀).
- 첫릴리즈 분기 (`resolveTargetVersion` 정책, 테스트 `tests/unit/scripts/release.test.js:60-76`에 고정):
  - `arg`가 `X.Y.Z` → 그 버전 / `arg`가 `patch|minor|major` → current 기준 bump.
  - `arg` 없음 + `latestTag == null` → current 그대로 (첫 릴리즈 태깅).
  - `arg` 없음 + `latestTag == current` → patch bump (현재 상태 회귀:
    `0.1.0` + `v0.1.0` → `0.1.1`).
  - `arg` 없음 + `latestTag < current` → current 그대로 (개발 선행분 태깅).
  - `arg` 없음 + `latestTag > current` → current 그대로 (package.json 우선,
    중복 태그는 tag-exists 게이트에서 중단).
- 사용법: `node scripts/release.js [patch|minor|major|X.Y.Z] [--dry-run] [--push] [--yes] [--help]`,
  npm 경유는 `npm run release -- patch --dry-run` (`package.json:13`).
