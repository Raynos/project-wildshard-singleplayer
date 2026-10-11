// W28 milestone proof. Run from the main checkout; exports committed bytes only.
// node progress/process/sf74-2026-10-11/prove-native-x64.mjs [exact-sha]
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { committedExport } from '../../../scripts/regenerate-committed.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const x64 = resolve(homedir(), '.local/node-x64', `node-${process.version}-darwin-x64/bin/node`);
if (process.arch !== 'arm64' || !existsSync(x64)) throw Error('Requires the arm64 host and matching x64 Node; scripts/x64-vitest.sh --setup');
if (execFileSync(x64, ['-p', 'process.arch+" "+process.version'], { encoding: 'utf8' }).trim() !== `x64 ${process.version}`) throw Error('Cross-architecture version mismatch');
const sha = execFileSync('git', ['rev-parse', `${process.argv[2] ?? 'HEAD'}^{commit}`], { cwd: root, encoding: 'utf8' }).trim();
const scratch = mkdtempSync(resolve(tmpdir(), 'sp-x7-heavy-native-'));
const warning = /^\(node:\d+\) ExperimentalWarning: Transform Types is an experimental feature and might change at any time\n\(Use `node --trace-warnings \.\.\.` to show where the warning was created\)\n/gm;
const cases = [['nalati-grasslands', 'slice-replay', 1], ['driftwood-isle', 'headless', 0], ['pine-hollow', 'replay', 0],
  ['sunscar-dunes', 'all', 0], ['nine-dragon-stack', 'replay-ride', 0], ['nine-dragon-stack', 'replay-crossing', 0], ['far-reach', 'slice-replay', 0]];
try {
  committedExport(root, sha, scratch);
  const reports = [];
  for (const [slug, mode, expected] of cases) {
    const pair = [process.execPath, x64].map(node => {
      const start = Date.now();
      const run = spawnSync(node, ['--experimental-transform-types', '--import', './scripts/sim-node-loader.mjs', `test/proof/${slug}/run.mjs`, mode],
        { cwd: scratch, encoding: 'utf8', timeout: 120000, maxBuffer: 16 * 1024 * 1024 });
      if (run.error) throw run.error;
      const stderr = run.stderr.replace(warning, '');
      if (run.status !== expected || stderr !== '') throw Error(`${slug}/${mode}: unexpected rc ${run.status} or diagnostics: ${stderr.slice(0, 1200)}`);
      JSON.parse(run.stdout.trim());
      return { seconds: (Date.now() - start) / 1000, stdout: run.stdout.trim(), stderr };
    });
    if (pair[0].stdout !== pair[1].stdout || pair[0].stderr !== pair[1].stderr) throw Error(`${slug}/${mode}: architecture-dependent native report`);
    reports.push({ slug, mode, status: expected, armSeconds: pair[0].seconds, x64Seconds: pair[1].seconds,
      bytes: Buffer.byteLength(pair[0].stdout), sha256: createHash('sha256').update(pair[0].stdout).digest('hex'),
      diagnosticsBytes: Buffer.byteLength(pair[0].stderr), diagnosticsSha256: createHash('sha256').update(pair[0].stderr).digest('hex') });
  }
  console.log(JSON.stringify({ sha, node: process.version, reports }, null, 2));
} finally {
  rmSync(scratch, { recursive: true });
}
