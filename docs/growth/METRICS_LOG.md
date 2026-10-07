# METRICS_LOG — AARRR KPI 측정·운영 로그

> **Task**: T04 · **링크 정본**: https://github.com/harry81/clevr/releases/latest
> **전제**: **텔레메트리 미도입.** 로컬퍼스트 신뢰를 지키기 위해 앱은 어떤 데이터도 자동 전송하지 않는다.
> 따라서 서버 지표는 GitHub(공개 API)로, 제품 지표는 **opt-in 설문 + 파일럿 인터뷰**로 근사한다.

---

## 1. AARRR 5단계 지표

| 단계 | 정의(이 제품) | 지표 | 수집 방법 | 30일 목표 |
|:---|:---|:---|:---|:---|
| **Acquisition** | 릴리스 다운로드 | Release asset downloads 합계 | `scripts/growth/fetch_metrics.js` (GitHub API) | ≥ 300 |
| **Activation** | 설치 후 온보딩 완료 | "설치했나요?/써보셨나요?" opt-in 설문 응답 | 익명 설문 폼 + 파일럿 동의자 | ≥ 30명 |
| **Retention** | 월말 재방문(청구 발행) | 파일럿 업체의 2회차 청구 발행 | 파일럿 인터뷰 | 3곳 중 ≥ 2곳 |
| **Revenue** | 후원(선택) | GitHub Sponsors/후원 (코어는 영구 무료) | GitHub 프로필 | 금전 목표 없음 |
| **Referral** | 추천 유입 | 인쇄 푸터/추천 링크 경유 문의 | 릴리스 referrer + 파일럿 보고 | ≥ 10 |

### 지표별 해석 규칙

- **Acquisition**은 GitHub 공개 지표라 신뢰도가 높다. 단, 다운로드 ≠ 사용이다.
- **Activation**은 자동 수집이 없으므로 **표본 편향**을 명시한다(설문/파일럿 참여자).
- **Retention**은 "월말 청구 발행"이라는 실제 가치 행동으로만 판정한다(단순 실행/방문은 제외).
- **Referral**은 서버 계측이 불가하므로 "거래처가 물어봤다"는 파일럿 정성 보고를 1차 신호로 쓴다.

## 2. 수집 명령

```bash
# 네트워크/토큰 없이 계획 확인 (exit 0)
node scripts/growth/fetch_metrics.js --dry-run

# 공개 지표 수집 (토큰 불필요, rate limit 있음)
node scripts/growth/fetch_metrics.js

# 스냅샷 저장
GITHUB_TOKEN=xxx node scripts/growth/fetch_metrics.js --json .tmp/metrics/latest.json
```

`--json`은 `stars / forks / openIssues / releaseCount / totalDownloads / assets[]`를 기록한다.
Activation·Retention·Referral은 이 파일에 수기로 병기한다(§4 로그 표).

## 3. 주간 리뷰 루틴 (매주 월요일 30분)

1. `fetch_metrics.js` 실행 → Acquisition 스냅샷 기록.
2. 설문/파일럿 응답 취합 → Activation/Retention 갱신.
3. 채널별 게시·문의·삭제 여부 점검(`docs/growth/CHANNEL_COPY.md` 성공 판정 대조).
4. 병목 1개 선정 → 다음 주 실험 1건 결정(문구/채널/양식 중 1개만 변경).
5. 로그 표(§4) 채우고, 금지 문자열·링크 정본 여부 재점검.

> 원칙: 한 주에 **변수 1개만** 바꾼다. 그래야 원인이 남는다.

## 4. 4주 로그 표 (템플릿)

매주 월요일에 갱신한다. 빈칸은 `-`.

| 주차 | 기간 | 다운로드(누적) | 온보딩 설문 | 파일럿 청구 2회차 | 추천 유입 | 이번 주 병목 | 다음 실험 |
|:--:|:---|:--:|:--:|:--:|:--:|:---|:---|
| W1 | Day 0~7 | - | - | - | - | - | - |
| W2 | Day 8~14 | - | - | - | - | - | - |
| W3 | Day 15~21 | - | - | - | - | - | - |
| W4 | Day 22~30 | - | - | - | - | - | - |

### 채널별 로그 (주간)

| 채널 | 게시 수 | 다운로드 유입 | 댓글/문의 | 비고 |
|:---|:--:|:--:|:--:|:---|
| GeekNews | | | | |
| 클리앙 개발한당 | | | | |
| OKKY | | | | |
| 디시 프로그래밍갤 | | | | |
| 네이버 제조업 카페/밴드 | | | | |
| 소공인센터 단톡 | | | | |
| 세무사 네트워크 | | | | |
| 제품 내장(인쇄 푸터) | 상시 | | | |

## 5. 목표 미달 시 대응

- Acquisition < 300: 채널 카피/타이밍 교체(C1→C5 우선순위 재배치).
- Activation < 30: 온보딩 3단계·양식 안내 위치 점검, 파일럿 동반 설치 확대.
- Retention < 2곳: 2주차 체크인 누락 여부 확인, 월말 알림(명세) 필요성 재검토.
- Referral < 10: 인쇄 푸터 노출 여부·원장 전달 경로 확인.
