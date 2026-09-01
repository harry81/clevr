# Today I Learned (TIL)

## 1. Electron 기반 데스크톱 애플리케이션 아키텍처

### 1.1 Main Process vs Renderer Process
- **Main Process (`main.js`)**:
  - Node.js 풀 런타임 환경에서 실행되며 애플리케이션 수명 주기, 네이티브 GUI(창 생성, 메뉴 등), 파일 시스템 및 OS 레벨 API 접근을 담당.
  - IPC(Inter-Process Communication)의 수신/응답 핸들러(`ipcMain.handle`, `ipcMain.on`)를 관리.
- **Renderer Process (`renderer/`)**:
  - Chromium 브라우저 창 내에서 UI를 렌더링.
  - 보안을 위해 `nodeIntegration: false`, `contextIsolation: true`를 적용하여 직접적인 Node.js API 접근을 제한하고 안전한 IPC 브릿지를 사용.
- **Preload Script (`preload.js`)**:
  - Main과 Renderer 사이의 보안 격리 계층(`contextBridge.exposeInMainWorld`) 역할을 수행.
  - Renderer 프로세스에 필요한 안전한 API 메서드만을 노출하여 XSS 등 보안 위협을 방지.

---

## 2. 프로젝트 구조 및 데이터 흐름

- **데이터 계층 (`db/localStore.js`)**:
  - 로컬 파일 기반 스토리지 구현으로, 추후 실제 서버 DB 드라이버로 손쉽게 교체 가능한 인터페이스 제공.
- **빌드 및 패키징 (`electron-builder.yml`)**:
  - Windows/macOS/Linux 데스크톱 실행 파일(.exe, .dmg 등) 패키징 설정 정의.
