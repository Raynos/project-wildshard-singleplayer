// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the real mirror transport in a tiny owned Git repository.
import { execFileSync, spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- The fixture owns every created path under ./tmp.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve fixture paths and the actual bootstrap module.
import { join, resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Child fixtures must not inherit a real lane's Git or heavy lease.
import { env as processEnv } from 'node:process';
// oxlint-disable-next-line import/no-nodejs-modules -- Import the real bootstrap without copying its dependencies.
import { pathToFileURL } from 'node:url';
import { expect, test } from 'vitest';

test('the private index supplies the checker and imported policy, and failures release the mirror', () => {
  mkdirSync('tmp', { recursive: true });
  const owned = mkdtempSync(resolve('tmp/staged-hook-test-'));
  const repo = join(owned, 'repo');
  const env = Object.fromEntries(Object.entries(processEnv).filter(([key]) => !key.startsWith('GIT_') && !key.startsWith('WS_HEAVY_')));
  const receipt = join(owned, 'receipt.json');
  Object.assign(env, { WILDSHARD_BUILD_MIRROR: join(owned, 'mirror'), HOOK_FIXTURE_RECEIPT: receipt });
  const git = (...args: string[]): string => execFileSync('git', args, { cwd: repo, env, encoding: 'utf8' }).trim();
  const bootstrap = pathToFileURL(resolve('scripts/precommit-inputs.mjs')).href;
  const launch = (): ReturnType<typeof spawnSync> => spawnSync(processEnv['NODE'] ?? 'node', ['--input-type=module', '-e',
    `const {precommitInputs}=await import(${JSON.stringify(bootstrap)});precommitInputs(process.argv[1]);`, repo], { cwd: repo, env, encoding: 'utf8' });
  try {
    mkdirSync(join(repo, 'scripts'), { recursive: true });
    mkdirSync(join(repo, 'node_modules'));
    writeFileSync(join(repo, '.gitignore'), 'node_modules/\n');
    git('init', '-q'); git('config', 'user.email', 'fixture@example.invalid'); git('config', 'user.name', 'fixture');
    git('config', 'core.hooksPath', '/dev/null');
    writeFileSync(join(repo, 'scripts/policy.mjs'), "export const verdict='HEAD';\n");
    writeFileSync(join(repo, 'scripts/check-staged-inputs.mjs'), `
import {writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {verdict} from './policy.mjs';
const root=process.argv[2];
const staged=execFileSync('git',['show',':scripts/policy.mjs'],{cwd:root,encoding:'utf8'});
if(!staged.includes(verdict))throw Error('private index lost');
if(verdict==='refuse')throw Error('staged refusal');
writeFileSync(process.env.HOOK_FIXTURE_RECEIPT,JSON.stringify({verdict,cwd:process.cwd(),root}));
`);
    git('add', '.'); git('commit', '-qm', 'fixture');
    const index = join(owned, 'private.index');
    env['GIT_INDEX_FILE'] = index;
    git('read-tree', 'HEAD');
    writeFileSync(join(repo, 'scripts/policy.mjs'), "export const verdict='private staged';\n");
    git('add', 'scripts/policy.mjs');
    writeFileSync(join(repo, 'scripts/policy.mjs'), "throw Error('working policy executed');\n");
    writeFileSync(join(repo, 'scripts/check-staged-inputs.mjs'), "throw Error('working checker executed');\n");
    const first = launch();
    expect(String(first.stderr)).not.toContain('working checker executed');
    expect(first.status, String(first.stderr)).toBe(0);
    expect(JSON.parse(readFileSync(receipt, 'utf8'))).toEqual({ verdict: 'private staged', cwd: join(owned, 'mirror/commit/tree'), root: repo });
    writeFileSync(join(repo, 'scripts/policy.mjs'), "export const verdict='refuse';\n");
    git('add', 'scripts/policy.mjs');
    const refused = launch();
    expect(refused.status).not.toBe(0);
    expect(String(refused.stderr)).toContain('staged refusal');
    writeFileSync(join(repo, 'scripts/policy.mjs'), "export const verdict='retry';\n");
    git('add', 'scripts/policy.mjs');
    expect(launch().status).toBe(0); // A failed checker must release its slot.
    git('update-index', '--force-remove', 'scripts/check-staged-inputs.mjs');
    const missing = launch();
    expect(missing.status).not.toBe(0);
    expect(String(missing.stderr)).toContain('refusing checkout fallback');
  } finally { rmSync(owned, { recursive: true, force: true }); }
});
