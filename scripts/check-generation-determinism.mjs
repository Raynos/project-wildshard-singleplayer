#!/usr/bin/env node
// G668 G10: official committed-input audit, never a working-copy overlay probe.
import { spawnSync } from 'node:child_process';
import { openMirror } from './build-mirror.mjs';
import { quietCli } from './quiet-cli.mjs';

const args = process.argv.slice(2);
const revision = args.find(arg => arg.startsWith('--rev='))?.slice(6) ?? 'HEAD';
const parallel = args.find(arg => arg.startsWith('--parallel='))?.slice(11) ?? '4';
try {
  if (args.some(arg => !arg.startsWith('--rev=') && !arg.startsWith('--parallel='))
    || args.filter(arg => arg.startsWith('--rev=')).length > 1 || args.filter(arg => arg.startsWith('--parallel=')).length > 1
    || !/^(?:HEAD|[a-f0-9]{40})$/u.test(revision) || !/^[1-4]$/u.test(parallel)) {
    throw new Error('Expected --rev=HEAD|<full-main-sha> and --parallel=1..4');
  }
  quietCli('generation-determinism');
  const mirror = openMirror(revision);
  try {
    console.info(`generation-determinism: committed ${mirror.sha}, preparing declared inputs`);
    // The mirror is acquired before the build lease. Both commands and all
    // descendants retain that lease and one browser slot through the audit.
    const command = `node scripts/gen.mjs --proof --parallel=${parallel} && node scripts/generate.mjs --determinism --parallel=${parallel}`;
    const result = spawnSync('python3', ['scripts/heavy-lane.py', 'build', '--', 'scripts/browser-lane.sh', '--max', '90', 'bash', '-c', command], {
      cwd: mirror.dir, stdio: 'inherit', env: { ...process.env, VERCEL_GIT_COMMIT_SHA: mirror.sha },
    });
    if (result.error !== undefined) throw result.error;
    process.exitCode = result.status ?? 1;
  } finally { mirror.release(); }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1;
}
