const { app, BrowserWindow, ipcMain, Tray, Menu, shell, dialog, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { createDatabase, walCheckpointTruncate } = require('./src/main/db/sqliteEngine');
const { createSmeHandlers, createSessionStore } = require('./src/main/ipc/smeHandlers');

// ---------------------------------------------------------
// WIN-C: Single instance lock (win32) — 중복 실행 방지
// ---------------------------------------------------------
if (process.platform === 'win32') {
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    app.quit();
  } else {
    app.on('second-instance', () => {
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
      }
    });
  }
}

// ---------------------------------------------------------
// DB: %LOCALAPPDATA%\SME-ERP\data\mycompany.db (SQLite WAL, T8)
// 구 db/localStore.js(JSON 파일 + GENSYS 시드) 폐기 — 신규 엔진으로 교체.
// ---------------------------------------------------------
let db = null;
let dbPath = null;
const session = createSessionStore();
// app.getPath는 ready 이후에만 정확 — 지연 초기화
function initDb() {
  try {
    const userData = app.getPath('userData'); // => %LOCALAPPDATA%\SME-ERP 또는 ~/...
    dbPath = path.join(userData, 'data', 'mycompany.db');
  } catch {
    dbPath = path.join(os.homedir(), '.sme-erp', 'data', 'mycompany.db');
  }
  db = createDatabase(dbPath);
}

// 스냅샷 백업 (OneDrive 동기화는 스냅샷만 — live DB는 %LOCALAPPDATA% 고정)
function createSnapshot() {
  if (!db || !dbPath) return null;
  walCheckpointTruncate(db);
  const snapDir = path.join(path.dirname(path.dirname(dbPath)), 'backup');
  if (!fs.existsSync(snapDir)) fs.mkdirSync(snapDir, { recursive: true });
  const snapFile = path.join(snapDir, `mycompany-${new Date().toISOString().slice(0, 10)}.db`);
  fs.copyFileSync(dbPath, snapFile);
  return snapFile;
}

// Linux / 가상화 환경 호환성을 위해 하드웨어 가속 비활성화
app.disableHardwareAcceleration();

let mainWindow;
let tray = null;
let isQuitting = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    icon: fs.existsSync(path.join(__dirname, 'build', 'icon.ico'))
      ? path.join(__dirname, 'build', 'icon.ico') : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // WIN-C: 트레이 — 닫기 시 트레이로 최소화 (win32)
  if (process.platform === 'win32') {
    mainWindow.on('close', (e) => {
      if (!isQuitting) {
        e.preventDefault();
        mainWindow.hide();
        if (tray) tray.displayBalloon({
          title: 'SME-ERP',
          content: '트레이에서 계속 실행 중입니다. 종료하려면 트레이 메뉴를 이용하세요.'
        });
      }
    });
  }
}

// WIN-C: 트레이 + 자동시작 (결론 v2 §9, installer.nsh customInstall 보완)
function createTray() {
  if (tray) return;
  // 빈 nativeImage — icon.ico 없으면 기본
  let icon = nativeImage.createEmpty();
  const iconPath = path.join(__dirname, 'build', 'icon.ico');
  if (fs.existsSync(iconPath)) {
    icon = nativeImage.createFromPath(iconPath);
  }
  tray = new Tray(icon);
  tray.setToolTip('SME-ERP');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '창 열기',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createWindow();
        }
      }
    },
    {
      label: '자동 시작 ' + (app.getLoginItemSettings().openAtLogin ? '✓' : '✕'),
      type: 'checkbox',
      checked: app.getLoginItemSettings().openAtLogin,
      click: (item) => {
        app.setLoginItemSettings({
          openAtLogin: item.checked,
          path: process.execPath,
          args: []
        });
      }
    },
    { type: 'separator' },
    {
      label: '백업 (스냅샷)',
      click: async () => {
        try {
          const snap = createSnapshot();
          dialog.showMessageBoxSync(mainWindow, {
            type: 'info',
            title: '백업 완료',
            message: snap ? `스냅샷 생성: ${snap}` : '백업 완료 (wal_checkpoint 실행)',
          });
        } catch (err) {
          dialog.showErrorBox('백업 실패', err.message);
        }
      }
    },
    { type: 'separator' },
    {
      label: '종료',
      click: () => {
        isQuitting = true;
        if (db) walCheckpointTruncate(db);
        app.quit();
      }
    }
  ]);
  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => {
    if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
  });
}

function setupAutoStart() {
  if (process.platform === 'win32') {
    // NSIS installer.nsh의 HKCU Run 과 이중화 — Electron API 우선, 실패 시 registry fallback은 installer가 담당
    try {
      app.setLoginItemSettings({
        openAtLogin: true,
        path: process.execPath,
        args: []
      });
    } catch (e) {
      console.warn('[AutoStart] setLoginItemSettings failed:', e.message);
    }
  }
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null); // P0: File/Edit/View 무용 메뉴 제거 — 상단 설정/메뉴/About만 유지 (ui_old_review P0)
  initDb();
  registerSmeIpc();
  setupAutoStart();
  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else if (mainWindow) mainWindow.show();
  });
});

app.on('before-quit', () => {
  isQuitting = true;
  // wal_checkpoint(TRUNCATE) — 업데이트/종료 전 강제 (결론 v2 §5, WBS T-00-01)
  try {
    if (db) walCheckpointTruncate(db);
  } catch {}
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // win32: 트레이 상주 — 종료는 트레이 메뉴로만
    if (process.platform === 'win32' && tray && !isQuitting) return;
    app.quit();
  }
});
// ---------------- IPC: SME-ERP 브릿지 (T8) ----------------
// 구 채널(login/customers/educations/trainees/hrEmployees 등) 전부 폐기.
// window.api.sme.* <-> sme:* 1:1 매핑. 응답 {ok:true,data}/{ok:false,message}.
function registerSmeIpc() {
  const handlers = createSmeHandlers({ db, session });
  for (const [channel, fn] of Object.entries(handlers)) {
    ipcMain.handle(channel, async (event, payload) => fn(payload));
  }
  ipcMain.handle('sme:print:html', async (event, payload) => printHtml(payload || {}));
  ipcMain.handle('sme:app:quit', () => {
    isQuitting = true;
    app.quit();
  });
}

// ---------------- 출력관리: 인쇄 (도메인 무관 셸 유틸리티, Phase 3에서 사용) ----------------
async function printHtml({ html, fileName }) {
  const { randomUUID } = require('crypto');
  const printWin = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true } });
  let tmpHtmlPath = '';
  try {
    const tmpDir = app.getPath('temp');
    tmpHtmlPath = path.join(tmpDir, `print-${randomUUID()}.html`);
    const sanitized = String(html).replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
    fs.writeFileSync(tmpHtmlPath, sanitized, 'utf-8');
    await printWin.loadFile(tmpHtmlPath);
    const pdfBuffer = await printWin.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      margins: { marginType: 'none' }
    });
    const safeName = (fileName || '출력').replace(/[\\/:*?"<>|]/g, '_');
    const pdfPath = path.join(tmpDir, `${safeName}-${randomUUID()}.pdf`);
    fs.writeFileSync(pdfPath, pdfBuffer);
    await shell.openPath(pdfPath);
    return { ok: true, data: { path: pdfPath } };
  } catch (err) {
    return { ok: false, message: err.message };
  } finally {
    try { if (tmpHtmlPath) fs.unlinkSync(tmpHtmlPath); } catch {}
    if (!printWin.isDestroyed()) printWin.close();
  }
}
