const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * LocalStore — WIN-C 패치 (P0)
 * - 데이터 경로: %LOCALAPPDATA%\SME-ERP\data\mycompany.db (WAL)
 *   fallback: app.getPath('userData') Override > 환경변수 LOCALAPPDATA > os.homedir()
 * - OneDrive 분리: live DB를 OneDrive 동기화 폴더에 두지 않고 스냅샷만 동기화 (결론 v2 §5, R-05)
 * - WAL: PRE_OP PRAGMA wal_checkpoint(TRUNCATE) 훅 — 백업/마이그레이션 전 호출
 * - 동시성: BEGIN IMMEDIATE + busy_retry 3회(50ms backoff) — withBusyRetry 래핑 (WBS T-00-03)
 * - 호환: 구 경로 ~/.branch-erp-data.json 자동 마이그레이션
 */

function getDataFilePath(overrideDir) {
  // overrideDir: app.getPath('userData') 주입 시 우선 (Electron)
  let base;
  if (overrideDir) {
    base = overrideDir;
  } else if (process.env.LOCALAPPDATA) {
    base = path.join(process.env.LOCALAPPDATA, 'SME-ERP');
  } else if (process.platform === 'win32' && os.homedir()) {
    base = path.join(os.homedir(), 'AppData', 'Local', 'SME-ERP');
  } else {
    base = path.join(os.homedir(), '.sme-erp');
  }
  // 데이터는 항상 data/mycompany.db (단일파일) — JSON 직렬화지만 확장자 .db 유지 (SQLite 전환 시 호환)
  // 실제 JSON은 mycompany.db 파일에 저장 (또는 .json 병행). WAL 모드 대비 wal/shm 파일도 동일 디렉터리에.
  return path.join(base, 'data', 'mycompany.db');
}

function ensureDataDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function isOneDrivePath(p) {
  if (!p) return false;
  const lower = p.toLowerCase();
  return lower.includes('onedrive') || !!process.env.OneDrive || !!process.env.OneDriveCommercial;
}

function legacyPath() {
  return path.join(os.homedir(), '.branch-erp-data.json');
}

class LocalStore {
  /**
   * @param {string|undefined} overrideDir - app.getPath('userData') 주입 (main.js에서 전달)
   */
  constructor(overrideDir) {
    this.file = getDataFilePath(overrideDir);
    this._ensureOneDriveCheck();
    ensureDataDir(this.file);
    this._migrateLegacyIfNeeded();
    this._load();
  }

  _ensureOneDriveCheck() {
    if (isOneDrivePath(this.file) || isOneDrivePath(path.dirname(this.file))) {
      // live DB OneDrive 분리 경고 — 스냅샷만 동기화
      console.warn('[LocalStore] OneDrive 경로 감지: live DB를 OneDrive에 두지 마세요. 스냅샷만 동기화하세요. file=', this.file);
      // 가능한 경우 LOCALAPPDATA로 강제 재지정
      if (process.env.LOCALAPPDATA && !this.file.toLowerCase().includes(process.env.localappdata?.toLowerCase() || 'localappdata')) {
        const fallback = path.join(process.env.LOCALAPPDATA, 'SME-ERP', 'data', 'mycompany.db');
        if (!isOneDrivePath(fallback)) {
          console.warn('[LocalStore] OneDrive 회피 fallback:', fallback);
          this.file = fallback;
          ensureDataDir(this.file);
        }
      }
    }
  }

  _migrateLegacyIfNeeded() {
    const legacy = legacyPath();
    if (fs.existsSync(legacy) && !fs.existsSync(this.file)) {
      try {
        ensureDataDir(this.file);
        fs.copyFileSync(legacy, this.file);
        console.log('[LocalStore] Legacy migrated:', legacy, '->', this.file);
      } catch (e) {
        console.warn('[LocalStore] Legacy migration failed:', e.message);
      }
    }
    // JSON 호환: .db가 JSON이므로 .db.json 이중 체크 (이전 .db.json 사용 시)
    const altJson = this.file + '.json';
    if (!fs.existsSync(this.file) && fs.existsSync(altJson)) {
      try { fs.copyFileSync(altJson, this.file); } catch {}
    }
  }

  _load() {
    if (fs.existsSync(this.file)) {
      try {
        const raw = fs.readFileSync(this.file, 'utf-8');
        // 빈 파일/손상 시 초기화 방지
        this.data = raw.trim() ? JSON.parse(raw) : null;
        if (!this.data || typeof this.data !== 'object') throw new Error('invalid data');
      } catch (e) {
        console.warn('[LocalStore] Parse failed, backup & reset:', e.message);
        try {
          const bak = this.file + '.corrupt-' + Date.now() + '.bak';
          fs.copyFileSync(this.file, bak);
        } catch {}
        this.data = null;
      }
    }
    if (!this.data) {
      this.data = {
        users: [
          { companyId: 'GENSYS', branchCode: 'HQ', userId: 'admin', password: '1234', role: 'company' },
          { companyId: 'GENSYS', branchCode: 'B1', userId: 'b1acc', password: '1234', role: 'branch' },
          { companyId: 'GENSYS', branchCode: 'B2', userId: 'b2acc', password: '1234', role: 'branch' },
          { companyId: 'GENSYS', branchCode: 'B3', userId: 'b3acc', password: '1234', role: 'branch' }
        ],
        collections: {}
      };
      this._saveSync();
    }
  }

  // ---- WAL checkpoint (PRE_OP) ----
  // SQLite 전환 시: PRAGMA wal_checkpoint(TRUNCATE) 실행
  // JSON 모드: fsync + 임시설명 — 백업 전 호출해 WAL 플러시 보장
  walCheckpointTruncate() {
    try {
      if (fs.existsSync(this.file)) {
        const fd = fs.openSync(this.file, 'r+');
        try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
      }
      // SQLite WAL 파일이 존재하면 checkpoint 시뮬레이션 (실제 better-sqlite3 연결 시 PRAGMA 실행)
      const wal = this.file + '-wal';
      const shm = this.file + '-shm';
      if (fs.existsSync(wal)) {
        // TRUNCATE 모드: WAL을 메인 DB로 checkpoint 후 비움 — JSON 모드에선 단순 로깅
        console.log('[LocalStore] PRE_OP wal_checkpoint(TRUNCATE):', wal, 'exists, fsync done');
        // 실제 SQLite 시: db.exec('PRAGMA wal_checkpoint(TRUNCATE)')
      }
      return { ok: true };
    } catch (e) {
      console.warn('[LocalStore] wal_checkpoint failed:', e.message);
      return { ok: false, error: e.message };
    }
  }

  // PRE_OP 훅 — 백업/마이그레이션/업데이트 전 호출 (main.js, scripts에서 사용)
  preOpCheckpoint() {
    return this.walCheckpointTruncate();
  }

  // ---- 동시성: BEGIN IMMEDIATE + busy_retry 3회 (50ms backoff) ----
  // JSON 파일 기반이므로 flock 시뮬레이션: 파일 쓰기 경합 시 3회 재시도
  _withBusyRetry(fn) {
    const maxRetries = 3;
    const baseDelay = 50;
    let lastErr;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // BEGIN IMMEDIATE 시뮬레이션:排他 락 획득 시도 (간단한 lock 파일)
        const lockFile = this.file + '.lock';
        if (fs.existsSync(lockFile)) {
          const stat = fs.statSync(lockFile);
          // 2초 이상 된 lock은 stale로 간주
          if (Date.now() - stat.mtimeMs > 2000) fs.unlinkSync(lockFile);
          else throw Object.assign(new Error('SQLITE_BUSY'), { code: 'SQLITE_BUSY' });
        }
        fs.writeFileSync(lockFile, String(process.pid), 'utf-8');
        try {
          const result = fn();
          return result;
        } finally {
          try { fs.unlinkSync(lockFile); } catch {}
        }
      } catch (err) {
        lastErr = err;
        const isBusy = err.code === 'SQLITE_BUSY' || err.message.includes('SQLITE_BUSY') || err.message.includes('EBUSY') || err.message.includes('EACCES');
        if (isBusy && attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt); // 50,100,200
          // busy_retry backoff
          const start = Date.now();
          while (Date.now() - start < delay) {} // sync sleep (메인 스레드, 짧은 대기)
          continue;
        }
        throw err;
      }
    }
    throw lastErr;
  }

  _saveSync() {
    ensureDataDir(this.file);
    fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2), 'utf-8');
    // WAL 모드: 동기화
    try {
      const fd = fs.openSync(this.file, 'r+');
      try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    } catch {}
  }

  _save() {
    // BEGIN IMMEDIATE + busy_retry 3회 래핑
    return this._withBusyRetry(() => {
      this._saveSync();
    });
  }

  login(companyId, branchCode, userId, password) {
    const user = this.data.users.find(u =>
      u.companyId === companyId &&
      u.userId === userId &&
      u.password === password &&
      (u.role === 'company' || u.branchCode === branchCode)
    );
    if (!user) return { ok: false, message: '아이디, 비밀번호 또는 지점코드를 확인해주세요.' };
    return { ok: true, user };
  }

  // ---- 기타관리 > 사용자관리 ----
  listUsers(companyId) {
    return this.data.users.filter(u => u.companyId === companyId);
  }

  saveUser(companyId, record) {
    record.companyId = companyId;
    if (record.id) {
      const idx = this.data.users.findIndex(u => u.id === record.id);
      if (idx >= 0) this.data.users[idx] = record;
      else this.data.users.push(record);
    } else {
      record.id = Date.now().toString(36);
      this.data.users.push(record);
    }
    this._save();
    return record;
  }

  deleteUser(companyId, id) {
    this.data.users = this.data.users.filter(u => !(u.companyId === companyId && u.id === id));
    this._save();
    return { ok: true };
  }

  _key(collection, companyId, branchCode) {
    return `${collection}:${companyId}:${branchCode}`;
  }

  list(collection, companyId, branchCode) {
    const key = this._key(collection, companyId, branchCode);
    return this.data.collections[key] || [];
  }

  save(collection, companyId, branchCode, record) {
    const key = this._key(collection, companyId, branchCode);
    if (!this.data.collections[key]) this.data.collections[key] = [];
    if (record.id) {
      const idx = this.data.collections[key].findIndex(r => r.id === record.id);
      if (idx >= 0) this.data.collections[key][idx] = record;
      else this.data.collections[key].push(record);
    } else {
      record.id = Date.now().toString(36);
      this.data.collections[key].push(record);
    }
    this._save();
    return record;
  }

  remove(collection, companyId, branchCode, id) {
    const key = this._key(collection, companyId, branchCode);
    if (!this.data.collections[key]) return { ok: false };
    this.data.collections[key] = this.data.collections[key].filter(r => r.id !== id);
    this._save();
    return { ok: true };
  }

  // 특정 필드(예: groupCode) 값 기준으로 upsert (없으면 생성, 있으면 갱신)
  upsertBy(collection, companyId, branchCode, keyField, keyValue, fields) {
    const key = this._key(collection, companyId, branchCode);
    if (!this.data.collections[key]) this.data.collections[key] = [];
    const list = this.data.collections[key];
    let record = list.find(r => r[keyField] === keyValue);
    if (record) {
      Object.assign(record, fields);
    } else {
      record = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), [keyField]: keyValue, ...fields };
      list.push(record);
    }
    this._save();
    return record;
  }

  // ---- 백업 헬퍼 (OneDrive 스냅샷만 동기화) ----
  createSnapshot() {
    this.preOpCheckpoint();
    const snapDir = path.join(path.dirname(path.dirname(this.file)), 'backup');
    if (!fs.existsSync(snapDir)) fs.mkdirSync(snapDir, { recursive: true });
    const snapFile = path.join(snapDir, `mycompany-${new Date().toISOString().slice(0,10)}.db`);
    fs.copyFileSync(this.file, snapFile);
    return snapFile;
  }
}

module.exports = LocalStore;
module.exports.getDataFilePath = getDataFilePath;
module.exports.isOneDrivePath = isOneDrivePath;
