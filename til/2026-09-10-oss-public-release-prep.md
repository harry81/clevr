# TIL — OSS Public 배포 준비: 브랜딩·라이선스·문서 격리 체크리스트

## 1. 브랜딩 전수 정리: 같은 이름을 세 곳에서 바꾼다

- 공개 레포에서 제품 정체성은 최소 세 곳에 분산되어 있다:
  ① `package.json`(name/version/license/build.appId/productName),
  ② `electron-builder.yml`(appId/productName/copyright/shortcutName),
  ③ `package-lock.json`(루트 name 2곳).
- 이번에 `branch-erp → sme-erp`, `com.gensystem.branch-erp → org.smeerp.app`,
  `지점관리프로그램 → SME-ERP`, `UNLICENSED → MIT`로 통일.
  lock 파일은 `npm install` 없이 name 2필드만 수작업 동기화 —
  의존성 그래프에 손대지 않아 4076줄 중 2줄 diff로 끝났다.
- yml 헤더의 구 브랜치 참조·내부 문서 번호(결론/PRD/WBS) 주석도 중립화.
  설정값이 아니라 주석이지만, 공개 레포 첫 화면에서 내부 약어가 보이면
  신뢰가 깨진다. 주석도 브랜딩의 일부다.

## 2. MIT 라이선스 채택: 파일 하나, 효과 셋

- 루트 `LICENSE`에 MIT 전문 + `Copyright (c) 2026 SME-ERP Contributors`.
  `package.json` license 필드와 문구를 일치시켜 패키지 메타데이터·깃허브
  라이선스 뱃지·법무 리뷰 세 경로에서 같은 답이 나오게 했다.

## 3. README는 마케팅 문서: 3대 Aha Moment + Local-First 프라이버시

- 기존 README는 내부 개발 로그(레거시 모듈 진척·데모 계정·구 DB 경로)라
  전면 교체했다. 구조: 1분 온보딩 소개 → 3대 Aha Moment(온보딩 1분 /
  월말 5초 일괄 채번·원장 기표 / 입금 즉시 FIFO 충당) → Local-First 보안
  (`%LOCALAPPDATA%\SME-ERP\data\mycompany.db` 명시, 외부 전송 없음, scrypt) →
  사용자용(Release + SmartScreen 안내)/개발자용(clone→install→start) →
  스택·테스트·라이선스.
- 공개 전 자가 검열: `B1`·`b1acc`·`1234`·`HQ`·`admin` 자격증거형 토큰,
  `DAWIN`, `지점관리`, 절대 경로가 본문에 없는지 grep으로 확인.
  `legacyFree.test.js`는 `renderer/`만 스캔하므로 README는 사람의 책임이다.

## 4. 사내 문서 격리: git rm --cached + .gitignore (디스크 보존)

- 공개 제외 대상(`TEAM.md`, WBS/Screen리뷰/설치 스펙, `screens/`, `ui-improvement/`)
  중 git 추적 파일을 `git rm --cached`로 인덱스에서만 제거 —
  실파일은 디스크에 그대로 남아 사내 작업이 끊기지 않는다.
- `.gitignore`에 동일 6항목을 추가해 재추적(re-add) 실수를 구조적으로 차단.
  `docs/DESIGN_SYSTEM.md`는 제외 목록에 없어 추적 유지,
  미추적 공개-검토 대상 4종은 Reviewer 단계로 위임.
- `electron-builder.yml`의 `files`가 이미 `docs/`를 포함하지 않음을 확인 —
  설치 패키지에 내부 문서가 타는 일은 원천 차단되어 있었다.

## 5. 공개 전 잔여 게이트 (이번 커밋 범위 밖, 실측 기반)

- `main.js:84` 트레이 메뉴 title과 `:102` 툴팁에 `지점관리프로그램` 잔존,
  `:28` 주석에 `GENSYS` 언급 — 코드 변경 금지 원칙상 이번 태스크에서 손대지
  않았으므로 Public 전 별도 태스크에서 브랜드 치환 필요.
- `build/`에 `icon.ico` 없음(`installer.nsh`만 존재) — yml이 참조하는
  `build/icon.ico`가 없어 트레이·패키징 아이콘이 기본값으로 떨어진다.
  Reviewer의 rcedit 확인과 별개로 공개용 아이콘 에셋 확보가 필요.
- Fresh Init 클린 레포 분리 — 사내 히스토리를 포함하지 않는 공개용
  초기 커밋 구성은 릴리스 단계에서 별도 수행.
