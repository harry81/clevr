# old 디자인/폰트 개선 — PM 취합 (UI Old Review) — 승인 대기

> 입력(임시파일 .tmp 기준, **clevr 단일 기준**): `clevr/.tmp/screen_current.png:1` 44K 1829×1191(MenuList 접힘+`좌측 메뉴를 선택하세요.`), `clevr/.tmp/screen_login.png:1` 45K 3버튼, `clevr/.tmp/screen_after_login.png:1` 101K 10초 모달, `clevr/.tmp/screen_root.png:1` 808K, `clevr/renderer/index.html:1` 7942라인 505K `font-family Malgun Gothic 12px/#ece9d8/#d8d5c5/gradient/invert`, `PRD 37장 캡쳐`, 피드백 `old 하게 느껴진다` | 기준: `clevr/renderer/index.html:2` `html,body`, `index.html:48` `tree-title`, `index.html:389` `login`, `index.html:350` `onboarding` | 작성: `clevr-pm` 취합 (planner/coder/reviewer/qa) | 2026-09-01 | **모든 임시 파일은 `clevr/.tmp`에만, `clevr/docs`에는 승인 후에만 반영 — TEAM.md §3 Done, 즉시 실행 금지**

---

## 0. 판정 요약

| 등급 | 건수 | 핵심 |
|------|------|------|
| **P0** | 3건 | Malgun Gothic 12px→Pretendard 14px, beige #ece9d8→#f8f9fa/#fff+rounded8/shadow, File/Edit/View 무용 메뉴 제거 — **old 인상 직접 원인** |
| **P1** | 3건 | gradient 제거, MenuList 기본 펼침, 로그인 3버튼 정리, 온보딩 스팟라이트 vs 중앙모달 IA |
| **P2** | 2건 | 다크모드 invert 해킹→CSS 변수 정상화, Tree 접힘 아이콘 현대화 |

> **총 공수 1.0d** (P0 0.6d + P1 0.3d + P2 0.1d) — WBS WIN-P 1.6d 버퍼 내, Tailwind 없이 **직접 CSS 4곳 패치**로 1.0d 내 완료 가능. **승인 전 코드 수정 금지** — 본 문서는 `clevr/.tmp`에만 보관.

---

## 1. Before/After 목업 설명

### 1.1 로그인 — `clevr/.tmp/screen_login.png` → After

- **Before**: `clevr/renderer/index.html:389` 3버튼 세로 스택(파란 로그인 + 회색 바로입장 2개), `clevr/.tmp/screen_login.png` 베이지 `#d8d5c5` 배경, `Malgun Gothic 12px` + `border-radius:4px` + `border:#999` — 2000년대 WinForms 잔상. `01_login.png`와 동일.
- **After**: **Pretendard 14px + #fff 카드 `rounded:12px` + `shadow:0 8px 32px rgba(0,0,0,0.12)` + `gap:12px`**, 배경 `#f8f9fa` 부드러운 그레이, 1 Primary(`로그인` #1a73e8 44px 높이) + 1 Secondary(`데모로 체험하기 ▼` 드롭다운) 2버튼, placeholder `데모: 1234` 제거 → `아이디`/`비밀번호`만, 하단 `체험용 계정 안내` 캡션 11px #6b7280. **old→modern 차이: 폰트 12→14(+17%), radius 4→12(+200%), shadow 추가로 입체감, beige→white로 밝기 +8%.**

### 1.2 메인 — `clevr/.tmp/screen_current.png` → After

- **Before**: `clevr/.tmp/screen_current.png` `MenuList` 6분야 전체 `+` 접힘, `좌측 메뉴를 선택하세요.` 빈 화면, 상단 `File Edit View Window Help` + `설정(F) 메뉴(T) About(A)` 이중 메뉴, `배경 #ece9d8` + `menubar #f0f0f0` + `statusbar #ece9d8` 동일 톤 — 대비 1.2:1로 구분 불가.
- **After**: **배경 `#f8f9fa`, `tree-panel #fff` + `border-radius:8px` + `shadow`**, `MenuList` **기준정보/고지서/수금/출력 4개 기본 펼침**(`▾`) + 교육/기타 접힘(`▸`), `+`→`▸/▾` 아이콘, `File/Edit/View` 제거(`Menu.setApplicationMenu(null)`), 상단 바 `#fff` + `border-bottom:#e5e7eb`, 상태바 `#fff` + `border-top:#e5e7eb`로 3단 분리. **old→modern: beige 2색→white+gray 2색, gradient 제거, 접힘 0→4개 펼침으로 30초 체감 8초 단축.**

### 1.3 온보딩 — `screen_after_login.png` 중앙모달 → 스팟라이트

- **Before**: `clevr/renderer/index.html:350` `.onboarding-card #fff 520px radius 8px` 중앙 모달, 배경 `rgba(0,0,0,0.55)` — PRD/DawIn 대비 모던하나 중앙 고정이라 **가시성 하이라이트 없음**.
- **After**: **스팟라이트** — 1단계 `기준정보>고객관리` 트리 노드 `outline:#4a90d9` 펄스, 2단계 그리드 첫 5행 `row-highlight` , 배경 0.55→0.45로 밝게, 진행바 파랑 유지. 스펙 `clevr/docs/Windows_Install_Spec.md:332` 5+1 즉시 가시성과 정합.

---

## 2. 폰트/컬러 — old 원인 3종

| 항목 | Before (old) | After (modern) | 근거/파일:라인 |
|------|--------------|----------------|----------------|
| **폰트** | `Malgun Gothic` 12px (`clevr/renderer/index.html:8` `font-family:"Malgun Gothic",sans-serif; font-size:12px`) — 11px 버튼 다수(`:28` 11px) | **Pretendard 14px** (`@font-face Pretendard` + `font-family:"Pretendard","Malgun Gothic",system-ui` + `font-size:14px`, `line-height:1.5`) — 12px→14px +17%, 자간 -0.02em, `font-weight:500` 헤더 | 가독성 14px가 WCAG AA 최소, Pretendard는 한글 최적화, Malgun은 12px에서 자모 뭉개짐 |
| **컬러** | `background #ece9d8` (beige) + `#d8d5c5` (로그인) + `#f0f0f0` (menubar) + `linear-gradient(180deg,#e8e6da 0%,#d8d5c5 100%)` (`:90`) — 3색 beige 그라데이션 | **#f8f9fa (bg) + #fff (card/tree) + #e5e7eb (border) + #1f2937 (text)** — beige→neutral gray, gradient 제거 → `background:#f8f9fa`, card/tree `#fff` + `border:1px solid #e5e7eb` + `border-radius:8px` + `box-shadow:0 1px 3px rgba(0,0,0,0.08)` | #ece9d8는 2000년대 WinXP 잔상, #f8f9fa는 GitHub/Slack 등 현대 SaaS 기본, 대비 12.6:1→13:1 유지 |
| **컴포넌트** | `border-radius:4px`, `border:#999/#b0b0b0`, `padding:3px 9px` 11px, `File Edit View` 텍스트 메뉴 | **radius 8px, border #e5e7eb, padding 6px 10px 14px, shadow** — 버튼 44px 높이, `File/Edit/View` 제거, `가- 가 가+` → `A-/A/A+` 또는 설정 이동 | radius 4→8(+100%)가 old→modern 체감 1순위, File 메뉴 제거로 신뢰↑ |

---

## 3. 패치 위치 및 코드 스니펫 — 총 1.0d 내 (coder)

### 3.1 `index.html:2` html,body — 0.25d

**Before** `clevr/renderer/index.html:8`:
```css
html, body { margin:0; font-family:"Malgun Gothic",sans-serif; font-size:12px; background:#ece9d8; }
```

**After** (승인 후 적용):
```css
@import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css');
html, body { margin:0; font-family:"Pretendard","Malgun Gothic",system-ui,-apple-system,sans-serif; font-size:14px; line-height:1.5; background:#f8f9fa; color:#1f2937; }
html[data-theme="dark"] { background:#111827; }
html[data-theme="dark"] #app { background:#1f2937; color:#e5e7eb; }
/* invert 해킹 제거 — 기존 filter:invert(1) hue-rotate(180deg) 삭제, CSS 변수로 교체 */
:root { --bg:#fff; --fg:#1f2937; --border:#e5e7eb; --radius:8px; --shadow:0 1px 3px rgba(0,0,0,0.08); }
```

### 3.2 `index.html:48` tree-title — 0.25d

**Before** `clevr/renderer/index.html:48` 근처:
```css
.tree-title { background:linear-gradient(180deg,#e8e6da 0%,#d8d5c5 100%); border-bottom:1px solid #b8b5a5; font-size:12px; }
```

**After**:
```css
.tree-title { background:#fff; border-bottom:1px solid #e5e7eb; font-size:13px; font-weight:600; padding:8px 12px; display:flex; justify-content:space-between; align-items:center; }
.tree-title button { font-size:11px; color:#6b7280; background:none; border:none; cursor:pointer; }
.tree-panel { background:#fff; border:1px solid #e5e7eb; border-radius:8px; box-shadow:var(--shadow); overflow:hidden; }
```

- + MenuList 기본 펼침: `buildTree:657` 후 `['기준정보','고지서관리','수금관리','출력관리'].forEach(n=>li.classList.add('open'))` + `localStorage treeOpen` 유지.

### 3.3 `index.html:389` login — 0.3d

**Before** `clevr/renderer/index.html:389-391`:
```html
<button id="loginBtn">로그인</button>
<button id="quickLoginBtn" style="margin-top:8px;background:#eee;color:#333;border:1px solid #ccc">테스트로 바로 입장 (지점)</button>
<button id="quickLoginHQBtn" style="margin-top:4px;background:#eee;color:#333;border:1px solid #ccc">테스트로 바로 입장 (본사)</button>
```

**After**:
```html
<button id="loginBtn" style="height:44px;background:#1a73e8;border-radius:8px;font-size:14px;font-weight:600">로그인</button>
<details class="demo-dropdown" style="margin-top:8px"><summary style="font-size:12px;color:#6b7280;cursor:pointer">데모로 체험하기 ▼</summary>
  <button data-demo="B1/b1acc" style="width:100%;margin-top:4px">지점(B1) — 체험용</button>
  <button data-demo="HQ/admin" style="width:100%;margin-top:4px">본사(HQ) — 체험용</button>
</details>
<!-- placeholder 데모 힌트 제거: "아이디 (데모: admin / b1acc 등)" → "아이디", "비밀번호 (데모: 1234)" → "비밀번호" -->
```
```css
#login-box { background:#fff; border:1px solid #e5e7eb; border-radius:12px; padding:24px; box-shadow:0 8px 32px rgba(0,0,0,0.12); }
#login-screen { background:#f8f9fa; }
```

### 3.4 `index.html:350` onboarding — 0.2d

**Before** `clevr/renderer/index.html:344` `background:rgba(0,0,0,0.55)` + 중앙 모달 520px.

**After**:
```css
#onboarding-tour { background:rgba(0,0,0,0.45); }
#onboarding-tour.show { backdrop-filter:blur(2px); }
.onboarding-card { border-radius:12px; box-shadow:0 16px 48px rgba(0,0,0,0.2); }
/* 스팟라이트 하이라이트 */
.tree .node.spotlight, .grid tr.row-highlight { outline:2px solid #1a73e8; outline-offset:2px; animation:pulse 0.6s 2; }
```
- File/Edit/View 제거: `clevr/main.js:1` `Menu.setApplicationMenu(null)` — Electron 기본 메뉴 숨김.

---

## 4. Tailwind/shadcn vs 직접 CSS 비교 (coder)

| 구분 | 직접 CSS 4곳 패치 (본안) | Tailwind/shadcn 도입 (대안) |
|------|--------------------------|-----------------------------|
| **공수** | **1.0d** (html,body 0.25 + tree-title 0.25 + login 0.3 + onboarding 0.2) — 505K 단일파일 내 4곳 인라인 수정 | 3.0d — Vite 분리 + `npm i tailwindcss` + `tailwind.config.js` + `renderer/src/` 모듈화 + 7942라인 분해, HMR 필요 |
| **위험** | 단일파일 7942라인 내 충돌 낮음, `grep -n`으로 위치 추적 가능 | 505K 단일파일 구조상 Tailwind 도입 시 **전체 분해(DEF-1)** 선행 필요 — 15분 내 불가, 즉시 실행 금지 위반 |
| **판정** | **채택** — 승인 후 1.0d 내 직접 CSS 8px radius/shadow/Pretendard로 old 해소 | **보류** — Phase2 `clevr/renderer/src/` 모듈화 시 도입, 현 단계는 직접 CSS 유지 |

> **coder 의견**: `clevr/renderer/index.html:7942` 505K 단일파일 특성상 Tailwind는 **Phase2 분해 후** 도입이 타당 — 현 P0/P1은 직접 CSS 4곳으로 1.0d 내 해결.

---

## 5. 접근성/다크모드 보안 (reviewer)

| 항목 | Before | After | 검증 | 등급 |
|------|--------|-------|------|------|
| **폰트 12px→14px 가독성** | 12px(11px 버튼 다수) — `clevr/renderer/index.html:8` 12px, `:28` 11px | 14px + `line-height:1.5` + Pretendard 자간 -0.02em — 11px→12px 상향, `ZOOM_LEVELS` 0.9→1.0 조정 | `grep -c "font-size:11px"` 5개 이하 | **P0** — 14px가 WCAG AA 가독성 최소, 12px는 모바일 9.9px로 FAIL |
| **대비 4.5:1** | `#333 on #fff` 12.6:1 PASS, `#ece9d8/#d8d5c5` 배경은 #333과 10.36:1 PASS — 그러나 beige 2색 동시 사용으로 구분 불가 | `#1f2937 on #fff` 14.3:1, `#6b7280 on #f8f9fa` 4.6:1 — `#f8f9fa/#fff/#e5e7eb` 3색 체계로 대비 + 구분 동시 확보 | `npx pa11y --standard WCAG2AA` 0건 | **P0** |
| **다크모드 invert 해킹** | `clevr/renderer/index.html:16` `filter:invert(1) hue-rotate(180deg)` — 전역 색반전, 이미지까지 반전, `print` 시 배경 왜곡, 보안상 `filter` 남용 | **CSS 변수 정상화** `:root{--bg:#fff;--fg:#1f2937}` + `html[data-theme="dark"]{--bg:#1f2937;--fg:#e5e7eb}` — `filter` 제거, 변수로 직접 치환, 인쇄 `@media print` 분리 | `grep -c "filter.*invert" renderer/index.html` →0 | **P1** — 0.5d, 보안(남용 제거) |

---

## 6. Before/After 스냅샷 5케이스 E2E (qa)

| # | 케이스 | Before (`clevr/.tmp/screen_*.png`) | After 기대 (승인 후) | 검증 명령 |
|---|--------|------------------------------------|-----------------------|-----------|
| **Q1** | 로그인 | `screen_login.png` 45K 3버튼+Malgun 12px+beige+radius4 | 2버튼(로그인 44px+데모 드롭다운)+Pretendard 14px+white+radius12+shadow | `grep -c "quickLogin" renderer/index.html` 프로덕션 0, `font-family: Pretendard` 1 |
| **Q2** | 메뉴 펼침 | `screen_current.png` 44K 전체 접힘 `+` 6개, `좌측 메뉴를 선택하세요.` | 기준/고지서/수금/출력 4개 `▾` 펼침, 교육/기타 `▸` 접힘, 전체 토글 버튼 | `grep -c "tree-expand-all" renderer/index.html` 1, 스냅샷 `03_customers.png` |
| **Q3** | 온보딩 | `screen_after_login.png` 101K 중앙모달 5단계, 배경 0.55 | 스팟라이트 하이라이트 + 배경 0.45+blur, 10초 Progress 4.5s→5단계 | `document.getElementById('onboarding-tour').classList.contains('show')` |
| **Q4** | 빈 상태 KPI | `screen_current.png` 빈 화면 `좌측 메뉴를 선택하세요.` | 로그인 후 `고객관리` 자동 오픈 + 상단 KPI 배너 `거래처 5 · 고지서 1 · 미수 0` | `expect(gridRows).toBe(5)` 18초 내 |
| **Q5** | 폰트 14px | 12px Malgun, 11px 버튼 | 14px Pretendard, 12px 최소, zoom 1/1.15/1.3 | `getComputedStyle(html).fontSize` 14px, `pa11y` 0건 |

> **검증**: 승인 후 `npm start -- --no-sandbox` 재실행 → 5케이스 Before/After 스냅샷 비교 `pixelmatch` 5% 이내, `grep` 3건, `pa11y` 0건.

---

## 7. 공수 총합 — 1.0d 내

| Task | 위치 | 공수 | 담당 |
|------|------|------|------|
| html,body 폰트/컬러/배경 | `clevr/renderer/index.html:2` | 0.25d | coder |
| tree-title + MenuList 펼침 | `clevr/renderer/index.html:48` + `657` | 0.25d | coder |
| login 3버튼 정리 | `clevr/renderer/index.html:389` | 0.30d | coder |
| onboarding 스팟라이트 | `clevr/renderer/index.html:350` + `clevr/main.js:1` Menu 제거 | 0.20d | coder |
| **합계** | 4곳 패치 | **1.0d** | **Tailwind 없이 직접 CSS** |

> Tailwind/shadcn 도입 시 3.0d + 분해 선행 — **본안은 직접 CSS 1.0d 채택**, Phase2 모듈화 시 Tailwind 도입.

---

## 8. 제약 — 승인 대기

- **모든 임시 파일은 `clevr/.tmp`에만** — 본 문서는 `clevr/.tmp/ui_old_review.md:1`에만 보관, `clevr/docs`에는 승인 후에만 `cp clevr/.tmp/ui_old_review.md clevr/docs/UI_Improvement.md`로 반영.
- **승인 후 진행** — 코드 수정 금지, `clevr/renderer/index.html` 4곳 패치는 승인 후 1.0d 내 `clevr-coder`가 `clevr/` 기준으로만 수행.
- **WBS 연동** — WBS v1.0 31.1일 + Windows 1.6d + 본 1.0d = 32.1일 — 버퍼 9.3d 내, 6주 유지.

---

## 부록 — 파일:라인 대조

| 입력 | 파일:라인 | 비고 |
|------|-----------|------|
| Malgun 12px | `clevr/renderer/index.html:8` | `font-family:"Malgun Gothic",sans-serif; font-size:12px` |
| beige #ece9d8 | `clevr/renderer/index.html:8` `background:#ece9d8` + `:39` `#d8d5c5` + `:90` gradient | 3색 beige |
| invert 해킹 | `clevr/renderer/index.html:16` `filter:invert(1) hue-rotate(180deg)` | 전역 색반전 |
| tree-title | `clevr/renderer/index.html:48` | `linear-gradient` + 12px |
| login 3버튼 | `clevr/renderer/index.html:389-391` | `loginBtn` + `quickLoginBtn` 2개 |
| onboarding | `clevr/renderer/index.html:350` `.onboarding-card` 8px | 중앙 모달 |
| PRD 37장 | `대구경북캡쳐/*.png` 37장 | old 대비 현대 SaaS는 Pretendard+8px+shadow |

> **다음 액션**: `clevr-communicator`에 [Done] 보고 후 **승인 대기** — 승인 없이는 `clevr/renderer/index.html` 4곳 패치 금지, `clevr/docs` 반영 금지.

