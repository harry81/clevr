'use strict';
// scripts/growth/fetch_metrics.js — GitHub API 전용 지표 수집기 (외부 의존성 0: node:fs만, fetch는 Node 내장)
// 사용: node scripts/growth/fetch_metrics.js [--dry-run] [--json <path>]
//   --dry-run: 네트워크 호출 없이 계획만 출력하고 exit 0 (토큰 불필요)
const fs = require('node:fs');
const path = require('node:path');

const REPO = 'harry81/clevr';
const API = 'https://api.github.com';

function headers() {
  const h = { 'User-Agent': 'sme-erp-growth-metrics', Accept: 'application/vnd.github+json' };
  if (process.env.GITHUB_TOKEN) h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
}

// GitHub API 응답 → AARRR에 매핑 가능한 원시 지표 (자동 수집은 다운로드/커뮤니티까지)
function summarize(repo, releases) {
  const assets = (releases || []).flatMap((r) => (r.assets || []).map((a) => ({ name: a.name, downloads: a.download_count })));
  const totalDownloads = assets.reduce((s, a) => s + a.downloads, 0);
  return {
    repo: REPO,
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    openIssues: repo.open_issues_count,
    releaseCount: (releases || []).length,
    totalDownloads,
    assets,
    fetchedAt: new Date().toISOString(),
  };
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) throw new Error(`GitHub API ${res.status} ${url}`);
  return res.json();
}

async function run({ json } = {}) {
  const [repo, releases] = await Promise.all([
    fetchJson(`${API}/repos/${REPO}`),
    fetchJson(`${API}/repos/${REPO}/releases?per_page=100`),
  ]);
  const data = summarize(repo, releases);
  const out = JSON.stringify(data, null, 2);
  if (json) {
    fs.mkdirSync(path.dirname(json), { recursive: true });
    fs.writeFileSync(json, out + '\n', 'utf8');
    console.log(`[OK] 지표 저장: ${json} (다운로드 ${data.totalDownloads})`);
  } else {
    console.log(out);
  }
  return data;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const jsonIdx = args.indexOf('--json');
  const json = jsonIdx !== -1 ? args[jsonIdx + 1] : null;
  if (args.includes('--dry-run')) {
    console.log(`[DRY-RUN] GET ${API}/repos/${REPO}`);
    console.log(`[DRY-RUN] GET ${API}/repos/${REPO}/releases?per_page=100`);
    console.log(`[DRY-RUN] token=${process.env.GITHUB_TOKEN ? 'set' : 'unset'} (dry-run은 네트워크/토큰 불필요)`);
    process.exit(0);
  }
  run({ json }).catch((e) => { console.error(`[FAIL] ${e.message}`); process.exit(1); });
}

module.exports = { summarize, REPO };
