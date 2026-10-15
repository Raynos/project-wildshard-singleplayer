#!/usr/bin/env node
// G430: evict old generation-cache entries (scripts/generation-cache.mjs pruneGenerationCache; docs/process/GENERATION.md).
//   node scripts/generation-cache-prune.mjs [--dry-run] [--keep=3] [--cap-gb=20] [--cache=<dir>]
import { generationCacheRoot, pruneGenerationCache } from './generation-cache.mjs';

const arg = (/** @type {string} */ flag) => process.argv.find(item => item.startsWith(`--${flag}=`))?.slice(flag.length + 3);
const number = (/** @type {string} */ flag, /** @type {number} */ fallback) => {
  const text = arg(flag);
  if (text === undefined) return fallback;
  const value = Number(text);
  if (!Number.isFinite(value) || value < 0) throw new Error(`--${flag} must be a non-negative number`);
  return value;
};
const cacheDir = arg('cache') ?? generationCacheRoot(), dryRun = process.argv.includes('--dry-run');
const report = pruneGenerationCache(cacheDir, { keep: number('keep', 3), capBytes: number('cap-gb', 20) * 1024 ** 3, dryRun });
const gb = (/** @type {number} */ bytes) => `${(bytes / 1024 ** 3).toFixed(1)} GB`;
/** @type {Map<string, {count:number,bytes:number}>} */
const byJob = new Map();
for (const entry of report.deleted) {
  const row = byJob.get(entry.job) ?? { count: 0, bytes: 0 };
  row.count += 1; row.bytes += entry.bytes; byJob.set(entry.job, row);
}
for (const [job, row] of [...byJob].sort((a, b) => b[1].bytes - a[1].bytes).slice(0, 15)) console.log(`  ${job}: ${row.count} entries, ${gb(row.bytes)}`);
console.log(`generation-cache ${dryRun ? 'would delete' : 'deleted'} ${report.deleted.length} entries (${gb(report.freedBytes)}); `
  + `kept ${report.keptEntries} (${gb(report.keptBytes)}); ${report.locked} locked left alone; ${cacheDir}`);
