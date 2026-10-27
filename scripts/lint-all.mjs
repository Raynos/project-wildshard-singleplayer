#!/usr/bin/env node
// One type program per invocation, including an unpartitioned full-repository run.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { availableParallelism } from 'node:os';

const root = resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const shard = args.length === 1 ? /^--shard=([1-9]\d*)\/([1-9]\d*)$/u.exec(args[0]) : null;
const part = shard === null ? 1 : Number(shard[1]), parts = shard === null ? 1 : Number(shard[2]);
if ((args.length > 0 && shard === null) || !Number.isSafeInteger(part) || !Number.isSafeInteger(parts) || part > parts) {
  console.error('lint-all: expected --shard=PART/TOTAL with 1 <= PART <= TOTAL');
  process.exit(2);
}
const listed = spawnSync('pnpm', ['exec', 'oxlint', '--debug', 'files'], { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
if (listed.error !== undefined || listed.status !== 0) {
  console.error(listed.error?.message ?? listed.stderr);
  process.exit(listed.status ?? 1);
}
const files = listed.stdout.trim().split(/\r?\n/u);
if (files.length === 0 || files.some(file => !file || !existsSync(resolve(root, file)))) {
  console.error('lint-all: could not enumerate the complete oxlint file selection');
  process.exit(1);
}
const selected = (parts === 1 ? files : files.toSorted()).filter((_, index) => index % parts === part - 1);
if (selected.length === 0) {
  console.error('lint-all: shard selected no files');
  process.exit(1);
}
console.info(`lint-all: typed shard ${part}/${parts}, ${selected.length} files`);
// Avoid multiplying checker/GC workers across every logical core on the Mac.
// Smaller CI machines retain their available width; selection/rules are exact.
const threads = Math.min(8, availableParallelism());
// --threads controls Oxlint's native pool; its Go helper has a separate runtime.
// Preserve an explicit caller setting, including a smaller existing allowance.
const lintEnv = {
  ...process.env,
  GOMAXPROCS: process.env.GOMAXPROCS ?? String(threads),
  // The Darwin profile is dominated by reclaim/recommit churn. Keep more
  // short-lived checker storage between collections within a bounded Go budget.
  // This is below the 8 GB whole-check acceptance ceiling, not a new gate.
  ...(process.platform === 'darwin' ? {
    GOGC: process.env.GOGC ?? '200',
    GOMEMLIMIT: process.env.GOMEMLIMIT ?? '5GiB',
  } : {}),
};
const result = spawnSync('pnpm', ['exec', 'oxlint', '--type-aware', '--threads', String(threads), ...selected], { cwd: root, stdio: 'inherit', env: lintEnv });
if (result.error !== undefined) console.error(result.error.message);
process.exitCode = result.status ?? 1;
