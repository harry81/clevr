# SME-ERP — 소규모 제조업을 위한 1분 온보딩 경량 오픈소스 ERP

엑셀로 버티던 소규모 제조업 사장님을 위한 설치형 ERP입니다.
첫 실행 후 1분이면 회사 등록부터 거래처·단가표 세팅까지 끝나고,
월말 청구서와 입금 정리를 클릭 몇 번으로 끝낼 수 있습니다.

## 3대 핵심 경험 (Aha Moments)

1. **[온보딩 1분]** 처음 실행하면 60초 마법사가 회사 정보·관리자 계정을 받고,
   소규모 제조업 표준 단가 템플릿과 샘플 거래처를 자동 시딩합니다. 빈 화면 제로.
2. **[월말 5초]** 월 청구서 원클릭 일괄 생성 — 거래처별 단가표 기준으로
   청구번호를 연속 채번하고 거래 원장에 자동 기표합니다.
   (수 시간의 수작업 → 5초 일괄 발행)
3. **[입금 즉시]** 쪼개기 입금 선입선출(FIFO) 자동 충당 — 여러 건에 나눠 들어온
   입금을 오래된 청구서부터 자동 배분하고, 실시간 미수금 잔액과
   거래처별 원장을 바로 출력합니다.

## Local-First 데이터 보안 원칙

- 모든 업무 데이터는 사용자 PC에만 저장됩니다.
  (`%LOCALAPPDATA%\SME-ERP\data\mycompany.db`, SQLite WAL 모드)
- 외부 서버로 데이터를 전송하지 않습니다. 계정·오프라인 환경에서도 동작합니다.
- 로그인 비밀번호는 scrypt 해시 + 솔트로 보관합니다. 평문 저장 없음.
- 삭제 시에도 데이터베이스 파일은 보존됩니다 (언인스톨 대화상자에서 선택).

## 빠른 시작

### 사용자용 (설치 파일)

1. GitHub Releases에서 `SME-ERP-Setup-x.x.x.exe`
   (또는 무설치 `SME-ERP-Portable.zip`)를 내려받습니다.
2. 실행 후 안내에 따라 설치합니다. 실행 파일에 코드 서명이 없어
   Windows SmartScreen 경고가 뜰 수 있습니다.
   ("추가 정보" → "실행"을 누르면 설치가 진행됩니다.)
3. 첫 실행 시 1분 온보딩 마법사를 완료하면 바로 사용할 수 있습니다.

### 개발자용 (소스 실행)

```bash
git clone <repo-url> sme-erp
cd sme-erp
npm install
npm start
```

요구 사항: Node.js 22.13 이상 (내장 SQLite 사용), Windows 10+ x64.

## 기술 스택

- **Electron** — Windows 설치형 데스크톱 앱 (NSIS 설치 + Portable 지원)
- **Vanilla JS SPA** — 빌드 없는 렌더러 (`renderer/`, `window.App` 네임스페이스)
- **Node 22 내장 SQLite (WAL)** — 별도 DB 서버 없는 로컬 저장
- **scrypt** — 비밀번호 해시
- **라이선스**: MIT (자세한 내용은 `LICENSE` 파일 참고)
- **데이터**: 로컬 퍼스트 — 클라우드 동기화 없음

## 테스트

```bash
npm test            # 단위 테스트
npm run test:e2e    # 통합 테스트 (온보딩→청구→입금→대시보드 전체 흐름)
npm run test:runtime  # Electron 런타임 스모크
```

## 라이선스

MIT License — Copyright (c) 2026 SME-ERP Contributors.
