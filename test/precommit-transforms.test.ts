// oxlint-disable-next-line import/no-nodejs-modules -- Real workers verify candidate isolation across persistent transforms.
import { execFileSync, spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Each fixture owns and removes its repository and cache.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve only fixture and installed runner paths.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { linkNodeModules } from '../scripts/link-node-modules.mjs';

function fixture() {
  const root = mkdtempSync(resolve('tmp/cf1-transforms-'));
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, env, encoding: 'utf8' });
  const put = (name: string, text: string) => { mkdirSync(resolve(root, name, '..'), { recursive: true }); writeFileSync(resolve(root, name), text); };
  git('init', '-q'); git('config', 'user.name', 'Fixture'); git('config', 'user.email', 'fixture@example.invalid'); git('config', 'core.hooksPath', '/dev/null');
  put('package.json', '{"type":"module"}');
  put('vitest.config.mjs', 'export default {test:{include:["test/**/*.test.ts"],maxWorkers:1}};');
  put('src/value.ts', 'export const value = 1;');
  for (const name of ['first', 'second']) put(`test/${name}.test.ts`, `import {test,expect,vi} from 'vitest';
import {value} from '../src/value';
vi.mock('../src/mocked',()=>({mocked:7}));
import {mocked} from '../src/mocked';
const state=globalThis; test('isolated value',()=>{
expect(Reflect.get(state,'cf1Counter')).toBeUndefined();Reflect.set(state,'cf1Counter',1);
expect(value).toBe(1);expect(mocked).toBe(7);
});`);
  put('src/mocked.ts', "throw Error('Mock must be hoisted'); export const mocked=0;");
  git('add', '.'); git('commit', '-qm', 'fixture'); linkNodeModules(resolve('.'), root);
  const worker = resolve('scripts/precommit-related.mjs');
  const run = (changed = ['src/value.ts']) => spawnSync(process.execPath, ['--input-type=module', '-e',
    `import {relatedWorker} from ${JSON.stringify(worker)}; await relatedWorker(process.cwd(),${JSON.stringify(changed)});`], {
    cwd: root, env: { ...env, DEBUG: 'vitest:cache:fs' }, encoding: 'utf8', timeout: 20_000,
  });
  return { root, git, put, run, close: () => rmSync(root, { recursive: true, force: true }) };
}

test('warm transforms execute every suite and preserve mocks and worker isolation', () => {
  const f = fixture();
  try {
    const cold = f.run(), warm = f.run();
    expect(cold.status, cold.stdout + cold.stderr).toBe(0);
    expect(warm.status, warm.stdout + warm.stderr).toBe(0);
    expect(warm.stdout + warm.stderr).toContain('[read]');
    expect(warm.stdout).toContain('2 passed');
    // A candidate regression cannot borrow the loose source's cached success.
    f.put('src/value.ts', 'export const value = 2;'); f.git('add', 'src/value.ts');
    f.put('src/value.ts', 'export const value = 1;');
    const red = f.run();
    expect(red.status, red.stdout + red.stderr).not.toBe(0);
    expect(red.stdout + red.stderr).toContain('CF1 TEST FAILURE:');
    expect(readFileSync(resolve(f.root, 'src/value.ts'), 'utf8')).toBe('export const value = 1;');
    // A second candidate over identical loose bytes must execute its own value.
    f.put('src/value.ts', 'export const value = 3;'); f.git('add', 'src/value.ts');
    f.put('src/value.ts', 'export const value = 1;');
    for (const name of ['first', 'second']) {
      const file = `test/${name}.test.ts`;
      f.put(file, readFileSync(resolve(f.root, file), 'utf8').replace('expect(value).toBe(1)', 'expect(value).toBe(3)'));
      f.git('add', file);
    }
    const repaired = f.run();
    expect(repaired.status, repaired.stdout + repaired.stderr).toBe(0);
    expect(repaired.stdout).toContain('2 passed');
  } finally { f.close(); }
}, 30_000);


test('warm transforms resolve a moved file through its new index entry', () => {
  const f = fixture();
  try {
    const cold = f.run(), warm = f.run();
    expect(cold.status, cold.stdout + cold.stderr).toBe(0);
    expect(warm.status, warm.stdout + warm.stderr).toBe(0);
    mkdirSync(resolve(f.root, 'src/value'));
    f.git('mv', 'src/value.ts', 'src/value/index.ts');
    const moved = f.run(['test/first.test.ts', 'test/second.test.ts']);
    expect(moved.status, moved.stdout + moved.stderr).toBe(0);
    expect(moved.stdout).toContain('2 passed');
  } finally { f.close(); }
}, 30_000);


test('warm transforms resolve changed package imports before reusing a passing test', () => {
  const f = fixture();
  try {
    const config = (target: string) => JSON.stringify({ type: 'module', imports: { '#value': target } });
    f.put('src/other.ts', 'export const value=9;');
    f.put('package.json', config('./src/value.ts'));
    for (const name of ['first', 'second']) {
      const file = `test/${name}.test.ts`;
      f.put(file, readFileSync(resolve(f.root, file), 'utf8').replace('../src/value', '#value'));
    }
    f.git('add', '.');
    const cold = f.run(['package.json']), warm = f.run(['package.json']);
    expect(cold.status, cold.stdout + cold.stderr).toBe(0);
    expect(warm.status, warm.stdout + warm.stderr).toBe(0);
    f.put('package.json', config('./src/other.ts')); f.git('add', 'package.json');
    const red = f.run(['package.json']);
    expect(red.status, red.stdout + red.stderr).not.toBe(0);
    expect(red.stdout + red.stderr).toContain('CF1 TEST FAILURE:');
  } finally { f.close(); }
}, 30_000);
