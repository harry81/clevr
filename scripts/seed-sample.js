/**
 * scripts/seed-sample.js — JS 래퍼 (ts-node 없이 node 직접 실행)
 * npx node scripts/seed-sample.js [--branch B1]
 */
require('ts-node').register({ transpileOnly: true });
require('./seed-sample.ts');
