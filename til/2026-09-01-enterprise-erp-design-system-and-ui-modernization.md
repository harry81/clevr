# Today I Learned: 엔터프라이즈 ERP UI/UX 디자인 시스템 구축 및 고밀도 데이터 인터페이스 최적화

- **일자**: 2026-09-01
- **주제**: 데스크톱 ERP 시스템의 레거시 UI 현대화 및 토큰 기반 CSS 아키텍처 수립

---

## 1. ERP UI/UX 특성과 핵심 설계 원칙

엔터프라이즈 ERP(Enterprise Resource Planning) 시스템은 일반적인 소비자용 웹 서비스(B2C)와 달리 다음과 같은 고유한 업무적 특성을 가집니다:

1. **고밀도 정보 표현 (High Information Density)**:
   - 한 화면에서 다수의 행/열 데이터 및 상태를 신속하게 확인하고 조작할 수 있어야 합니다.
   - 행 높이를 `28px ~ 34px` 수준으로 최적화하고, 4px 단위의 미세 여백 체계를 적용합니다.
2. **시각적 계층화 (Visual Hierarchy)**:
   - 과도한 화려함보다는 시인성이 높은 블루(`--color-brand-600`) 및 슬레이트 그레이(`--color-gray-*`) 계열을 메인으로 배치하여 눈의 피로를 최소화합니다.
   - Primary CTA 버튼과 Secondary 버튼, 조회 필터 영역을 시각적으로 명확히 분리합니다.
3. **직관적인 상태 피드백 (State Feedback)**:
   - 테이블 행 선택 시 `box-shadow` 인디케이터와 연한 브랜드 배경색(`--color-brand-50`), 노드 트리 포커스 링 등을 통해 현재 선택 상태를 즉시 인지할 수 있도록 설계합니다.

---

## 2. 디자인 토큰(Design Tokens) 기반 CSS 아키텍처

- **CSS 커스텀 속성(`:root`) 활용**:
  - 컬러, 폰트, 여백, 라운딩, 그림자, 포커스 링을 변수화하여 다크 모드 전환 및 일관된 테마 확장을 보장합니다.
- **모듈별 독립 컴포넌트 클래스**:
  - `.btn`, `.form-control`, `.tree-view`, `.data-grid`, `.app-toolbar`, `.modal-dialog` 등 명확한 BEM 네이밍 기반 컴포넌트 클래스로 유지보수성을 극대화합니다.

---

## 3. 적용 결과 및 기대 효과

- `renderer/styles/design-system.css` 표준 토큰 및 컴포넌트 라이브러리 구축
- `renderer/index.html` 내 비표준 인라인 스타일 및 구형 테이블/트리/툴바 UI를 모던 CSS 변수 기반으로 전면 리팩토링
- 디자인 가이드라인(`docs/DESIGN_SYSTEM.md`) 수립을 통해 이후 추가되는 화면들도 동일한 UX 품질을 유지할 수 있는 기틀 마련
