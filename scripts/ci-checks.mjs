#!/usr/bin/env node
// SF74 W16: push CI's node checks in parallel. Runs `pnpm gen` once, then every other command of package.json's
// `test:checks` (read here, so the list never drifts) and each extra chain given on the command line, all at once, and
// prints each one's wall time. The serial chain took ~205 s on the CI runner (2026-10-09: bake-check ~110 s, ratchet ~69 s).
//   node scripts/ci-checks.mjs ['<shell chain>' …]
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/** @type {{ scripts: Partial<Record<string, string>> }} */
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const chain = pkg.scripts['test:checks'];
if (chain === undefined) throw new Error('package.json has no test:checks');
const [first, ...checks] = chain.split(' && ').map((command) => command.trim());
if (first !== 'pnpm gen') throw new Error(`test:checks must start with pnpm gen, not ${first}`);
const commands = [...checks, ...process.argv.slice(2)];

const t0 = Date.now();
if (spawnSync('pnpm', ['gen'], { stdio: 'inherit' }).status !== 0) process.exit(1);
console.log(`ci-checks: gen ${((Date.now() - t0) / 1000).toFixed(0)} s; running ${commands.length} in parallel`);

/** @param {string} command @returns {Promise<{ command: string, code: number, sec: number, out: string }>} */
function run(command) {
  const start = Date.now();
  return new Promise((resolve) => {
    const child = spawn('bash', ['-c', command], { stdio: ['ignore', 'pipe', 'pipe'] });
    /** @type {Buffer[]} */
    const out = [];
    child.stdout.on('data', (chunk) => { out.push(chunk); });
    child.stderr.on('data', (chunk) => { out.push(chunk); });
    child.on('close', (code) => { resolve({ command, code: code ?? 1, sec: (Date.now() - start) / 1000, out: Buffer.concat(out).toString('utf8') }); });
  });
}

const results = await Promise.all(commands.map(run));
// Each command's output in one group, so parallel logs never interleave.
for (const r of results) {
  console.log(`::group::${r.code === 0 ? '✓' : '✗'} ${r.command} (${r.sec.toFixed(0)} s)`);
  process.stdout.write(r.out);
  console.log('::endgroup::');
}
for (const r of [...results].sort((a, b) => b.sec - a.sec)) console.log(`  ${r.code === 0 ? '✓' : '✗'} ${r.sec.toFixed(0).padStart(4)} s  ${r.command}`);
const failed = results.filter((r) => r.code !== 0);
for (const r of failed) console.log(`::error::ci-checks: ${r.command} exited ${r.code}`);
console.log(`ci-checks: ${((Date.now() - t0) / 1000).toFixed(0)} s wall, ${failed.length} failed`);
process.exit(failed.length === 0 ? 0 : 1);
