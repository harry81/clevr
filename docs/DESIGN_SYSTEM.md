# clevr ERP 디자인 시스템 명세서 (Design System Specification)

> **버전**: v1.0.0  
> **최종 수정일**: 2026-09-01  
> **작성자**: `@clevr-planner`  
> **대상 플랫폼**: clevr 데스크톱 ERP (`clevr/renderer`)

---

## 1. 디자인 철학 및 원칙 (Design Philosophy)

1. **High Information Density (고밀도 정보 표현)**
   - 데스크톱 ERP 업무 환경에 맞게 한 화면에서 최대한 많은 유효 데이터를 직관적으로 파악할 수 있도록 여백과 폰트 크기를 컴팩트하게 최적화합니다.
2. **Visual Hierarchy & Contrast (명확한 시각적 계층 구조)**
   - 중요한 액션(Primary CTA), 보조 액션(Secondary), 조회/필터, 데이터 그리드 영역 간의 명도 대비와 폰트 가중치를 명확히 구분합니다.
3. **Consistency & Modularity (일관성과 모듈화)**
   - 모든 화면에서 동일한 CSS 변수(Design Tokens)와 공통 컴포넌트 클래스를 사용하여 UI 파편화를 방지하고 유지보수성을 극대화합니다.
4. **Instant Feedback & Accessibility (직관적 인터랙션)**
   - 호버(Hover), 포커스(Focus Ring), 선택(Active/Selected), 비활성화(Disabled) 상태를 명확히 표현하여 조작 실수를 방지합니다.

---

## 2. 디자인 토큰 명세 (Design Tokens)

모든 스타일은 `:root`에 정의된 CSS 커스텀 속성을 기준으로 작성됩니다.

### 2.1 컬러 시스템 (Color Palette)

#### (1) Brand / Primary Color (신뢰감을 주는 인디고-블루)
| 토큰명 | Hex 코드 | 용도 |
| :--- | :--- | :--- |
| `--color-brand-50` | `#eff6ff` | 선택 영역 배경, 호버 배경 하이라이트 |
| `--color-brand-100` | `#dbeafe` | 활성 태그/뱃지 배경, 트리 선택 배경 |
| `--color-brand-200` | `#bfdbfe` | 포커스 링, 연한 테두리 |
| `--color-brand-500` | `#3b82f6` | 메인 인터랙션, 체크박스/라디오 액티브 |
| `--color-brand-600` | `#2563eb` | **Primary 버튼 기본 배경**, 링크 색상 |
| `--color-brand-700` | `#1d4ed8` | Primary 버튼 호버 상태 |
| `--color-brand-800` | `#1e40af` | Primary 버튼 액티브(클릭) 상태 |

#### (2) Neutral Scale (명확한 대비의 무채색 계열)
| 토큰명 | Hex 코드 | 용도 |
| :--- | :--- | :--- |
| `--color-gray-50` | `#f8fafc` | 앱 전체 기본 배경 (`body`, 비활성 셀 배경) |
| `--color-gray-100` | `#f1f5f9` | 패널 헤더, 툴바 보조 배경, 테이블 헤더 |
| `--color-gray-200` | `#e2e8f0` | **기본 테두리(Border)**, 구분선(Divider) |
| `--color-gray-300` | `#cbd5e1` | 입력창 기본 테두리, 보조 버튼 테두리 |
| `--color-gray-400` | `#94a3b8` | 비활성 아이콘, 플레이스홀더 텍스트 |
| `--color-gray-500` | `#64748b` | 보조 설명 텍스트, 상태바 텍스트 |
| `--color-gray-700` | `#334155` | 서브 라벨, 폼 필드 라벨 |
| `--color-gray-900` | `#0f172a` | **본문 및 헤딩 기본 텍스트** |

#### (3) Semantic Status Colors (상태 표시용)
| 상태 | 기본 색상 (Hex) | 배경 색상 (Hex) | 용도 |
| :--- | :--- | :--- | :--- |
| **Success** | `--color-success: #10b981` | `--color-success-bg: #ecfdf5` | 정상 처리, 승인 완료, 연결됨 |
| **Warning** | `--color-warning: #f59e0b` | `--color-warning-bg: #fffbeb` | 주의 필요, 대기 중, 변경 감지 |
| **Error / Danger** | `--color-error: #ef4444` | `--color-error-bg: #fef2f2` | 오류, 삭제, 반려, 미납 |
| **Info** | `--color-info: #3b82f6` | `--color-info-bg: #eff6ff` | 일반 알림, 도움말 |

---

### 2.2 타이포그래피 (Typography)

- **기본 글꼴 체계**: `"Pretendard", "Pretendard Variable", -apple-system, BlinkMacSystemFont, system-ui, Roboto, "Helvetica Neue", "Segoe UI", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`
- **행간 (Line-height)**: 고밀도 그리드 및 툴바에서는 `1.3 ~ 1.4`, 텍스트 문단에서는 `1.5` 적용
- **자간 (Letter-spacing)**: `-0.015em ~ -0.02em` (한글 가독성 최적화)

| 레벨 | 폰트 크기 | Font Weight | 용도 |
| :--- | :--- | :--- | :--- |
| `xs` | `11px` (`0.6875rem`) | Regular(400) / Medium(500) | 상태바, 보조 뱃지, 그리드 소형 텍스트 |
| `sm` | `12px` (`0.75rem`) | Regular(400) / Medium(500) | **데이터 그리드 셀**, 트리 뷰 노드, 툴팁 |
| `base` | `13px` (`0.8125rem`) | Regular(400) / Medium(500) | **기본 입력 폼**, 버튼 텍스트, 탭 라벨 |
| `md` | `14px` (`0.875rem`) | Medium(500) / SemiBold(600) | 섹션 타이틀, 서브 헤더, 다이얼로그 본문 |
| `lg` | `16px` (`1.0rem`) | SemiBold(600) / Bold(700) | 팝업 모달 타이틀, 주요 패널 제목 |
| `xl` | `18px` (`1.125rem`) | Bold(700) | 메인 헤더, 대시보드 요약 수치 |

---

### 2.3 여백 및 라운딩 (Spacing & Radius)

- **Spacing (4px Grid 기준)**:
  - `--space-1`: `4px` | `--space-2`: `8px` | `--space-3`: `12px`
  - `--space-4`: `16px` | `--space-5`: `20px` | `--space-6`: `24px`
- **Border Radius**:
  - `--radius-xs`: `2px` (소형 태그, 체크박스)
  - `--radius-sm`: `4px` (버튼, 인풋 필드, 셀렉트 박스)
  - `--radius-md`: `6px` (패널 카드, 드롭다운 메뉴, 툴바 컨테이너)
  - `--radius-lg`: `8px` (모달 팝업 윈도우)

---

## 3. 핵심 컴포넌트 스타일 상세 명세

### 3.1 좌측 조직도 트리 뷰 (Tree View)

```
[Tree Panel Container]
├── Tree Header: [사업장 목록] (13px Bold, Refresh 버튼)
├── Tree Search Box: [사업장명 검색...] (Compact Input)
└── Tree Body:
    ├─ ▶ 🏢 본사 (Root Node)
    │   ├─ 📂 관리부 (Parent Node - Folder Icon)
    │   │   ├─ 📄 총무팀 (Leaf Node - Item Icon)
    │   │   └─ 📄 인사팀 (Leaf Node)
    │   └─ 📂 사업부 (Expanded)
    │       └─ 🏭 대구 1공장 (Active Selected Node)
```

- **규격**:
  - 패널 기본 폭: `240px ~ 280px` (Resizable)
  - 노드 행 높이: `26px ~ 28px`
  - 인덴트(들여쓰기): 계층당 `16px` (Guide line: `1px solid var(--color-gray-200)`)
- **인터랙션 및 시각 효과**:
  - **기본 노드**: 텍스트 `var(--color-gray-700)`, 투명 배경
  - **호버 노드 (`:hover`)**: 배경 `var(--color-gray-100)`, 텍스트 `var(--color-gray-900)`
  - **선택된 노드 (`.is-selected`)**:
    - 배경: `var(--color-brand-50)`
    - 좌측 인디케이터 바: `3px solid var(--color-brand-600)`
    - 텍스트: `var(--color-brand-700)`, `font-weight: 600`
  - **토글 아이콘 (`.tree-toggle`)**: 부드러운 회전 전환 애니메이션 (`transform: rotate(90deg)`)

---

### 3.2 데이터 그리드 / 테이블 (Data Grid & Table)

- **규격**:
  - 헤더 높이: `34px` (배경 `var(--color-gray-100)`, 텍스트 `var(--color-gray-700)`, 12px SemiBold)
  - 데이터 행 높이:
    - **컴팩트 모드**: `28px ~ 30px` (데이터 집약형 화면)
    - **표준 모드**: `34px ~ 36px` (일반 화면)
  - 셀 패딩: `horizontal 8px`, `vertical 4px`
- **그리드 기능 및 인터랙션**:
  - **헤더 테두리 & 정렬**:
    - 컬럼 구분선: `1px solid var(--color-gray-200)`
    - 정렬 가능한 헤더에 마우스 오버 시 정렬 화살표(`▲▼`) 활성화 표시
  - **행 호버 (`.grid-row:hover`)**:
    - 배경: `#f8fafc` (또는 `var(--color-brand-50)` 40% 투명도)
  - **행 선택 (`.grid-row.is-selected`)**:
    - 배경: `var(--color-brand-50)`
    - 좌측 보더 하이라이트: `2px solid var(--color-brand-600)`
  - **숫자/통계 정렬**: 통화, 수량 등 수치 컬럼은 `text-align: right`, `font-variant-numeric: tabular-nums` 적용

---

### 3.3 상단 툴바 및 액션 바 (Toolbar & Action Bar)

```
┌────────────────────────────────────────────────────────────────────────┐
│ [아이콘] 사업장 관리 > 계약 현황    | [ 2026-09-01 ~ 2026-09-30 ▼ ] [검색] │
│ ────────────────────────────────────────────────────────────────────── │
│ [ ➕ 신규등록 ] [ 💾 저장 ] [ 🗑️ 삭제 ]  |  [ 📥 엑셀다운 ] [ 🖨️ 인쇄 ] [ 🔄 ] │
└────────────────────────────────────────────────────────────────────────┘
```

- **레이아웃**:
  - 툴바 높이: `44px ~ 48px`, 하단 보더 `1px solid var(--color-gray-200)`, 배경 `var(--color-bg-primary)`
  - 좌측: 네비게이션 브레드크럼, 화면 타이틀, 빠른 날짜/검색 필터
  - 우측: 주요 비즈니스 액션 버튼 그룹
- **버튼 시스템**:
  1. **Primary Button (`.btn-primary`)**:
     - 배경 `var(--color-brand-600)`, 텍스트 `#ffffff`, 테두리 `none`
     - 화면당 1개 이내의 핵심 저장/실행 액션에만 적용
  2. **Secondary Button (`.btn-secondary` / `.btn-outline`)**:
     - 배경 `#ffffff`, 테두리 `1px solid var(--color-gray-300)`, 텍스트 `var(--color-gray-700)`
  3. **Danger Button (`.btn-danger`)**:
     - 배경 `var(--color-error)`, 텍스트 `#ffffff` (삭제, 취소용)
  4. **Ghost / Icon Button (`.btn-ghost`)**:
     - 투명 배경, 호버 시 `var(--color-gray-100)` 배경 적용

---

### 3.4 폼 컨트롤 및 입력 필드 (Form Controls)

- **인풋/셀렉트 기본 규격**:
  - 높이: `30px ~ 32px` (컴팩트 ERP 환경)
  - 패딩: `4px 8px`
  - 테두리: `1px solid var(--color-gray-300)`, `border-radius: var(--radius-sm)`
  - 폰트: `12px ~ 13px`, 텍스트 `var(--color-gray-900)`
- **상태 정의**:
  - **포커스 (`:focus`)**:
    - 테두리: `var(--color-brand-500)`
    - 포커스 링: `box-shadow: 0 0 0 2px var(--color-brand-100)`
  - **읽기 전용 / 비활성 (`:disabled`, `[readonly]`)**:
    - 배경: `var(--color-gray-100)`, 텍스트 `var(--color-gray-400)`, 커서 `not-allowed`
  - **검증 오류 (`.is-invalid`)**:
    - 테두리: `var(--color-error)`, 배경: `var(--color-error-bg)`

---

### 3.5 모달 다이얼로그 (Modal Dialog)

- **구조**:
  - **Backdrop Overlay**: `background: rgba(15, 23, 42, 0.45)`, `backdrop-filter: blur(2px)`
  - **Modal Box**:
    - 배경 `#ffffff`, 테두리 `1px solid var(--color-gray-200)`, `border-radius: var(--radius-lg)`
    - 그림자: `box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)`
  - **Header**: 높이 `44px`, 타이틀 `15px SemiBold`, 우측 닫기(`✕`) 버튼
  - **Body**: 패딩 `16px 20px`, 최대 높이 `calc(100vh - 160px)`, 스크롤 가능
  - **Footer**: 높이 `50px`, 배경 `var(--color-gray-50)`, `border-top: 1px solid var(--color-gray-200)`, 우측 정렬 버튼 그룹

---

## 4. 화면별 컴포넌트 클래스 매핑 가이드 (`clevr/renderer`)

| 화면 영역 | 기존 레거시 클래스/태그 | 신규 표준 디자인 시스템 클래스 | 비고 |
| :--- | :--- | :--- | :--- |
| **공통 버튼** | `.btn`, `button`, inline style | `.btn.btn-primary`, `.btn.btn-secondary`, `.btn.btn-sm` | 규격 및 색상 통일 |
| **조직도 트리** | `ul.tree`, `.node`, `.toggle` | `.tree-view`, `.tree-node`, `.tree-toggle`, `.tree-icon` | 인덴트 및 선택 스타일 적용 |
| **데이터 테이블** | `table`, `.tbl`, `.grid` | `.data-grid`, `.data-grid-header`, `.data-grid-row`, `.data-grid-cell` | 호버/선택/고정 헤더 적용 |
| **상단 툴바** | `.menubar`, `.toolbar` | `.app-toolbar`, `.toolbar-actions`, `.toolbar-filters` | 정렬 및 버튼 그룹화 |
| **모달 팝업** | `.modal-overlay`, `.modal-box` | `.modal-backdrop`, `.modal-dialog`, `.modal-header`, `.modal-body`, `.modal-footer` | 블러 및 그림자 개선 |
| **폼 입력창** | `input[type="text"]`, `select` | `.form-control`, `.form-select`, `.form-group`, `.form-label` | 높이 및 포커스 링 통일 |

---

## 5. Phase 2 구현 체크리스트 (`clevr-coder`용)

- [ ] **[CODE-01]** `renderer/styles/design-system.css`에 신규 CSS 변수(토큰) 및 유틸리티 클래스 반영
- [ ] **[CODE-02]** 기본 버튼(`.btn-*`), 폼 컨트롤(`.form-*`), 뱃지(`.badge-*`) 공통 CSS 완성
- [ ] **[CODE-03]** 좌측 트리 뷰(`.tree-view`, `.tree-node`) 전용 스타일시트 분리/리팩토링
- [ ] **[CODE-04]** 데이터 그리드(`.data-grid`) 헤더 고정, 셀 정렬, 호버/선택 인터랙션 스타일링
- [ ] **[CODE-05]** 상단 툴바 및 모달 다이얼로그 표준 레이아웃 적용
