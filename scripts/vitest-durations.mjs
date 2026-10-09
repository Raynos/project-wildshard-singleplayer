#!/usr/bin/env node
// SF74 W23: write test/durations.json (seconds per test file) for scripts/vitest-shard.ts from a vitest run's results
// cache (node_modules/.vite/vitest/<hash>/results.json: `<project>:<path>` → { duration ms }). Only files that exist
// are kept; a file's own project entry wins (integration for HEAVY_INTEGRATION_TESTS, else unit).
//
//   node scripts/vitest-durations.mjs [<results.json>…]   (default: every results.json under node_modules/.vite/vitest)
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const cacheDir = resolve(root, 'node_modules/.vite/vitest');
const sources = process.argv.length > 2 ? process.argv.slice(2)
  : existsSync(cacheDir) ? readdirSync(cacheDir).map((dir) => resolve(cacheDir, dir, 'results.json')).filter((file) => existsSync(file)) : [];
if (sources.length === 0) { console.error('vitest-durations: no results.json to read'); process.exit(1); }
const heavy = new Set([...readFileSync(resolve(root, 'vitest.config.ts'), 'utf8').matchAll(/^\s*'(test\/[^']+\.test\.ts)',$/gmu)].map((match) => match[1]));
/** @type {Map<string, number>} */
const seconds = new Map();
for (const source of sources) {
  const parsed = JSON.parse(readFileSync(source, 'utf8'));
  for (const row of Object.values(parsed.results ?? {})) {
    if (!Array.isArray(row) || typeof row[0] !== 'string' || typeof row[1]?.duration !== 'number') continue;
    const [project, ...rest] = row[0].split(':'), path = rest.join(':');
    if (project !== (heavy.has(path) ? 'integration' : 'unit') || !existsSync(resolve(root, path))) continue;
    seconds.set(path, Math.max(seconds.get(path) ?? 0, Math.round(row[1].duration / 100) / 10));
  }
}
const sorted = Object.fromEntries([...seconds].sort(([a], [b]) => (a < b ? -1 : 1)));
writeFileSync(resolve(root, 'test/durations.json'), `${JSON.stringify(sorted, null, 1)}\n`);
console.log(`vitest-durations: ${seconds.size} files, ${[...seconds.values()].reduce((a, b) => a + b, 0).toFixed(0)} s in total`);
