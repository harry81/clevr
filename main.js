const { app, BrowserWindow, ipcMain, Tray, Menu, shell, dialog, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const XLSX = require('xlsx');

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
// DB 연동 지점: %LOCALAPPDATA%\SME-ERP\data\mycompany.db WAL
// OneDrive 분리, wal_checkpoint(TRUNCATE) PRE_OP, BEGIN IMMEDIATE+busy_retry 3회
// localStore.js:17 — app.getPath('userData') 주입으로 %LOCALAPPDATA% 고정
// ---------------------------------------------------------
const Store = require('./db/localStore');
let store;
// app.getPath는 ready 이후에만 정확 — 지연 초기화
function initStore() {
  try {
    const userData = app.getPath('userData'); // => %LOCALAPPDATA%\SME-ERP 또는 ~/...
    store = new Store(userData);
  } catch {
    store = new Store();
  }
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

  // WIN-C: 127.0.0.1:3000 자동오픈 — Stand-Alone 원칙 (결론 v2 §1)
  // Electron 창과 별개로 브라우저 자동 오픈 (NSIS 설치 후, Portable start.bat 후)
  // 지연 실행으로 창이 뜬 뒤 브라우저가 포그라운드에 오도록
  if (process.platform === 'win32') {
    setTimeout(() => {
      // Electron 창이 주 화면이며, 외부 브라우저 자동 오픈은 옵션 (실패 무시)
      shell.openExternal('http://127.0.0.1:3000').catch(() => {});
    }, 1500);
  }

  // WIN-C: 트레이 — 닫기 시 트레이로 최소화 (win32)
  if (process.platform === 'win32') {
    mainWindow.on('close', (e) => {
      if (!isQuitting) {
        e.preventDefault();
        mainWindow.hide();
        if (tray) tray.displayBalloon({
          title: '지점관리프로그램',
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
  tray.setToolTip('지점관리프로그램 (SME-ERP)');

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
          if (store && store.preOpCheckpoint) store.preOpCheckpoint();
          const snap = store ? store.createSnapshot() : null;
          dialog.showMessageBoxSync(mainWindow, {
            type: 'info',
            title: '백업 완료',
            message: snap ? `스냅샷 생성: ${snap}` : '백업 완료 (PRE_OP wal_checkpoint 실행)',
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
        if (store && store.preOpCheckpoint) store.preOpCheckpoint();
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
  initStore();
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
  // PRE_OP wal_checkpoint(TRUNCATE) — 업데이트/종료 전 강제 (결론 v2 §5, WBS T-00-01)
  try {
    if (store && store.preOpCheckpoint) store.preOpCheckpoint();
  } catch {}
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // win32: 트레이 상주 — 종료는 트레이 메뉴로만
    if (process.platform === 'win32' && tray && !isQuitting) return;
    app.quit();
  }
});

// ---------------- IPC: 렌더러 <-> 메인 데이터 통신 ----------------
// 실제 서버 DB가 붙기 전까지, 여기서 지점코드/고객사ID 기반으로
// 데이터를 걸러주는 로직을 그대로 유지하면 나중에 DB 교체가 쉬워집니다.

ipcMain.handle('login', async (event, { companyId, branchCode, userId, password }) => {
  return store.login(companyId, branchCode, userId, password);
});

ipcMain.handle('customers:list', async (event, { companyId, branchCode }) => {
  return store.list('customers', companyId, branchCode);
});

ipcMain.handle('customers:save', async (event, { companyId, branchCode, record }) => {
  return store.save('customers', companyId, branchCode, record);
});

ipcMain.handle('customers:delete', async (event, { companyId, branchCode, id }) => {
  return store.remove('customers', companyId, branchCode, id);
});

// ---------------- 고지서관리 ----------------
ipcMain.handle('invoices:list', async (event, { companyId, branchCode }) => {
  return store.list('invoices', companyId, branchCode);
});

ipcMain.handle('invoices:save', async (event, { companyId, branchCode, record }) => {
  return store.save('invoices', companyId, branchCode, record);
});

ipcMain.handle('invoices:delete', async (event, { companyId, branchCode, id }) => {
  return store.remove('invoices', companyId, branchCode, id);
});

// ---------------- 기준정보 > 회사정보 등록 (지점당 1건) ----------------
ipcMain.handle('companyInfo:get', async (event, { companyId, branchCode }) => {
  const list = store.list('companyInfo', companyId, branchCode);
  return list[0] || null;
});

ipcMain.handle('companyInfo:save', async (event, { companyId, branchCode, record }) => {
  record.id = 'main';
  return store.save('companyInfo', companyId, branchCode, record);
});

// ---------------- 수금관리 ----------------
ipcMain.handle('payments:list', async (event, { companyId, branchCode }) => {
  return store.list('payments', companyId, branchCode);
});

ipcMain.handle('payments:save', async (event, { companyId, branchCode, record }) => {
  return store.save('payments', companyId, branchCode, record);
});

ipcMain.handle('payments:delete', async (event, { companyId, branchCode, id }) => {
  return store.remove('payments', companyId, branchCode, id);
});

// ---------------- 교육관리 ----------------
ipcMain.handle('educations:list', async (event, { companyId, branchCode }) => {
  return store.list('educations', companyId, branchCode);
});
ipcMain.handle('educations:save', async (event, { companyId, branchCode, record }) => {
  return store.save('educations', companyId, branchCode, record);
});
ipcMain.handle('educations:delete', async (event, { companyId, branchCode, id }) => {
  return store.remove('educations', companyId, branchCode, id);
});

ipcMain.handle('trainees:list', async (event, { companyId, branchCode }) => {
  return store.list('trainees', companyId, branchCode);
});
ipcMain.handle('trainees:save', async (event, { companyId, branchCode, record }) => {
  return store.save('trainees', companyId, branchCode, record);
});
ipcMain.handle('trainees:delete', async (event, { companyId, branchCode, id }) => {
  return store.remove('trainees', companyId, branchCode, id);
});

// ---------------- 기타관리 > 사용자관리 ----------------
ipcMain.handle('users:list', async (event, { companyId }) => {
  return store.listUsers(companyId);
});
ipcMain.handle('users:save', async (event, { companyId, record }) => {
  return store.saveUser(companyId, record);
});
ipcMain.handle('users:delete', async (event, { companyId, id }) => {
  return store.deleteUser(companyId, id);
});

// ---------------- 출력관리 > 계산서 등록/출력 ----------------
ipcMain.handle('taxDocs:list', async (event, { companyId, branchCode }) => {
  return store.list('taxDocs', companyId, branchCode);
});
ipcMain.handle('taxDocs:save', async (event, { companyId, branchCode, record }) => {
  return store.save('taxDocs', companyId, branchCode, record);
});
ipcMain.handle('taxDocs:delete', async (event, { companyId, branchCode, id }) => {
  return store.remove('taxDocs', companyId, branchCode, id);
});

// ---------------- 기준정보 > 통합코드등록 ----------------
ipcMain.handle('commonCodes:list', async (event, { companyId, branchCode }) => {
  return store.list('commonCodes', companyId, branchCode);
});
ipcMain.handle('commonCodes:save', async (event, { companyId, branchCode, record }) => {
  return store.save('commonCodes', companyId, branchCode, record);
});
ipcMain.handle('commonCodes:delete', async (event, { companyId, branchCode, id }) => {
  return store.remove('commonCodes', companyId, branchCode, id);
});

// ---------------- 기준정보 > 인사정보관리 ----------------
ipcMain.handle('hrEmployees:list', async (event, { companyId, branchCode }) => {
  return store.list('hrEmployees', companyId, branchCode);
});
ipcMain.handle('hrEmployees:save', async (event, { companyId, branchCode, record }) => {
  return store.save('hrEmployees', companyId, branchCode, record);
});
ipcMain.handle('hrEmployees:delete', async (event, { companyId, branchCode, id }) => {
  return store.remove('hrEmployees', companyId, branchCode, id);
});

// ---------------- 통합코드등록 > ROOT 레벨 코드그룹 메타데이터 (비고1~순서) ----------------
ipcMain.handle('codeGroupMeta:list', async (event, { companyId, branchCode }) => {
  return store.list('codeGroupMeta', companyId, branchCode);
});
ipcMain.handle('codeGroupMeta:save', async (event, { companyId, branchCode, groupCode, fields }) => {
  return store.upsertBy('codeGroupMeta', companyId, branchCode, 'groupCode', groupCode, fields);
});

// ---------------- 교육관리 > 교육자료 UPLOAD ----------------
ipcMain.handle('eduUploadEntries:list', async (event, { companyId, branchCode }) => {
  return store.list('eduUploadEntries', companyId, branchCode);
});
ipcMain.handle('eduUploadEntries:save', async (event, { companyId, branchCode, record }) => {
  return store.save('eduUploadEntries', companyId, branchCode, record);
});
ipcMain.handle('eduUploadEntries:delete', async (event, { companyId, branchCode, id }) => {
  return store.remove('eduUploadEntries', companyId, branchCode, id);
});

// ---------------- 교육관리 > 교육출력관리 > 교육확인서 데이터 (사업장 단위 집계) ----------------
ipcMain.handle('eduConfirmDocs:list', async (event, { companyId, branchCode }) => {
  return store.list('eduConfirmDocs', companyId, branchCode);
});
ipcMain.handle('eduConfirmDocs:save', async (event, { companyId, branchCode, record }) => {
  return store.save('eduConfirmDocs', companyId, branchCode, record);
});
ipcMain.handle('eduConfirmDocs:delete', async (event, { companyId, branchCode, id }) => {
  return store.remove('eduConfirmDocs', companyId, branchCode, id);
});

// ---------------- 기타관리 > 프로그램 관리 ----------------
ipcMain.handle('programs:list', async (event, { companyId, branchCode }) => {
  return store.list('programs', companyId, branchCode);
});
ipcMain.handle('programs:save', async (event, { companyId, branchCode, record }) => {
  return store.save('programs', companyId, branchCode, record);
});
ipcMain.handle('programs:delete', async (event, { companyId, branchCode, id }) => {
  return store.remove('programs', companyId, branchCode, id);
});
ipcMain.handle('programPermissions:list', async (event, { companyId, branchCode }) => {
  return store.list('programPermissions', companyId, branchCode);
});
ipcMain.handle('programPermissions:save', async (event, { companyId, branchCode, record }) => {
  return store.save('programPermissions', companyId, branchCode, record);
});
ipcMain.handle('programPermissions:delete', async (event, { companyId, branchCode, id }) => {
  return store.remove('programPermissions', companyId, branchCode, id);
});
ipcMain.handle('groupPermissions:list', async (event, { companyId, branchCode }) => {
  return store.list('groupPermissions', companyId, branchCode);
});
ipcMain.handle('groupPermissions:save', async (event, { companyId, branchCode, record }) => {
  return store.save('groupPermissions', companyId, branchCode, record);
});
ipcMain.handle('groupPermissions:delete', async (event, { companyId, branchCode, id }) => {
  return store.remove('groupPermissions', companyId, branchCode, id);
});

// ---------------- 앱 종료 (원본 "종료" 버튼 확인창용) ----------------
ipcMain.handle('app:quit', () => {
  isQuitting = true;
  app.quit();
});

// ---------------- 온보딩 상태 ----------------
ipcMain.handle('onboarding:get', async () => {
  try {
    const list = store.list('appMeta', 'GENSYS', 'GLOBAL');
    const rec = list.find(r => r.key === 'onboardingDone');
    return rec ? rec.value : false;
  } catch { return false; }
});
ipcMain.handle('onboarding:set', async (event, { done }) => {
  return store.upsertBy('appMeta', 'GENSYS', 'GLOBAL', 'key', 'onboardingDone', { value: done });
});

// ---------------- 엑셀(.xlsx/.xls) 파일 읽기 (교육자료 UPLOAD 등에서 사용) ----------------
ipcMain.handle('excel:parseFile', async (event, { filePath }) => {
  try {
    // P0-01 경로주입 차단: renderer가 임의 경로를 넘기면 allowlist 검증 + 크기 제한
    const { dialog } = require('electron');
    let targetPath = filePath;
    if (!targetPath) {
      const res = await dialog.showOpenDialog(mainWindow, { filters: [{ name: 'Excel', extensions: ['xlsx','xls'] }], properties: ['openFile'] });
      if (res.canceled || !res.filePaths[0]) return { ok:false, message:'취소됨' };
      targetPath = res.filePaths[0];
    }
    const resolved = path.resolve(targetPath);
    const allowed = [app.getPath('downloads'), app.getPath('temp'), app.getPath('userData'), app.getPath('documents')].map(p=>path.resolve(p));
    if (!allowed.some(base => resolved.startsWith(base))) return { ok:false, message:'허용되지 않은 경로' };
    const stat = fs.statSync(resolved);
    if (stat.size > 10*1024*1024) return { ok:false, message:'10MB 초과' };
    if (resolved.includes('..')) return { ok:false, message:'경로 오류' };
    const wb = XLSX.readFile(resolved, { cellDates: false, sheetRows: 10000, WTF:false });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
    return { ok: true, rows };
  } catch (err) {
    return { ok: false, message: err.message };
  }
});

// ---------------- 출력관리: 인쇄 ----------------
ipcMain.handle('print:html', async (event, { html, fileName }) => {
  const { randomUUID } = require('crypto');
  const printWin = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true } });
  let tmpHtmlPath = '';
  try {
    const tmpDir = app.getPath('temp');
    tmpHtmlPath = path.join(tmpDir, `print-${randomUUID()}.html`);
    // DOMPurify 정제 (html 문자열은 렌더러에서 1차 정제, 메인에서 2차)
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
    return { success: true, path: pdfPath };
  } catch (err) {
    return { success: false, error: err.message };
  } finally {
    try { if (tmpHtmlPath) fs.unlinkSync(tmpHtmlPath); } catch {}
    printWin.close();
  }
});
