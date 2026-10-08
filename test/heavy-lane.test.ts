// oxlint-disable-next-line import/no-nodejs-modules -- Exercise real process lifetime in an isolated temporary queue.
import { spawn, spawnSync, execFileSync, type ChildProcess } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Only this fixture's temporary files are created and removed.
import { mkdtempSync, readFileSync, existsSync, writeFileSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Portable isolated fixture location.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve queue and lease helper locations.
import { join, resolve as resolvePath } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Launch the same Node runtime and explicitly fence inherited leases.
import process from 'node:process';
import { afterEach, expect, it } from 'vitest';
import { isFullVitest } from '../scripts/vitest-lane';

const lane = resolvePath('scripts/heavy-lane.py');
const guard = new URL('../scripts/heavy-lane-lease.mjs', import.meta.url).href;
const roots: string[] = [];
const children: { child: ChildProcess; done: Promise<number | null> }[] = [];
function fixture(): { root: string; env: NodeJS.ProcessEnv } {
  const root = mkdtempSync(join(tmpdir(), 'heavy-lane-test-')); roots.push(root);
  return { root, env: { ...process.env, WS_HEAVY_ROOT: root, WS_HEAVY_TOKEN: '', WS_HEAVY_GATE: '' } };
}
function start(env: NodeJS.ProcessEnv, kind: string, code: string, max = '0.2') {
  const child = spawn('python3', [lane, kind, '--max', max, '--', process.execPath, '-e', code], { env });
  let output = '';
  child.stdout.on('data', chunk => { output += String(chunk); });
  child.stderr.on('data', chunk => { output += String(chunk); });
  const done = new Promise<number | null>((resolve, reject) => {
    child.once('error', reject); child.once('close', resolve);
  });
  children.push({ child, done });
  return { child, done, output: () => output };
}
async function until(check: () => boolean) {
  const end = Date.now() + 5_000;
  while (!check()) {
    if (Date.now() >= end) throw new Error('queue fixture did not reach expected state');
    await new Promise(resolve => { setTimeout(resolve, 20); });
  }
}
function marker(root: string, name: string, hold: string | number = 50): string {
  const wait = typeof hold === 'number' ? `setTimeout(()=>{},${hold});` :
    `const timer=setInterval(()=>{if(fs.existsSync(${JSON.stringify(join(root, hold))}))clearInterval(timer);},20);`;
  return `const fs=require('node:fs');fs.writeFileSync(${JSON.stringify(join(root, name))},'ready');${wait}`;
}
function queued(root: string, count: number): boolean {
  if (!existsSync(join(root, 'queue.json'))) return false;
  const state: unknown = JSON.parse(readFileSync(join(root, 'queue.json'), 'utf8'));
  return state !== null && typeof state === 'object' && 'queue' in state && Array.isArray(state.queue) && state.queue.length === count;
}
afterEach(async () => {
  for (const { child } of children) if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
  await Promise.all(children.map(({ done }) => done)); children.length = 0;
  for (const root of roots) rmSync(root, { recursive: true, force: true }); roots.length = 0;
});

it('keeps requests FIFO while the independent build resource can proceed', async () => {
  const { root, env } = fixture();
  const first = start(env, 'full-test', marker(root, 'first', 'release-first'));
  await until(() => existsSync(join(root, 'first')));
  const second = start(env, 'full-test', marker(root, 'second', 'release-second'));
  await until(() => queued(root, 1));
  const third = start(env, 'full-test', marker(root, 'third'));
  await until(() => queued(root, 2));
  const build = start(env, 'build', marker(root, 'build'));
  await until(() => existsSync(join(root, 'build')));
  expect(existsSync(join(root, 'second'))).toBe(false);
  writeFileSync(join(root, 'release-first'), 'go');
  expect(await first.done).toBe(0);
  await until(() => existsSync(join(root, 'second')));
  expect(existsSync(join(root, 'third'))).toBe(false);
  writeFileSync(join(root, 'release-second'), 'go');
  expect(await second.done).toBe(0); expect(await third.done).toBe(0); expect(await build.done).toBe(0);
});

it('gives the push gate priority without preemption and reserves both resources', async () => {
  const { root, env } = fixture();
  const active = start(env, 'full-test', marker(root, 'active', 'release-active'));
  await until(() => existsSync(join(root, 'active')));
  const waiting = start(env, 'full-test', marker(root, 'waiting'));
  await until(() => queued(root, 1));
  const gate = start(env, 'gate', marker(root, 'gate', 'release-gate'));
  await until(() => queued(root, 2));
  const build = start(env, 'build', marker(root, 'build'));
  await until(() => queued(root, 3));
  expect(existsSync(join(root, 'gate'))).toBe(false);
  writeFileSync(join(root, 'release-active'), 'go');
  expect(await active.done).toBe(0);
  await until(() => existsSync(join(root, 'gate')));
  expect(existsSync(join(root, 'waiting'))).toBe(false); expect(existsSync(join(root, 'build'))).toBe(false);
  writeFileSync(join(root, 'release-gate'), 'go');
  expect(await gate.done).toBe(0); expect(await waiting.done).toBe(0); expect(await build.done).toBe(0);
});

it('releases on error, timeout and cancellation and removes a cancelled queued ticket', async () => {
  const { root, env } = fixture();
  expect(await start(env, 'build', 'process.exit(7)').done).toBe(7);
  expect(await start(env, 'build', 'setTimeout(()=>{},10000)', '0.004').done).toBe(124);
  const active = start(env, 'build', marker(root, 'active', 10000));
  await until(() => existsSync(join(root, 'active')));
  const waiting = start(env, 'build', marker(root, 'cancelled'));
  await until(() => queued(root, 1)); waiting.child.kill('SIGTERM');
  expect(await waiting.done).toBe(130); expect(queued(root, 0)).toBe(true);
  active.child.kill('SIGTERM'); expect(await active.done).toBe(130);
  expect(await start(env, 'build', marker(root, 'next')).done).toBe(0);
  const status: unknown = JSON.parse(execFileSync('python3', [lane, 'status'], { env, encoding: 'utf8' }));
  expect(status).toEqual({ active: [], queue: [] });
});

it('accepts a descendant lease and refuses a copied token in an unrelated process', async () => {
  const { root, env } = fixture();
  const command = `import(${JSON.stringify(guard)}).then(({assertHeavyLease})=>{assertHeavyLease('build');${marker(root, 'valid', 'release-valid')}})`;
  const holder = start(env, 'build', command);
  await until(() => existsSync(join(root, 'valid')));
  const lease: unknown = JSON.parse(readFileSync(join(root, 'build.active.json'), 'utf8'));
  if (lease === null || typeof lease !== 'object' || !('token' in lease) || typeof lease.token !== 'string') throw new Error('missing fixture lease token');
  const token = lease.token;
  expect(() => execFileSync(process.execPath, ['--input-type=module', '-e', `import {assertHeavyLease} from ${JSON.stringify(guard)};assertHeavyLease('build');`], {
    env: { ...env, WS_HEAVY_TOKEN: token }, stdio: 'pipe',
  })).toThrow();
  writeFileSync(join(root, 'release-valid'), 'go');
  expect(await holder.done).toBe(0);
});

it('reuses a gate for nested wrappers and refuses resource upgrades', async () => {
  const { env } = fixture();
  const nested = `require('node:child_process').execFileSync('python3',[${JSON.stringify(lane)},'build','--',process.execPath,'-e','process.exit(0)'],{stdio:'inherit'});`;
  expect(await start(env, 'gate', nested).done).toBe(0);
  expect(await start(env, 'full-test', nested).done).not.toBe(0);
});

it('keeps the lock with the owned child after its wrapper is killed', async () => {
  const { root, env } = fixture();
  const holder = start(env, 'build', marker(root, 'orphan', 'release-orphan'));
  await until(() => existsSync(join(root, 'orphan')));
  holder.child.kill('SIGKILL');
  const waiting = start(env, 'build', marker(root, 'next'));
  try {
    await until(() => queued(root, 1));
    expect(existsSync(join(root, 'next'))).toBe(false);
  } finally {
    writeFileSync(join(root, 'release-orphan'), 'go');
  }
  expect(await holder.done).toBeNull(); expect(await waiting.done).toBe(0);
});

it('prunes a dead queued owner without stealing an active lock', async () => {
  const { root, env } = fixture();
  const holder = start(env, 'build', marker(root, 'holder', 'release-holder'));
  await until(() => existsSync(join(root, 'holder')));
  const dead = start(env, 'build', marker(root, 'dead'));
  await until(() => queued(root, 1)); dead.child.kill('SIGKILL'); expect(await dead.done).toBeNull();
  const next = start(env, 'build', marker(root, 'next'));
  await until(() => queued(root, 1));
  expect(existsSync(join(root, 'next'))).toBe(false);
  writeFileSync(join(root, 'release-holder'), 'go');
  expect(await holder.done).toBe(0); expect(await next.done).toBe(0); expect(existsSync(join(root, 'dead'))).toBe(false);
});

it('recognizes full runs despite flag values and broad filters while focused files remain free', () => {
  for (const args of [[], ['run'], ['run', '--project', 'unit'], ['run', '--shard=1/6'], ['run', '--reporter', 'dot'], ['run', './test/**'], ['run', 'test/', 'test/one.test.ts']]) expect(isFullVitest(args)).toBe(true);
  for (const args of [['run', 'test/one.test.ts'], ['run', 'test/engine'], ['list'], ['--help'], ['--version'], ['run', '--mergeReports=blobs']]) expect(isFullVitest(args)).toBe(false);
});

it('refuses an unwrapped real Vitest config before a worker pool can start', () => {
  const { env } = fixture();
  const result = spawnSync('pnpm', ['exec', 'vitest', 'run', '--project', '__no_fixture_workers__'], { env, encoding: 'utf8' });
  expect(result.status).not.toBe(0);
  expect(result.stdout + result.stderr).toContain('heavy-lane.py full-test');
});

it('refuses an unwrapped app build at config loading without compiling the app', () => {
  const { env } = fixture();
  const result = spawnSync(process.execPath, ['--input-type=module', '-e',
    "import {loadConfigFromFile} from 'vite'; await loadConfigFromFile({command:'build',mode:'production'},'vite.config.ts');"], { env, encoding: 'utf8' });
  expect(result.status).not.toBe(0);
  expect(result.stdout + result.stderr).toContain('heavy-lane.py build');
});

it('collects each test file once and keeps exactly five integration files', () => {
  const { env } = fixture();
  const inventory: unknown = JSON.parse(execFileSync('pnpm', ['exec', 'vitest', 'list', '--filesOnly', '--json'], { env, encoding: 'utf8' }));
  if (!Array.isArray(inventory)) throw new Error('invalid Vitest file inventory');
  const files = new Set<string>();
  const integration: string[] = [];
  for (const entry of inventory) {
    const row: unknown = entry;
    if (row === null || typeof row !== 'object' || !('file' in row) || typeof row.file !== 'string' || !('projectName' in row)) throw new Error('invalid Vitest file row');
    expect(files.has(row.file)).toBe(false); files.add(row.file);
    if (row.projectName === 'integration') integration.push(row.file.split('/').at(-1) ?? '');
  }
  expect(integration.sort()).toEqual(['grid-collision-strips.test.ts', 'immutable-vegetation-canvases-off.test.ts', 'live-grid.test.ts', 'sdk-repo-build.test.ts', 'template-copy-scaffold.test.ts']);
});
