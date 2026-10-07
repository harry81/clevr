'use strict';
// scripts/release.js — SemVer 태그 릴리즈 헬퍼 (Node 내장 모듈만: child_process, fs, path)
// 순수 로직(아래 함수)은 export되어 단위 테스트 가능. CLI는 require.main===module 가드 안쪽에서만 실행.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const VERSION_RE = /^v?(\d+)\.(\d+)\.(\d+)$/;
const KIND_SET = new Set(['patch', 'minor', 'major']);

function normalizeInput(s) {
  if (typeof s !== 'string') throw new Error(`Invalid version (무효한 버전): ${String(s)}`);
  return s.trim();
}

// "0.1.0" / "v0.1.0" / 앞뒤 공백 허용 → { major, minor, patch }. 그 외(빈 문자열, prerelease 등)는 throw.
// 선행 0 허용 (예: "01.02.03" → {1,2,3}). prerelease("-beta", "+build" 등)는 정규식 불일치로 reject.
function parseVersion(s) {
  const t = normalizeInput(s);
  const m = VERSION_RE.exec(t);
  if (!m) throw new Error(`Invalid version (무효한 버전): ${JSON.stringify(s)} — expected X.Y.Z`);
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

function formatTag(v) {
  const o = typeof v === 'string' ? parseVersion(v) : v;
  assertVersionObj(o);
  return `v${o.major}.${o.minor}.${o.patch}`;
}

// 태그("v0.1.0" / "0.1.0" / 공백 허용) → "X.Y.Z" 정규형. 무효 시 throw.
function stripTagPrefix(tag) {
  const o = parseVersion(tag);
  return `${o.major}.${o.minor}.${o.patch}`;
}

function assertVersionObj(o) {
  if (!o || typeof o !== 'object' || !Number.isInteger(o.major) || !Number.isInteger(o.minor) || !Number.isInteger(o.patch) || o.major < 0 || o.minor < 0 || o.patch < 0) {
    throw new Error(`Invalid version object (무효한 버전 객체): ${JSON.stringify(o)}`);
  }
}

function toVersionObj(v) {
  if (typeof v === 'string') return parseVersion(v);
  assertVersionObj(v);
  return { major: v.major, minor: v.minor, patch: v.patch };
}

// 새 객체 반환 (입력 불변). minor→patch=0 리셋, major→minor=patch=0 리셋.
function bumpVersion(version, kind) {
  const o = toVersionObj(version);
  if (!KIND_SET.has(kind)) throw new Error(`Invalid bump kind (무효한 bump 종류): ${String(kind)} — patch|minor|major`);
  if (kind === 'patch') return { major: o.major, minor: o.minor, patch: o.patch + 1 };
  if (kind === 'minor') return { major: o.major, minor: o.minor + 1, patch: 0 };
  return { major: o.major + 1, minor: 0, patch: 0 };
}

function isValidVersion(s) {
  try {
    parseVersion(s);
    return true;
  } catch {
    return false;
  }
}

// a, b는 객체 또는 문자열. -1 | 0 | 1.
function compareVersions(a, b) {
  const x = toVersionObj(a);
  const y = toVersionObj(b);
  for (const k of ['major', 'minor', 'patch']) {
    if (x[k] < y[k]) return -1;
    if (x[k] > y[k]) return 1;
  }
  return 0;
}

// 첫 릴리즈 여부: git 태그가 하나도 없을 때 true. current/latestTag는 객체 또는 문자열(null 허용).
function isFirstRelease(current, latestTag) {
  toVersionObj(current); // current 유효성 검증
  if (latestTag === null || latestTag === undefined) return true;
  if (typeof latestTag === 'string' && latestTag.trim() === '') return true;
  toVersionObj(typeof latestTag === 'string' ? stripTagPrefix(latestTag) : latestTag);
  return false;
}

// 목표 버전 결정 정책 (명문화):
//  (a) arg가 X.Y.Z(또는 vX.Y.Z)면 그 버전 그대로.
//  (b) arg가 patch|minor|major면 current 기준 bump.
//  (c) arg 없음:
//      - latestTag == null(첫 릴리즈, untagged) → current 그대로 (첫 릴리즈 태깅).
//      - latestTag == current(이미 릴리즈됨) → current 기준 patch bump.
//      - latestTag < current(개발 선행) → current 그대로 (새 버전 태깅).
//      - latestTag > current(package.json이 태그보다 뒤처짐) → current 그대로
//        (package.json을 source of truth로 우선. 태그 존재 게이트에서 중복 시 중단됨).
function resolveTargetVersion({ current, latestTag = null, arg = undefined }) {
  const cur = toVersionObj(current);
  let latest = null;
  if (latestTag !== null && latestTag !== undefined && !(typeof latestTag === 'string' && latestTag.trim() === '')) {
    latest = toVersionObj(typeof latestTag === 'string' ? stripTagPrefix(latestTag) : latestTag);
  }

  if (arg !== undefined && arg !== null && String(arg).trim() !== '') {
    const a = String(arg).trim();
    if (KIND_SET.has(a)) return bumpVersion(cur, a);
    if (isValidVersion(a)) return parseVersion(a);
    throw new Error(`Invalid arg (무효한 인자): ${JSON.stringify(arg)} — patch|minor|major|X.Y.Z`);
  }

  if (latest === null) return { ...cur }; // 첫 릴리즈
  const cmp = compareVersions(cur, latest);
  if (cmp === 0) return bumpVersion(cur, 'patch'); // 이미 릴리즈됨 → patch bump
  return { ...cur }; // current 우선 (앞서든 뒤처지든)
}

function formatVersion(o) {
  const v = toVersionObj(o);
  return `${v.major}.${v.minor}.${v.patch}`;
}

// ---- CLI 효과(effect) 영역: 순수 함수와 분리 ----
function run(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts }).trim();
}

function getLatestTag() {
  try {
    const t = run('git', ['describe', '--tags', '--abbrev=0']);
    return t === '' ? null : t;
  } catch {
    return null; // 태그 없음 (no tags yet)
  }
}

function printHelp() {
  console.log(`Usage (사용법): node scripts/release.js [patch|minor|major|X.Y.Z] [--dry-run] [--push] [--yes] [--help]

Examples (예시):
  node scripts/release.js                # 자동 결정 (첫 릴리즈→현 버전 태깅, 이미 릴리즈됨→patch bump)
  node scripts/release.js patch          # 0.1.0 → 0.1.1
  node scripts/release.js minor          # 0.1.0 → 0.2.0
  node scripts/release.js major          # 0.1.0 → 1.0.0
  node scripts/release.js 0.2.0          # 직접 지정
  node scripts/release.js patch --dry-run  # 실제 변경 없이 계획만 출력
  node scripts/release.js patch --push     # 태그 후 git push + push tag
  node scripts/release.js patch --yes      # main/master 분기 경고 자동 승인 (dirty 우회 불가)

Gates (게이트 순서): package.json 읽기 → 최신 태그 조회 → 미커밋 변경 확인(dirty면 중단, --yes로도 우회 불가)
  → 브랜치 확인(main/master 아니면 --yes 없이 중단) → 목표 버전 결정 → npm test(--dry-run이면 스킵)
  → package.json 업데이트 → commit → tag(중복 시 중단) → push 안내 또는 --push 시 push.`);
}

function main(argv) {
  const raw = argv.slice(2);
  if (raw.includes('--help') || raw.includes('-h')) {
    printHelp();
    return 0;
  }
  let positional;
  let dryRun = false;
  let push = false;
  let yes = false;
  for (const a of raw) {
    if (a === '--dry-run') dryRun = true;
    else if (a === '--push') push = true;
    else if (a === '--yes') yes = true;
    else if (a.startsWith('--')) {
      console.error(`Unknown option (알 수 없는 옵션): ${a}`);
      printHelp();
      return 1;
    } else if (positional === undefined) {
      positional = a;
    } else {
      console.error(`Too many positional args (위치 인자 초과): ${a}`);
      printHelp();
      return 1;
    }
  }

  // 1. package.json 버전 읽기
  const pkgPath = path.join(__dirname, '..', 'package.json');
  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  } catch (e) {
    console.error(`package.json read failed (읽기 실패): ${e.message}`);
    return 1;
  }
  let current;
  try {
    current = parseVersion(pkg.version);
  } catch (e) {
    console.error(`package.json version invalid (버전 무효): ${e.message}`);
    return 1;
  }
  console.log(`[1/8] current package.json version: ${formatVersion(current)}`);

  // 2. git 최신 태그 조회
  const latestTag = getLatestTag();
  console.log(`[2/8] latest git tag: ${latestTag === null ? '(none, 첫 릴리즈 가능)' : latestTag}`);

  // 3. 미커밋 변경 확인 (--yes로도 우회 불가)
  let status;
  try {
    status = run('git', ['status', '--porcelain']);
  } catch (e) {
    console.error(`git status failed (상태 확인 실패): ${(e.stderr || e.message || '').toString().trim()}`);
    return 1;
  }
  if (status !== '') {
    console.error('Working tree is dirty (미커밋 변경 있음). Commit or stash first (먼저 커밋/스태시하세요). --yes로도 우회 불가.');
    console.error(status.split('\n').slice(0, 10).join('\n'));
    return 1;
  }
  console.log('[3/8] working tree clean.');

  // 4. 현재 브랜치 확인
  let branch = '';
  try {
    branch = run('git', ['branch', '--show-current']);
  } catch {
    branch = '';
  }
  console.log(`[4/8] current branch: ${branch || '(detached/unknown)'}`);
  if (branch !== 'main' && branch !== 'master') {
    if (!yes) {
      console.error(`Not on main/master (main/master 브랜치가 아님: ${branch || 'unknown'}). Use --yes to proceed (진행하려면 --yes).`);
      return 1;
    }
    console.log('  --yes: non-main branch warning accepted (경고 승인됨).');
  }

  // 5. 목표 버전 결정
  let target;
  try {
    target = resolveTargetVersion({ current, latestTag, arg: positional });
  } catch (e) {
    console.error(`Target version failed (목표 버전 결정 실패): ${e.message}`);
    return 1;
  }
  const targetStr = formatVersion(target);
  const tag = formatTag(target);
  console.log(`[5/8] target version: ${targetStr} (tag ${tag})${dryRun ? ' [dry-run]' : ''}`);

  // 6. npm test (--dry-run이면 스킵 명시)
  if (dryRun) {
    console.log('[6/8] skip npm test (--dry-run, 테스트 스킵).');
  } else {
    console.log('[6/8] running npm test...');
    try {
      execFileSync('npm', ['test'], { stdio: 'inherit' });
    } catch {
      console.error('npm test failed (테스트 실패). Aborting release (릴리즈 중단).');
      return 1;
    }
  }

  // 7. package.json version 업데이트 + commit
  if (dryRun) {
    console.log(`[7/8] dry-run: would set package.json version → ${targetStr}, commit + tag ${tag} (실제 변경 없음).`);
  } else {
    if (formatVersion(current) !== targetStr) {
      pkg.version = targetStr;
      fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
      console.log(`[7/8] package.json version updated → ${targetStr}`);
    } else {
      console.log('[7/8] package.json version unchanged (변경 없음, 첫 릴리즈 태깅).');
    }
    const after = run('git', ['status', '--porcelain']);
    if (after !== '') {
      run('git', ['add', 'package.json']);
      run('git', ['commit', '-m', `chore(release): ${tag}`]);
      console.log(`  committed: chore(release): ${tag}`);
    } else {
      console.log('  nothing to commit (커밋할 변경 없음).');
    }
    // 8. tag (이미 존재 시 중단)
    try {
      run('git', ['rev-parse', '-q', '--verify', `refs/tags/${tag}`]);
      console.error(`Tag already exists (태그 이미 존재): ${tag}. Aborting (중단).`);
      return 1;
    } catch {
      // rev-parse 실패 = 태그 없음 → 진행
    }
    run('git', ['tag', tag]);
    console.log(`[8/8] tagged ${tag}`);
  }

  if (dryRun) {
    console.log(`Done (dry-run). Next (다음 단계): node scripts/release.js ${positional || ''} --push`.trim());
    return 0;
  }
  if (push) {
    run('git', ['push'], { stdio: 'inherit' });
    run('git', ['push', 'origin', tag], { stdio: 'inherit' });
    console.log(`Pushed branch + tag ${tag} (푸시 완료). Actions release workflow will trigger on ${tag} (v* 태그 푸시로 자동 실행).`);
  } else {
    console.log(`Next (다음 단계): git push && git push origin ${tag}  (또는 --push 옵션으로 자동 푸시)`);
  }
  return 0;
}

module.exports = {
  parseVersion,
  formatTag,
  stripTagPrefix,
  bumpVersion,
  resolveTargetVersion,
  isValidVersion,
  compareVersions,
  isFirstRelease,
  formatVersion,
};

if (require.main === module) {
  process.exitCode = main(process.argv);
}
