# CONTRIBUTING — SME-ERP 기여 가이드

SME-ERP에 관심을 가져주셔서 감사합니다. 이 프로젝트는 **10인 이하 소규모 제조업**을 위한
로컬퍼스트 오픈소스 ERP입니다. 아래 원칙을 지켜주시면 리뷰가 빠릅니다.

## 개발 환경

- Node.js v22.13 이상 (내장 `node:sqlite` 사용)
- Windows 10/11 x64 (배포 타겟). 개발은 macOS/Linux에서도 가능.

```bash
git clone https://github.com/harry81/clevr.git sme-erp
cd sme-erp
npm install
npm start          # 개발 모드 실행
```

## 테스트

```bash
npm test           # 단위 테스트 (node --test)
npm run test:e2e   # 통합 흐름
npm run test:runtime # Electron 런타임 스모크 (Windows)
```

- **PR 전 `npm test` 전체 통과가 필수**입니다.
- 신규 로직은 테스트를 함께 추가하세요. 순수 함수/서비스 단위를 우선합니다.

## 코딩 규칙

- 스택: Electron + Node 내장 `node:sqlite`(로컬 단일 파일) + Vanilla JS(`window.App`).
- **외부 런타임 의존성 추가 금지.** 표준 라이브러리/플랫폼 기능을 우선하세요.
- 로컬퍼스트 유지: 데이터를 서버로 전송하거나 텔레메트리를 넣지 않습니다.
- 기존 코드 컨벤션을 따르고, 범위 밖 리팩터링은 별도 PR로 분리하세요.
- 보안/검증 경계(입력 검증, 에러 처리)는 단순화하지 않습니다.

## 금지 사항

- 미소유 도메인·가짜 버전 태그 사용.
- 레거시 서버 스택(서버 프레임워크·ORM·개발용 로컬 포트) 문서·코드 인용.
- 실제 릴리스에 없는 버전 표기. 버전은 `package.json`과 릴리스 태그를 정본으로 합니다.
- 다운로드 링크는 `https://github.com/harry81/clevr/releases/latest`로 통일.

## PR 절차

1. 이슈로 문제/제안을 먼저 공유해 주세요(작은 수정은 바로 PR 가능).
2. 변경 범위를 좁게 유지하고, 커밋 메시지는 `feat:`, `fix:`, `docs:` 등으로 명확히 씁니다.
3. 테스트/문서를 함께 갱신합니다.
4. PR 설명에 **변경 이유와 검증 방법**(실행 명령/결과)을 적습니다.

## 보안 / 개인정보

- 장부·매출 데이터는 사용자 PC에만 존재해야 합니다. 로그·전송·수집 금지.
- 비밀번호는 Node 내장 `crypto.scrypt`로만 처리합니다.
- 취약점은 공개 이슈 대신 메인테이너에게 비공개로 알려주세요.

## 라이선스

기여한 코드는 [MIT License](LICENSE)로 배포되는 데 동의한 것으로 간주합니다.
