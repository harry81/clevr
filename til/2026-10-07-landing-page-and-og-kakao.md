# TIL 2026-10-07 — 비개발자 랜딩페이지 & Open Graph(카카오톡) 최적화

> T12/T13 산출물 정리: `docs/index.html`, `docs/assets/og-cover.png`, `docs/assets/og-cover.md`.

---

## (A) 비개발자 타겟 초경량 단일 랜딩페이지 설계 원칙

파일: `docs/index.html` (순수 HTML + 인라인 CSS, **script 0**)

### 왜 스크립트 0인가

- 공격 표면(script 실행)을 통째로 제거한다. 정적 문서는 XSS/서드파티 스크립트 리스크가 없다.
- 빌드/번들/외부 CDN 불필요 → 로딩이 가장 빠르고, 로컬 파일로도 그대로 열린다.
- 검증도 단순하다: `rg -c '<script' docs/index.html → 0` (인라인 핸들러 `on*=`, `<iframe>`도 0).

### 카피 톤 (비개발자)

- 전문용어 배제: “복식부기/분개” 대신 “청구·입금·미수금”, “온보딩” 대신 “회사명만 넣으면 끝”.
- Hero는 **3초 다운로드 우선**: 상단에 설치형/포터블 대형 버튼 2개(`.btn-primary` / `.btn-ghost`), 그 아래 “평생 무료 · 회원가입 없음 · 데이터는 내 PC에만”.

### 정보 구조 (섹션 순서)

1. `#top` Hero — 헤드라인 + 대형 다운로드 버튼 2개 + 신뢰 문구 + SHA256 링크
2. `#features` 3대 핵심 경험 — 인라인 SVG 아이콘 + 1문장씩
   - 엑셀 복붙 대량 등록(T09) / 5초 월말 청구(T10) / 카톡 원장 전송(T11)
3. `#install` SmartScreen 안심 가이드 — [추가 정보] → [실행] 절차, `Get-FileHash` SHA256 대조, `growth/SMARTSCREEN_FAQ.md` 링크
4. `#trust` 신뢰/접근성 — 100% 로컬·MIT·엑셀 백업
5. 반응형/성능 — `viewport`, `@media(max-width:900px)` 2열, `@media(max-width:640px)` 1열, `loading="lazy"`+`alt`
6. `footer` — 저장소/릴리스(latest)/라이선스

### 접근성/시맨틱

- `header/main/section/article/footer/nav` 사용, `nav`에 `aria-label`.
- 모든 `img`에 `alt`, 대시보드 스크린샷은 `loading="lazy"`.
- 다크 Hero(흰 텍스트) / 라이트 본문(진한 텍스트)로 명도 대비 확보, `:focus-visible` 아웃라인 제공.

---

## (B) Open Graph(카카오톡) 최적화

파일: `docs/index.html` `<head>`

### 필수 메타

```
og:type            = website
og:url             = https://harry81.github.io/clevr/
og:title / og:description (비개발자 친화 문구)
og:image           = <절대 URL>
og:image:width     = 1200
og:image:height    = 630
og:locale          = ko_KR
twitter:card       = summary_large_image (+ title/description/image)
```

- `property="og:` 8개 + twitter 4개. 검증: `rg -c 'property="og:' docs/index.html → 8`.

### og:image는 반드시 절대 URL

카카오/검색 스크래퍼는 상대경로를 페이지 기준으로 해석하지 못한다. 반드시 `https://...` 절대 URL이어야 한다.

- **Pages 활성 시(same-origin)**: `https://harry81.github.io/clevr/assets/og-cover.png`
- **Pages 미활성 폴백**: `https://raw.githubusercontent.com/harry81/clevr/main/docs/assets/og-cover.png`
  - 저장소/브랜치/경로에 의존하므로 파일 이동 시 유지보수 필요.
- 이미지 크기는 **1200×630**(1.91:1) 권장 — `og:image:width/height`를 함께 명시하면 스크래퍼가 비율을 미리 인지.

### 카카오 OG 캐시 주의

- 카카오는 OG 정보를 캐시한다. **og:image URL을 바꾸면 미리보기 갱신이 지연**될 수 있다.
- 따라서 **최초 공개 시 URL을 확정**하고, 변경 시 카카오 OG 캐시 초기화(디벨로퍼스 도구)를 고려한다.
- og:url도 함께 확정하는 편이 좋다(Pages URL).

### T13 og-cover 생성 (ImageMagick, 폰트 회피)

파일: `docs/assets/og-cover.png` (1200×630, ≈53KB). 원본: `assets/screens/01_dashboard.png`.

```bash
convert assets/screens/01_dashboard.png \
  -resize 1200x630^ -gravity center -extent 1200x630 -strip \
  docs/assets/og-cover.png
```

- `resize ^`(영역 채우기) + `extent`(중앙 크롭) → 종횡비가 달라도 1:1.91 결과 보장.
- **폰트 미설치/한글 폰트 이슈를 피하려고 텍스트 밴드 합성 대신 크롭만** 사용 → 어디서나 재현 가능.
- 용량 200KB 초과 시 `-colors 256` 또는 `-define png:compression-level=9`로 축소.
- 재생성 명령·설명은 `docs/assets/og-cover.md`에 기재.

### 검증 요약

- `rg -c 'property="og:'` → 8, `rg -c '<script'` → 0
- `identify docs/assets/og-cover.png` → 1200x630, 54634B (≤200KB)
- node 태그 균형 점검 → ok
