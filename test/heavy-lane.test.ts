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
import { isFullVitest, vitestMaxWorkers } from '../scripts/vitest-lane';

const lane = resolvePath('scripts/heavy-lane.py');
const guard = new URL('../scripts/heavy-lane-lease.mjs', import.meta.url).href;
const roots: string[] = [];
it('bounds local workers, retains CI defaults and refuses malformed overrides', () => {
  expect(vitestMaxWorkers({})).toBe(6);
  expect(vitestMaxWorkers({ CI: 'true' })).toBeUndefined();
  expect(vitestMaxWorkers({ GITHUB_ACTIONS: 'true' })).toBeUndefined();
  expect(vitestMaxWorkers({ CI: 'true', WS_VITEST_MAX_WORKERS: '3' })).toBe(3);
  for (const value of ['', '0', '-1', '1.5', '6x', '9007199254740992']) {
    expect(() => vitestMaxWorkers({ WS_VITEST_MAX_WORKERS: value })).toThrow('positive integer');
  }
});
const children: { child: ChildProcess; done: Promise<number | null> }[] = [];
function fixture(): { root: string; env: NodeJS.ProcessEnv } {
  const root = mkdtempSync(join(tmpdir(), 'heavy-lane-test-')); roots.push(root);
  return { root, env: { ...process.env, WS_HEAVY_ROOT: root, WS_HEAVY_TOKEN: '', WS_HEAVY_GATE: '', WS_FULL_SUITE: '1' } };
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

it('runs the push gate on its own lease beside lane suites and builds, one gate at a time', async () => {
  const { root, env } = fixture();
  const suite = start(env, 'full-test', marker(root, 'suite', 'release-suite'));
  const build = start(env, 'build', marker(root, 'build', 'release-build'));
  await until(() => existsSync(join(root, 'suite')) && existsSync(join(root, 'build')));
  const gate = start(env, 'gate', marker(root, 'gate', 'release-gate'));
  await until(() => existsSync(join(root, 'gate')));
  const second = start(env, 'gate', marker(root, 'second'));
  await until(() => queued(root, 1));
  expect(existsSync(join(root, 'second'))).toBe(false);
  writeFileSync(join(root, 'release-gate'), 'go');
  expect(await gate.done).toBe(0); expect(await second.done).toBe(0);
  writeFileSync(join(root, 'release-suite'), 'go'); writeFileSync(join(root, 'release-build'), 'go');
  expect(await suite.done).toBe(0); expect(await build.done).toBe(0);
});

it('lets a gate descendant pass the full-test and build guards', async () => {
  const { root, env } = fixture();
  const command = `import(${JSON.stringify(guard)}).then(({assertHeavyLease})=>{assertHeavyLease('full-test');assertHeavyLease('build');${marker(root, 'guarded')}})`;
  expect(await start(env, 'gate', command).done).toBe(0);
  expect(existsSync(join(root, 'guarded'))).toBe(true);
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

it('refuses a lane full suite (SF74 W1) unless CI or WS_FULL_SUITE=1 asks for it', async () => {
  const { root, env } = fixture();
  const laneEnv = { ...env, WS_FULL_SUITE: '', CI: '', GITHUB_ACTIONS: '' };
  expect(await start(laneEnv, 'full-test', marker(root, 'refused')).done).toBe(2);
  expect(await start(laneEnv, 'check', marker(root, 'refused')).done).toBe(2);
  expect(existsSync(join(root, 'refused'))).toBe(false);
  expect(await start({ ...laneEnv, CI: 'true' }, 'full-test', marker(root, 'ci')).done).toBe(0);
  expect(await start(laneEnv, 'build', marker(root, 'build')).done).toBe(0);
});

it('reuses a gate for nested wrappers and refuses resource upgrades', async () => {
  const { env } = fixture();
  const nested = `require('node:child_process').execFileSync('python3',[${JSON.stringify(lane)},'build','--',process.execPath,'-e','process.exit(0)'],{stdio:'inherit'});`;
  expect(await start(env, 'gate', nested).done).toBe(0);
  expect(await start(env, 'full-test', nested).done).not.toBe(0);
});

it('lowers owned heavy jobs and nested descendants to interactive-friendly priority', async () => {
  const { root, env } = fixture();
  const output = join(root, 'priority.json');
  const inner = `require('node:fs').writeFileSync(${JSON.stringify(output)},JSON.stringify(require('node:os').getPriority()));`;
  const nested = `require('node:child_process').execFileSync('python3',[${JSON.stringify(lane)},'build','--',process.execPath,'-e',${JSON.stringify(inner)}],{stdio:'inherit'});`;
  expect(await start(env, 'gate', nested).done).toBe(0);
  expect(JSON.parse(readFileSync(output, 'utf8'))).toBeGreaterThanOrEqual(10);
});

it('caps gate jobs at three, drains before an exclusive phase and continues after a failed job', () => {
  const { root, env } = fixture();
  const code = `const fs=require('node:fs'),p=require('node:path');
const root=process.argv[1],id=process.argv[2],active=p.join(root,'active-'+id);
fs.writeFileSync(active,'');
fs.appendFileSync(p.join(root,'events'),JSON.stringify({id,active:fs.readdirSync(root).filter(x=>x.startsWith('active-')).length})+'\\n');
setTimeout(()=>{fs.unlinkSync(active);fs.writeFileSync(p.join(root,'done-'+id),'');process.exit(id==='2'?7:0);},80);`;
  const exclusive = `const fs=require('node:fs');if(fs.readdirSync(process.argv[1]).some(x=>x.startsWith('active-')))process.exit(9);fs.writeFileSync(process.argv[1]+'/exclusive','');`;
  const script = `set -u
source "$1"
for n in 1 2 3 4 5 6 7; do gate_launch "$5" -e "$3" "$2" "$n"; done
gate_exclusive "$5" -e "$4" "$2" || exit 9
for n in 8 9 10; do gate_launch "$5" -e "$3" "$2" "$n"; done
gate_drain`;
  const result = spawnSync('bash', ['-c', script, 'gate-jobs-test', resolvePath('scripts/gate-jobs.sh'), root, code, exclusive, process.execPath], { env, encoding: 'utf8' });
  expect(result.status).toBe(0);
  expect(existsSync(join(root, 'exclusive'))).toBe(true);
  const events: unknown[] = readFileSync(join(root, 'events'), 'utf8').trim().split('\n').map(line => { const row: unknown = JSON.parse(line); return row; });
  expect(events).toHaveLength(10);
  for (const event of events) {
    if (event === null || typeof event !== 'object' || !('active' in event) || typeof event.active !== 'number') throw new Error('invalid concurrency receipt');
    expect(event.active).toBeLessThanOrEqual(3);
  }
  for (let n = 1; n <= 10; n++) expect(existsSync(join(root, `done-${n}`))).toBe(true);
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

it('collects each test file once and serializes the build, native continuation and geometry proofs', () => {
  const { env } = fixture();
  const inventory: unknown = JSON.parse(execFileSync('pnpm', ['exec', 'vitest', 'list', '--filesOnly', '--json'], { env, encoding: 'utf8' }));
  if (!Array.isArray(inventory)) throw new Error('invalid Vitest file inventory');
  const files = new Set<string>();
  const integration: string[] = [];
  for (const entry of inventory) {
    const row: unknown = entry;
    if (row === null || typeof row !== 'object' || !('file' in row) || typeof row.file !== 'string' || !('projectName' in row)) throw new Error('invalid Vitest file row');
    expect(files.has(row.file)).toBe(false); files.add(row.file);
    if (row.projectName === 'integration') integration.push(row.file.slice(resolvePath('.').length + 1));
  }
  expect(integration.sort()).toEqual([
    'test/authoring-docs.test.ts',
    'test/grid-collision-strips.test.ts',
    'test/immutable-vegetation-canvases-off.test.ts',
    'test/immutable-vegetation-canvases.test.ts',
    'test/live-grid.test.ts',
    'test/proof/blender-template/replay.test.ts',
    'test/proof/compatibility/determinism.test.ts',
    'test/proof/driftwood-isle/reef.test.ts',
    'test/proof/driftwood-isle/replay.test.ts',
    'test/proof/driftwood-isle/zipline.test.ts',
    'test/proof/nalati-grasslands/headless.test.ts',
    'test/proof/nalati-grasslands/replay.test.ts',
    'test/proof/nine-dragon-stack/headless.test.ts',
    'test/sdk-repo-build.test.ts',
    'test/shardfile-splat-admission.test.ts',
    'test/shards/driftwood-isle/trailside-bake.test.ts',
    'test/template-copy-scaffold.test.ts',
  ]);
});
