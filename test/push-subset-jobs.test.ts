import { expect, test, vi } from 'vitest';
import { pushSubsetJobs, runPushSubset, pushSubsetVerdict, selectPushSteps, nativeOutputReplayJob, type PushSubsetPorts } from '../scripts/push-subset-jobs.mjs';
import type { GateSelection } from '../scripts/gate-selection.mjs';
import type { CommitJob } from '../scripts/precommit-jobs.mjs';
// oxlint-disable-next-line import/no-nodejs-modules -- Retain the owned detached-child marker and remove its tiny fixture.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Native process fixtures stay under the repository's tmp directory.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Inspect the owned worker's actual execution state after cancellation.
import { execFileSync, spawnSync } from 'node:child_process';

const paths = ['scripts/heavy-lane.py', 'scripts/gen.mjs', '.oxlintrc.json', 'scripts/vitest-push.config.ts',
  'test/source.test.ts', 'test/reader.test.ts', 'test/native.test.mjs', 'src/game/example.ts', 'tsconfig.game.json'];

function selection(overrides: Partial<GateSelection> = {}): GateSelection {
  return { tests: ['test/source.test.ts', 'test/reader.test.ts', 'test/native.test.mjs'], projects: ['tsconfig.game.json'],
    products: ['example'], touchedProducts: ['example'], generators: ['example-models'], wide: false,
    related: { files: [], direct: [], nearest: [], candidates: 0, omitted: 0 }, ...overrides };
}

test('the CI subset retains Node tests and orders product readers after strict scoped builds', () => {
  const jobs = pushSubsetJobs(selection(), ['src/game/example.ts', 'deleted.ts'], paths, { 'test/reader.test.ts': ['example'] });
  const byName = new Map(jobs.map(job => [job.name, job]));
  expect(byName.get('generated-inputs')?.command).toContain('--shard=example');
  expect(byName.get('products')?.command.join(' ')).toContain('strict:true,reuse:true,scope:["example"]');
  expect(byName.get('types')?.command).toEqual(['node_modules/.bin/tsc', '-b', 'tsconfig.game.json']);
  expect(byName.get('typed-lint')?.after).toEqual(['generated-inputs', 'types']);
  expect(byName.get('typed-lint')?.command).toContain('src/game/example.ts');
  expect(byName.get('typed-lint')?.command).not.toContain('deleted.ts');
  expect(byName.get('node-tests-source')?.command).toEqual([process.execPath, '--test', 'test/native.test.mjs']);
  expect(byName.get('tests-source')?.after).toEqual(['generated-inputs']);
  expect(byName.get('tests-products')?.after).toEqual(['generated-inputs', 'products']);
});

test('untracked, unsupported or missing prerequisite selections refuse instead of disappearing', () => {
  expect(() => pushSubsetJobs(selection({ tests: ['test/loose.test.ts'] }), [], paths, {})).toThrow('not tracked');
  expect(() => pushSubsetJobs(selection({ tests: ['test/spec.test.tsx'] }), [], [...paths, 'test/spec.test.tsx'], {})).toThrow('No push runner');
  expect(() => pushSubsetJobs(selection(), [], paths, { 'test/reader.test.ts': ['missing'] })).toThrow('absent');
  expect(pushSubsetJobs(selection({ tests: [], projects: [], products: [], generators: [] }), ['README.md'], paths, {})).toEqual([]);
});

test('independent checks run together and a refused product prevents reader execution', async () => {
  const jobs = pushSubsetJobs(selection(), ['src/game/example.ts'], paths, { 'test/reader.test.ts': ['example'] });
  const run = vi.fn<PushSubsetPorts['run']>((_root, batch) => Promise.resolve(batch.map(job => ({
    name: job.name, code: job.name === 'products' ? 7 : 0, timedOut: false, output: job.name === 'products' ? 'original refusal' : '',
  }))));
  const results = await runPushSubset('/exact/mirror', jobs, performance.now() + 5000, {}, { run });
  expect(run.mock.calls.map(call => call[1].map(job => job.name))).toEqual([
    ['generated-inputs'], ['types'], ['products'], ['tests-source'], ['node-tests-source'], ['typed-lint'],
  ]);
  expect(results.find(result => result.name === 'products')).toMatchObject({ code: 7, output: 'original refusal' });
  expect(results.find(result => result.name === 'tests-products')).toMatchObject({ code: 1, blocked: ['products'] });
  expect(run.mock.calls.every(call => call[0] === '/exact/mirror')).toBe(true);
});

test('a producer refusal blocks every dependent check and incomplete runners cannot pass', async () => {
  const jobs = pushSubsetJobs(selection(), [], paths, { 'test/reader.test.ts': ['example'] });
  const run: PushSubsetPorts['run'] = (_root, batch) => Promise.resolve(batch.map(job => ({ name: job.name, code: 2, timedOut: false, output: 'producer refused' })));
  const results = await runPushSubset('/exact', jobs, performance.now() + 5000, {}, { run });
  expect(results.every(result => result.code !== 0)).toBe(true);
  expect(results.filter(result => result.blocked === undefined).map(result => result.name)).toEqual(['generated-inputs']);
  await expect(runPushSubset('/exact', jobs, performance.now() + 5000, {}, { run: () => Promise.resolve([]) })).rejects.toThrow('Incomplete');
});

test('dependency cycles refuse without starting a child', async () => {
  const run = vi.fn<PushSubsetPorts['run']>();
  await expect(runPushSubset('/exact', [{ name: 'cycle', command: ['node'], after: ['cycle'] }],
    performance.now() + 5000, {}, { run })).rejects.toThrow('Cyclic');
  expect(run).not.toHaveBeenCalled();
});

test('type completion starts typed lint while an independent product is still building', async () => {
  let finishProduct: (() => void) | undefined;
  const product = new Promise<void>(_resolve => { finishProduct = _resolve; });
  const started: string[] = [];
  const run: PushSubsetPorts['run'] = (_root, batch) => Promise.all(batch.map(async job => {
    started.push(job.name);
    if (job.name === 'products') await product;
    if (job.name === 'typed-lint') {
      expect(started).toContain('products');
      finishProduct?.();
    }
    return { name: job.name, code: 0, timedOut: false, output: '' };
  }));
  const jobs = pushSubsetJobs(selection(), ['src/game/example.ts'], paths, { 'test/reader.test.ts': ['example'] });
  const results = await runPushSubset('/exact', jobs, performance.now() + 5000, {}, { run });
  expect(results.every(result => result.code === 0)).toBe(true);
  expect(started.indexOf('typed-lint')).toBeLessThan(started.indexOf('tests-products'));
});

test('the shared deadline aborts the owned runner and preserves the named unfinished step', async () => {
  const run: PushSubsetPorts['run'] = (_root, batch: CommitJob[], _deadline, _env, signal) => new Promise(_resolve => {
    signal.addEventListener('abort', () => _resolve(batch.map(job => ({ name: job.name, code: 130, cancelled: true, timedOut: false, output: 'partial output' }))), { once: true });
  });
  const results = await runPushSubset('/exact', [{ name: 'slow-types', command: ['node'], after: [] }],
    performance.now() + 10, {}, { run });
  expect(results).toEqual([{ name: 'slow-types', code: 124, cancelled: true, timedOut: true, output: 'partial output' }]);
});

test('observed failures cannot be handed off as timeouts, including blocked readers', () => {
  const results = [
    { name: 'types', code: 124, timedOut: true, output: 'error TS2345: exact refusal' },
    { name: 'lint', code: 1, timedOut: false, blocked: ['types'], output: '' },
    { name: 'products', code: 124, timedOut: true, output: 'building original product' },
    { name: 'readers', code: 1, timedOut: false, blocked: ['products'], output: '' },
    { name: 'source-tests', code: 0, timedOut: false, output: '' },
  ];
  expect(pushSubsetVerdict(results)).toEqual({ failed: ['types', 'lint'], unfinished: ['products', 'readers'] });
  expect(() => pushSubsetVerdict([{ name: 'missing', code: 1, timedOut: false, blocked: ['absent'], output: '' }])).toThrow('Invalid');
});

test('CI replays only named unfinished steps and their real producer prerequisites', () => {
  const jobs = pushSubsetJobs(selection(), ['src/game/example.ts'], paths, { 'test/reader.test.ts': ['example'] });
  expect(selectPushSteps(jobs, ['tests-products']).map(job => job.name)).toEqual(['generated-inputs', 'products', 'tests-products']);
  expect(selectPushSteps(jobs, ['typed-lint']).map(job => job.name)).toEqual(['generated-inputs', 'types', 'typed-lint']);
  expect(() => selectPushSteps(jobs, ['unknown'])).toThrow('Invalid');
  expect(() => selectPushSteps(jobs, ['types', 'types'])).toThrow('Duplicate');
});

test('native-output handoff runs ordinary native lint on exact roots after generation', async () => {
  const producer = { name: 'generated-inputs', command: ['real-producer'], after: [] };
  const native = { name: 'fast-lint', command: ['node', 'committed-fast-checks.mjs', 'unchanged-guard'], after: [] };
  const replay = nativeOutputReplayJob([producer, native], ['src/changed.ts', 'src/changed.ts']);
  expect(replay.command).toEqual([process.execPath, 'scripts/lint-fast.mjs', 'src/changed.ts']);
  expect(replay.after).toEqual(['generated-inputs']);
  expect(() => nativeOutputReplayJob([native], ['src/changed.ts'])).toThrow('real producer');
  expect(() => nativeOutputReplayJob([producer], [])).toThrow('exact source roots');
  expect(() => nativeOutputReplayJob([producer], ['--disable-rules'])).toThrow('exact source roots');
  const jobs = selectPushSteps([producer, native, replay], ['native-outputs']);
  expect(jobs.map(job => job.name)).toEqual(['generated-inputs', 'native-outputs']);
  const run = vi.fn<PushSubsetPorts['run']>((_root, batch) => Promise.resolve(batch.map(job => ({
    name: job.name, code: 7, timedOut: false, output: 'original producer refusal',
  }))));
  const results = await runPushSubset('/exact', jobs, performance.now() + 5000, {}, { run });
  expect(run).toHaveBeenCalledOnce();
  expect(results.find(result => result.name === 'native-outputs')).toMatchObject({ blocked: ['generated-inputs'], code: 1 });
  expect(pushSubsetVerdict(results).failed).toEqual(['generated-inputs', 'native-outputs']);
});

test('the handed-off ordinary CLI retains a real syntax-lint refusal', () => {
  const repository = resolve(import.meta.dirname, '..');
  mkdirSync(resolve(repository, 'tmp'), { recursive: true });
  const root = mkdtempSync(resolve(repository, 'tmp/native-output-lint-'));
  const environment = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
  const git = (...args: string[]): void => { execFileSync('git', args, { cwd: root, env: environment, stdio: 'ignore' }); };
  try {
    mkdirSync(resolve(root, 'src')); mkdirSync(resolve(root, 'node_modules/.bin'), { recursive: true });
    symlinkSync(resolve(repository, 'node_modules/oxlint/bin/oxlint'), resolve(root, 'node_modules/.bin/oxlint'));
    writeFileSync(resolve(root, '.oxlintrc.json'), JSON.stringify({ rules: { 'eslint/no-eval': 'error' } }));
    writeFileSync(resolve(root, 'src/target.ts'), 'export const value=eval("1+1");\n');
    git('init', '-q'); git('add', '.oxlintrc.json', 'src/target.ts');
    git('ls-files', '--error-unmatch', 'src/target.ts');
    const job = nativeOutputReplayJob([{ name: 'generated-inputs', command: ['real-producer'], after: [] }], ['src/target.ts']);
    const script = job.command[1];
    if (script === undefined) throw new Error('Missing ordinary native linter');
    const run = () => spawnSync(process.execPath, [resolve(repository, script), ...job.command.slice(2)], { cwd: root, env: environment, encoding: 'utf8' });
    const bad = run();
    expect(bad.status, bad.stderr).toBe(1);
    expect(bad.stdout).toContain('no-eval');
    writeFileSync(resolve(root, 'src/target.ts'), 'export const value=1+1;\n'); git('add', 'src/target.ts');
    const good = run(); expect(good.status, good.stderr).toBe(0);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('deadline cleanup drains detached build descendants before returning the mirror', async () => {
  const root = resolve(import.meta.dirname, '..');
  mkdirSync(resolve(root, 'tmp'), { recursive: true });
  const dir = mkdtempSync(resolve(root, 'tmp/push-subset-child-'));
  const marker = resolve(dir, 'child.json');
  let pid: number | undefined;
  try {
    const child = `const {spawn,execFileSync}=require('node:child_process');const {writeFileSync}=require('node:fs');
      const nested=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{detached:true,stdio:'ignore'});
      writeFileSync(${JSON.stringify(marker)},JSON.stringify(nested.pid));
      process.stdout.write('LIVE:'+execFileSync('ps',['-p',String(nested.pid),'-o','stat='],{encoding:'utf8'}).trim()+'\\n');setInterval(()=>{},1000);`;
    const results = await runPushSubset(root, [{ name: 'detached-build', command: [process.execPath, '-e', child], after: [] }], performance.now() + 5000);
    const raw: unknown = JSON.parse(readFileSync(marker, 'utf8'));
    if (typeof raw !== 'number' || !Number.isSafeInteger(raw) || raw <= 1) throw new Error('Invalid owned descendant PID');
    pid = raw;
    expect(results[0]).toMatchObject({ name: 'detached-build', code: 124, timedOut: true });
    expect(results[0]?.output).toMatch(/LIVE:(?!Z)[A-Z]/u);
    const status = spawnSync('ps', ['-p', String(raw), '-o', 'stat='], { encoding: 'utf8' });
    // A dead process can retain its PID until init reaps it. It owns no live
    // worker or open files; kill(pid,0) alone cannot distinguish that from work.
    if (status.status === 1) expect(status.stdout.trim()).toBe('');
    else {
      expect(status.status).toBe(0);
      expect(status.stdout.trim()).toMatch(/^Z/u);
    }
  } finally {
    if (pid !== undefined) try { process.kill(pid, 'SIGKILL'); } catch { /* Already reaped by owned deadline cleanup. */ }
    rmSync(dir, { recursive: true, force: true });
  }
});
