// oxlint-disable-next-line import/no-nodejs-modules -- These tests own real tiny Git indexes and child processes.
import { execFileSync, spawn, spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Fixture trees are removed when each check completes.
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve owned fixture paths.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Git fixtures must not inherit the caller's temporary index.
import { env, execPath } from 'node:process';
import { expect, test } from 'vitest';
import { commitCheckFailed, commitGuards, runCommitJobs } from '../scripts/precommit-jobs.mjs';
import { fastCommitLintConfig } from '../scripts/precommit-checks.mjs';
import { precommitInputs } from '../scripts/precommit-inputs.mjs';

test('fast lint retains rewritten syntax rules and overrides', () => {
  const original = { options: { typeAware: true, reportUnusedDisableDirectives: 'error' },
    jsPlugins: ['./lint/wildshard-plugin.js'], rules: { 'wildshard/no-authored-html': 'error', 'wildshard/no-shard-branch': 'error' },
    overrides: [{ files: ['src/**'], rules: { 'wildshard/no-shard-host-callback': 'error' } }] };
  const config = fastCommitLintConfig(structuredClone(original));
  expect(config.options).toMatchObject({ typeAware: false, reportUnusedDisableDirectives: 'off' });
  expect(config['rules']).toEqual(original.rules);
  expect(config['overrides']).toEqual(original.overrides);
  expect(original.options.typeAware).toBe(true);
});

test('inventory selection follows its staged inputs and schema changes', () => {
  expect(commitGuards(['docs/process/GIT.md', 'scripts/precommit-inputs.mjs'])).toEqual([]);
  expect(commitGuards(['lint/wildshard-plugin.js'])).toEqual(['test/host-callbacks.test.ts', 'test/shardfile-boundaries.test.ts']);
  expect(commitGuards(['src/format/new.ts'])).toEqual(['test/schema-reference.test.ts', 'test/platform-chargebacks.test.ts']);
  expect(commitGuards(['src/shards/nine-dragon-stack/manifest.json'])).toEqual(['test/manifest-declarations.test.ts']);
  expect(commitGuards(['docs/HOST-BAR.md'])).toEqual(['test/platform-chargebacks.test.ts']);
});

test('parallel jobs share a deadline; a failed check survives another timeout', async () => {
  const start = performance.now();
  const results = await runCommitJobs(resolve('.'), [
    { name: 'red', command: [execPath, '-e', 'console.error("observed refusal");process.exitCode=1'] },
    { name: 'slow', command: [execPath, '-e', 'setTimeout(()=>{},10000)'] },
  ], start + 300);
  expect(results[0]).toMatchObject({ code: 1, timedOut: false, output: 'observed refusal\n' });
  expect(results[1]).toMatchObject({ code: 124, timedOut: true });
  expect(performance.now() - start).toBeLessThan(900);
});

test('guard refusal cancellation drains only its own jobs without changing the deadline', async () => {
  const controller = new AbortController();
  const pending = runCommitJobs(resolve('.'), [
    { name: 'owned pending job', command: [execPath, '-e', 'setTimeout(()=>{},10000)'] },
  ], performance.now() + 30_000, undefined, controller.signal);
  controller.abort();
  expect(await pending).toEqual([{ name: 'owned pending job', code: 130, timedOut: false, cancelled: true, output: '' }]);
  const skipped = await runCommitJobs(resolve('.'), [
    { name: 'never start', command: [execPath, '-e', 'throw Error("must not start")'] },
  ], performance.now() + 30_000, undefined, controller.signal);
  expect(skipped).toEqual([{ name: 'never start', code: 130, timedOut: false, cancelled: true, output: '' }]);
  expect(commitCheckFailed({ name: 'related tests', code: 130, timedOut: false, cancelled: true, output: 'observed refusal' })).toBe(true);
});

test('cancellation drains a detached descendant and preserves an unrelated owned control', async () => {
  const controller = new AbortController(), cancel = (): void => { controller.abort(); };
  const control = spawn(execPath, ['-e', 'setInterval(()=>{},1000)'], { stdio: 'ignore' });
  const closed = new Promise<void>(_resolve => { control.once('close', () => { _resolve(); }); });
  let descendant: number | undefined;
  process.once('SIGUSR2', cancel);
  try {
    const result = await runCommitJobs(resolve('.'), [{ name: 'nested owner', command: [execPath, '-e',
      `const {spawn}=require('node:child_process');const {writeSync}=require('node:fs');
const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{detached:true,stdio:'ignore'});
writeSync(1,String(child.pid));process.kill(${process.pid},'SIGUSR2');setTimeout(()=>{},10000);`],
    }], performance.now() + 30_000, undefined, controller.signal);
    expect(result[0]).toMatchObject({ code: 130, cancelled: true, timedOut: false });
    const pid = Number(result[0]?.output);
    if (Number.isSafeInteger(pid) && pid > 1) descendant = pid;
    expect(Number.isSafeInteger(pid) && pid > 1).toBe(true);
    const state = spawnSync('ps', ['-p', String(pid), '-o', 'stat='], { encoding: 'utf8' });
    expect(state.status === 1 || /^\s*Z/u.test(state.stdout)).toBe(true);
    const controlPid = control.pid;
    if (controlPid === undefined) throw new Error('Missing independent fixture process');
    expect(() => process.kill(controlPid, 0)).not.toThrow();
  } finally {
    process.removeListener('SIGUSR2', cancel);
    control.kill('SIGKILL');
    if (descendant !== undefined) {
      try { process.kill(descendant, 'SIGKILL'); }
      catch (error) { expect(error).toMatchObject({ code: 'ESRCH' }); }
    }
    await closed;
  }
});

test('staged deletions are checked even while their working file still exists', async () => {
  mkdirSync('tmp', { recursive: true });
  const root = mkdtempSync(resolve('tmp/deleted-hook-'));
  const gitEnv = Object.fromEntries(Object.entries(env).filter(([key]) => !key.startsWith('GIT_')));
  const git = (...args: string[]): string => execFileSync('git', args, { cwd: root, env: gitEnv, encoding: 'utf8' }).trim();
  try {
    git('init', '-q'); git('config', 'user.email', 'fixture@example.invalid'); git('config', 'user.name', 'fixture'); git('config', 'core.hooksPath', '/dev/null');
    mkdirSync(resolve(root, 'src'));
    writeFileSync(resolve(root, 'src/deleted.ts'), 'export const value = 1;\n');
    writeFileSync(resolve(root, 'src/reader.ts'), 'import {value} from "./deleted"; export {value};\n');
    writeFileSync(resolve(root, '.oxlintrc.json'), '{}');
    git('add', '--', 'src/deleted.ts', 'src/reader.ts', '.oxlintrc.json'); git('commit', '-qm', 'base');
    git('rm', '--cached', '--', 'src/deleted.ts');
    const index = readFileSync(resolve(root, '.git/index'));
    await expect(precommitInputs(root)).rejects.toThrow('deleted paths: refused');
    expect(readFileSync(resolve(root, 'src/deleted.ts'), 'utf8')).toContain('value = 1');
    expect(readFileSync(resolve(root, '.git/index'))).toEqual(index);
    const checker = resolve(root, 'checker.sh'); writeFileSync(checker, '#!/bin/sh\nexit 0\n'); chmodSync(checker, 0o755);
    writeFileSync(resolve(root, 'src/reader.ts'), 'export const value = 2;\n'); git('add', '--', 'src/reader.ts');
    // Foreign working bytes cannot invalidate the good staged replacement.
    writeFileSync(resolve(root, 'src/reader.ts'), 'import "./deleted";\n');
    await expect(precommitInputs(root, checker)).resolves.toBeUndefined();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('a wall cap defers every cheap check but preserves observed refusals', () => {
  for (const name of ['typed lint', 'fast lint', 'closed components', 'ratchet', 'inventory guards', 'staged source', 'storage']) {
    expect(commitCheckFailed({ name, code: 124, timedOut: true, output: '' })).toBe(false);
    expect(commitCheckFailed({ name, code: 124, timedOut: false, output: '' })).toBe(false);
    expect(commitCheckFailed({ name, code: 1, timedOut: false, output: '' })).toBe(true);
  }
  for (const output of ['unit.ts:1: error typescript(TS2322): wrong', ' FAIL test/bad.test.ts', 'CLOSED C1 has custom lines', 'src/a.ts: deleted path src/gone.ts', 'MISSING STAGED MODULE src/a.ts: ./missing', 'src/generator.ts: wildshard/generator-imports was 6, now 7']) {
    expect(commitCheckFailed({ name: 'check', code: 124, timedOut: true, output })).toBe(true);
  }
});

test('staged fast lint refuses bad index bytes behind clean working text', async () => {
  mkdirSync('tmp', { recursive: true });
  const root = mkdtempSync(resolve('tmp/staged-fast-refusal-'));
  const gitEnv = Object.fromEntries(Object.entries(env).filter(([key]) => !key.startsWith('GIT_')));
  const git = (...args: string[]): string => execFileSync('git', args, { cwd: root, env: gitEnv, encoding: 'utf8' }).trim();
  try {
    git('init', '-q'); git('config', 'user.email', 'fixture@example.invalid'); git('config', 'user.name', 'fixture'); git('config', 'core.hooksPath', '/dev/null');
    writeFileSync(resolve(root, '.oxlintrc.json'), JSON.stringify({ options: { typeAware: false }, rules: { 'no-eval': 'error' } }));
    mkdirSync(resolve(root, 'src'));
    const source = resolve(root, 'src/owner.ts'), clean = 'export const value = 1;\n';
    writeFileSync(source, clean);
    git('add', '--', '.oxlintrc.json', 'src/owner.ts'); git('commit', '-qm', 'base');
    writeFileSync(source, 'export const value = eval("1");\n'); git('add', '--', 'src/owner.ts');
    writeFileSync(source, clean);
    const index = readFileSync(resolve(root, '.git/index'));
    await expect(precommitInputs(root, resolve('node_modules/.bin/oxlint'))).rejects.toThrow('fast lint: refused');
    expect(readFileSync(source, 'utf8')).toBe(clean);
    expect(readFileSync(resolve(root, '.git/index'))).toEqual(index);
  } finally { rmSync(root, { recursive: true, force: true }); }
});


test('generated glob ignores never start staged fast or typed work',async()=>{
 mkdirSync('tmp',{recursive:true});const root=mkdtempSync(resolve('tmp/generated-hook-'));
 const gitEnv=Object.fromEntries(Object.entries(env).filter(([key])=>!key.startsWith('GIT_')));
 const git=(...args:string[]):string=>execFileSync('git',args,{cwd:root,env:gitEnv,encoding:'utf8'}).trim();
 try{
  git('init','-q');git('config','user.email','fixture@example.invalid');git('config','user.name','fixture');git('config','core.hooksPath','/dev/null');
  writeFileSync(resolve(root,'.oxlintrc.json'),JSON.stringify({ignorePatterns:['**/*.generated.*']}));
  git('add','--','.oxlintrc.json');git('commit','-qm','base');
  mkdirSync(resolve(root,'src'));
  writeFileSync(resolve(root,'src/owner.ts'),'export const value = 1;\n');
  writeFileSync(resolve(root,'src/owner.generated.ts'),'export const generated = 1;\n');
  git('add','--','src/owner.ts','src/owner.generated.ts');
  const checker=resolve(root,'checker.sh'),calls=resolve(root,'calls.txt');
  writeFileSync(checker,`#!/bin/sh\nprintf '%s\\n' "$@" >> '${calls}'\n`);chmodSync(checker,0o755);
  await precommitInputs(root,checker);
  const output=readFileSync(calls,'utf8');
  expect(output).toContain('src/owner.ts');expect(output).not.toContain('src/owner.generated.ts');
  expect(output).toContain('--type-aware');expect(output).not.toContain('--type-check');
 }finally{rmSync(root,{recursive:true,force:true});}
});
