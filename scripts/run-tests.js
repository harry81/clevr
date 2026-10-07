'use strict';
// scripts/run-tests.js — 크로스 플랫폼 테스트 러너 (외부 의존성 0, Node 내장만)
// 셸 glob 확장에 의존하지 않고 tests/unit 하위의 '*.test.js'를 직접 재귀 탐색해
// 현재 Node 실행 파일(process.execPath)로 `--test`를 구동한다. (Windows pwsh 호환)
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

// dir 하위의 '*.test.js' 파일을 재귀 수집해 정렬된 절대경로 배열로 반환한다.
// dir가 없으면 빈 배열을 반환한다(예외 아님).
function findTestFiles(dir) {
  const found = [];
  if (!fs.existsSync(dir)) return found;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...findTestFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.test.js')) {
      found.push(full);
    }
  }
  return found.sort();
}

function main() {
  const unitDir = path.join(__dirname, '..', 'tests', 'unit');
  const files = findTestFiles(unitDir);
  if (files.length === 0) {
    console.error(`No test files found under ${unitDir} (테스트 파일 0건)`);
    return 1;
  }
  console.log(`Running ${files.length} test file(s) via node --test`);
  const result = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' });
  if (result.error) {
    console.error(`Failed to spawn test runner (실행 실패): ${result.error.message}`);
    return 1;
  }
  return result.status === null ? 1 : result.status;
}

if (require.main === module) {
  process.exitCode = main();
}

module.exports = { findTestFiles };
