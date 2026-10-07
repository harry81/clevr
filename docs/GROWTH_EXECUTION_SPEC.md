# SME-ERP 그로스 실행 명세서 (GROWTH EXECUTION SPEC)

> **문서 성격**: 전략서 `docs/GROWTH_HACKING_STRATEGY.md`(무엇을·왜)를 **실행 단위**(누가·언제·어떻게·성공 판정)로 확장한 정본.
> **제품 버전**: `package.json` = `0.1.0` · **다운로드 정본 링크**: https://github.com/harry81/clevr/releases/latest
> **원칙 톤**: 완전 무료 · 회원가입 없음 · 평생 무료 · 데이터 로컬 소유(Local-First)
> **금지**: 미소유 도메인, 가짜 버전 태그, 레거시 서버 스택(서버 프레임워크·ORM·개발용 로컬 포트) 인용.

---

## 0. 제품 사실 (실행의 전제)

| 항목 | 값 |
|:---|:---|
| 스택 | Electron + Node 내장 `node:sqlite` (로컬 단일 파일, WAL) |
| 배포 | GitHub Releases (`releases/latest`) — 설치형 NSIS + 포터블 exe |
| 온보딩 시드 거래처 | **3곳**: 대양공업 · 한일금속 · 태성정밀 |
| 회원/서버 | 없음. 로그인은 로컬 scrypt 비밀번호 |
| 데이터 위치 | `%LOCALAPPDATA%\SME-ERP\data\mycompany.db` (사용자 PC) |

> 시드 거래처는 반드시 **3곳**으로 표기한다. (그 외 숫자 표기 금지)
> 스택·설치 문구는 `README.md`와 이 문서를 정본으로 하며, 레거시 설치 문서는 인용하지 않는다.

---

## 1. 채널별 실행표 (Channel Execution Matrix)

목표·시간 투입 대비 효율 순. 카피 전문은 `docs/growth/CHANNEL_COPY.md` 참조.

| # | 채널 | 타겟 | 실행 산출물 | 타이밍 | 성공 판정(최소) |
|:--:|:---|:---|:---|:---|:---|
| C1 | GeekNews | 개발자·오픈소스 얼리어답터 | 헌정 스토리 게시 | Day 0 | 업보트 ≥ 30, 댓글 ≥ 10 |
| C2 | 클리앙 개발한당 | 국내 개발자 | 동일 스토리(톤 조정) | Day 0~1 | 댓글 ≥ 15, 순방문 ≥ 200 |
| C3 | OKKY | 실무 개발자 | "만든 이유 + 기술 회고" | Day 1~3 | 조회 ≥ 500 |
| C4 | 디시 프로그래밍갤 | 개발자·얼리어답터 | 짧은 자작 배포글 | Day 1~7 | 추천 ≥ 20 |
| C5 | 네이버 제조업 카페/밴드 | 실수요 사장님 | 무료 엑셀 양식 배포 + 안내 | Day 3~14 | 다운로드 ≥ 100, 댓글 ≥ 20 |
| C6 | 소공인센터 단톡방 | 소공인 대표 | 양식 + 사용법 공유 | Day 5~20 | 공유 ≥ 10회 |
| C7 | 세무사 네트워크 | 기장 실무자 | "기장 시간 1/5" 실무 추천 | Day 7~21 | 파일럿 소개 ≥ 3 |
| C8 | 제품 내장(인쇄 푸터) | B2B 거래처 | 원장/청구서 하단 1줄 | 상시 | 푸터 유입 ≥ 1 |

---

## 2. 트로이목마(Trojan Horse) 스펙 — 무료 엑셀 양식

**작전**: 실수요자가 매일 검색하는 `거래처 원장 양식 무료`, `제조업 청구서 엑셀`, `미수금 관리 엑셀`에 대응하는
**상위 1% 품질의 무료 엑셀 양식**을 배포하고, 양식 안에서 제품으로 전환시킨다.

### 2.1 산출물

| 자산 | 경로 |
|:---|:---|
| 스펙 문서 | `docs/growth/EXCEL_TEMPLATE_SPEC.md` |
| 템플릿 데이터 | `assets/growth/templates/01_거래처.csv`, `02_단가표.csv`, `03_청구서.csv`, `04_미수금.csv` |
| 생성 스크립트 | `scripts/growth/gen_xls_template.js` (외부 의존성 0) |

### 2.2 시트 구성 (4종)

1. `01_거래처`: 온보딩 시드 **3곳**(대양공업/한일금속/태성정밀)과 동일 코드·사업자번호 체계.
2. `02_단가표`: 품목·단가 (정밀가공 50,000 / 밀링가공 35,000 / 레이저절단 20,000).
3. `03_청구서`: 거래처 × 품목 × 수량 → 공급가액·부가세(10%)·합계 자동 계산.
4. `04_미수금`: 청구/입금/차인지급잔액(FIFO) 흐름.

### 2.3 내부 전환 장치

- 템플릿 헤더 또는 시작 시트에 안내 1줄:
  > "아직도 거래처 청구서를 손으로 복사하시나요? 이 양식을 5초에 자동 생성하는 무료 오픈소스 ERP [SME-ERP] — 회원가입 없음, 평생 무료, 데이터는 내 PC에만 → https://github.com/harry81/clevr/releases/latest"
- 양식은 **엑셀 100% 호환**(CSV+BOM, 필요 시 SpreadsheetML 2003 `.xls`).

### 2.4 성공 판정

- 주간 양식 다운로드 ≥ 100 → 릴리스 페이지 유입 전환 ≥ 10% → 첫 실행 ≥ 5명.
- 전환율이 5% 미만이면 (a) 양식 품질, (b) 안내 문구 위치, (c) 게시 채널을 재점검한다.

---

## 3. Day 0 ~ Day 30 실행 시나리오

| 구간 | 날짜 | 핵심 실행 | 완료 기준(Exit) |
|:---|:---|:---|:---|
| **Day 0** | 런치 | Public 전환 확인, README 배너·데모·비교표 정합화, 릴리스 업로드, GeekNews/클리앙 게시 | 릴리스 링크 200, 게시 2건 |
| **Day 1~3** | 스토리 확산 | OKKY/디시 게시, GitHub Topics 태깅, 이슈 템플릿 정비 | Star ≥ 50, 이슈 0건 방치 |
| **Day 4~7** | 양식 배포 | 엑셀 양식 4종 배포, 네이버 카페 1차 게시 | 양식 다운 ≥ 30 |
| **Day 8~14** | 실수요 침투 | 소공인센터·밴드 공유, 카톡 공유/트레이 알림 명세 확정 | 파일럿 신청 ≥ 3 |
| **Day 15~21** | 파일럿 온보딩 | 3곳 직접 설치·온보딩, 원장 인쇄 푸터 활성 확인, 피드백 인터뷰 | 3곳 첫 청구 발행 완료 |
| **Day 22~30** | 증거화·재확산 | 사례 1건 작성, 세무사 네트워크 추천, SmartScreen FAQ 대응 | 사례 1건 공개, SmartScreen 문의 0건 미해결 |

---

## 4. AARRR KPI

| 단계 | 정의(이 제품 기준) | 지표 | 수집 방법 | 30일 목표 |
|:---|:---|:---|:---|:---|
| **Acquisition** | 릴리스 다운로드 | Release asset downloads | GitHub API (`scripts/growth/fetch_metrics.js`) | ≥ 300 |
| **Activation** | 첫 실행 후 온보딩 완료 | opt-in 설문 "설치했나요?" 응답 | 설문 폼 + 파일럿 | ≥ 30명 |
| **Retention** | 월말 재방문(청구 발행) | 파일럿 청구 발행 횟수 | 파일럿 인터뷰 | 파일럿 3곳 중 ≥ 2곳 2회차 |
| **Revenue** | 후원(선택) | GitHub Sponsors / 후원 | GitHub | 금전 목표 아님(코어 영구 무료) |
| **Referral** | 거래처·동료 추천 | 인쇄 푸터 유입, 추천 링크 복사 | 릴리스 referrer, 파일럿 | 추천 경로 유입 ≥ 10 |

> **텔레메트리 미도입**: 로컬퍼스트 신뢰를 지키기 위해 자동 수집을 넣지 않는다.
> Activation은 **opt-in 설문 + 파일럿 인터뷰**로 근사한다. (자세한 로그: `docs/growth/METRICS_LOG.md`)

---

## 5. 리스크 & 대응

| 리스크 | 영향 | 대응 |
|:---|:---|:---|
| SmartScreen/백신 오탐 | 설치 포기 | `docs/growth/SMARTSCREEN_FAQ.md` + 릴리스 SHA256 + README 안내 절차 |
| "개발자 잠적하면?" 불안 | 도입 거부 | 오픈소스·MIT·엑셀 1초 백업·로컬 단일 DB 강조 |
| 채널 홍보글 삭제/차단 | 유입 단절 | 홍보 아닌 '실무 도움' 톤, 채널별 카피 준수, 반복 게시 자제 |
| 양식 전환율 저조 | 트로이목마 실패 | A/B: 안내 위치·문구·게시 채널 교체 |
| 파일럿 이탈 | 증거 부재 | 온보딩 동반, 2주 체크인, 실패도 사례로 기록 |
| 금지 문자열/링크 불일치 | 신뢰 훼손 | 배포 전 `docs/growth` 전수 grep 점검 |

---

## 6. Task Breakdown (T01 ~ T08)

| Task | 산출물 | 담당 | DoD |
|:---|:---|:---|:---|
| **T01** | `docs/GROWTH_EXECUTION_SPEC.md` | worker | 본 문서. 채널표·트로이목마·Day0~30·AARRR·리스크·Task 목록 |
| **T02** | `docs/growth/CHANNEL_COPY.md` | worker | 8채널 이상, 각 (타겟/복붙 카피/타이밍/성공 판정), `releases/latest` ≥ 8회 |
| **T03** | `docs/growth/EXCEL_TEMPLATE_SPEC.md` + `assets/growth/templates/01~04.csv` + `scripts/growth/gen_xls_template.js` | worker | UTF-8 BOM, 헤더·시드 일치, 외부 의존성 0, 엑셀 호환 |
| **T04** | `docs/growth/METRICS_LOG.md` + `scripts/growth/fetch_metrics.js` | worker | AARRR 5단계·수집·목표·주간 루틴, 4주 로그표, `--dry-run` 토큰 없이 exit 0 |
| **T05** | `docs/growth/LAUNCH_RUNBOOK.md` | worker | Day0~30 일자별 표, SmartScreen/오탐 대응, 파일럿 동의서 템플릿 |
| **T06** | `docs/growth/WATERMARK_SPEC.md` + `renderer/js/views/ledger.js` + `tests/unit/renderer/watermark.test.js` | worker | TDD, 인쇄 하단 1줄 푸터, 외부 lib 0 |
| **T07** | `README.md` + `.github/workflows/release.yml` + `docs/growth/SMARTSCREEN_FAQ.md` + `CONTRIBUTING.md` | worker | 다운로드 배너·비교표 정합, SHA256 첨부, FAQ, 기여 가이드 |
| **T08** | `docs/growth/PILOT_CASE_TEMPLATE.md` | worker | 사례 골격 + 동의/익명 옵션 |

---

## 7. 참고 문서

- 전략 정본: `docs/GROWTH_HACKING_STRATEGY.md`
- 채널 카피: `docs/growth/CHANNEL_COPY.md`
- KPI 운영: `docs/growth/METRICS_LOG.md`
- 런치 실행: `docs/growth/LAUNCH_RUNBOOK.md`
- 워터마크: `docs/growth/WATERMARK_SPEC.md`
- 파일럿 사례: `docs/growth/PILOT_CASE_TEMPLATE.md`
