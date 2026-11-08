// CI-F's shell gate: exact committed inventory, pins, API types and artifact.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const revision = process.argv[2] ?? 'main';
const sha = execFileSync('git', ['rev-parse', revision], { encoding: 'utf8' }).trim();
const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (sha !== head) throw new Error('CI-F shell gate requires exact committed HEAD');
const run = args => execFileSync(args[0], args.slice(1), { stdio: 'inherit' });
run(['node', 'scripts/check-shell.mjs', sha]);
run(['node', 'scripts/engine-pin.mjs', 'verify']);
run(['pnpm', 'check']);
run(['pnpm', 'test']);
const pin = JSON.parse(readFileSync('engine.pin.json', 'utf8'));
for (const pkg of [pin.engine]) {
  const directory = process.env.WS_ENGINE_SOURCE;
  if (directory === undefined) throw new Error('Set WS_ENGINE_SOURCE to the existing engine checkout');
  const actual = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: directory, encoding: 'utf8' }).trim();
  if (actual !== pkg.commit) throw new Error(`Local installed ${pkg.repo} differs from pin`);
}
run(['node', 'scripts/build-release.mjs']);
console.log(`CI-F shell PASS ${sha}: exact source, seven shard provenance pins, engine CI, epoch, API and final size gate`);
