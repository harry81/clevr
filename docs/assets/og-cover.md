# OG 커버 이미지 (og-cover.png)

카카오톡·검색·SNS 미리보기(Open Graph)용 대표 이미지입니다.

- 파일: `docs/assets/og-cover.png`
- 크기: **1200 × 630** (OG 표준, 1.91:1)
- 출처: `assets/screens/01_dashboard.png`(SME-ERP 대시보드 스크린샷) 크롭
- 용량: 약 53 KB (≤ 200 KB)
- 사용처: `docs/index.html`의 `og:image` / `twitter:image`
  - 절대 URL: `https://raw.githubusercontent.com/harry81/clevr/main/docs/assets/og-cover.png`
  - (raw URL이므로 GitHub Pages 활성화 전에도 미리보기가 동작합니다.)

## 재생성 명령

ImageMagick 6 기준(실측: ImageMagick 6.9.12-98 Q16). 외부 의존성 없이 크롭만 수행합니다.

```bash
# 1) 원본을 1200x630 영역을 채우도록 리사이즈(^) 후 중앙 크롭, 메타데이터 제거
convert assets/screens/01_dashboard.png \
  -resize 1200x630^ \
  -gravity center \
  -extent 1200x630 \
  -strip \
  docs/assets/og-cover.png
```

확인:

```bash
identify docs/assets/og-cover.png   # => PNG 1200x630
ls -l docs/assets/og-cover.png      # => 200KB 이하
```

## 원본 교체 시

대시보드 스크린샷을 새로 캡처해 `assets/screens/01_dashboard.png`를 갱신한 뒤 위 명령을 다시 실행하면 됩니다.
소스가 1200×630과 종횡비가 다르면 `-resize 1200x630^`가 채우고 `-extent`가 중앙을 크롭합니다.

## 참고

- 텍스트 밴드 합성(폰트 의존)은 폰트 미설치 환경에서 깨질 수 있어 **크롭 방식으로 단순화**했습니다.
- 이미지 용량이 200KB를 넘으면 `-colors 256`(PNG8) 또는 `-define png:compression-level=9`를 추가할 수 있습니다.
