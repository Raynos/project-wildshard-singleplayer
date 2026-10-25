// oxlint-disable-next-line import/no-nodejs-modules -- Real commit hooks run in owned tiny Git repositories.
import { execFileSync, spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Own fixture source and hook files are removed after each case.
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve fixture files and the production commit entry point.
import { dirname, resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Child Git commands must not inherit the enclosing commit's index.
import { env, execPath } from 'node:process';
import { expect, test } from 'vitest';
import { linkNodeModules } from '../scripts/link-node-modules.mjs';
import { commitRelated, relatedDeadline, relatedTestFailed, warmTypeJobs } from '../scripts/precommit-related.mjs';

const repository = resolve('.');
const fixtureEnv = Object.fromEntries(Object.entries(env).filter(([key]) => !key.startsWith('GIT_')));

function fixture() {
  mkdirSync('tmp', { recursive: true });
  const root = mkdtempSync(resolve('tmp/cf1-test-'));
  const git = (...args: string[]): string => execFileSync('git', args, { cwd: root, env: fixtureEnv, encoding: 'utf8' }).trim();
  const put = (name: string, text: string): void => { mkdirSync(dirname(resolve(root, name)), { recursive: true }); writeFileSync(resolve(root, name), text); };
  git('init', '-q'); git('config', 'user.name', 'CF1 fixture'); git('config', 'user.email', 'cf1@example.invalid');
  git('config', 'core.hooksPath', '/dev/null');
  put('package.json', '{"type":"module"}');
  put('vitest.config.mjs', 'export default {test:{include:["test/**/*.test.ts"],maxWorkers:1}};');
  put('src/value.ts', 'export const value = 1;\n');
  put('test/value.test.ts', 'import {test,expect} from "vitest";import {value} from "../src/value";test("value",()=>{expect(Object.keys(process.env).filter(key=>key.startsWith("GIT_"))).toEqual([]);expect(process.env.WS_COMMIT_RELATED_TOKEN).toBeUndefined();expect(value).toBe(1)});\n');
  git('add', '.'); git('commit', '-qm', 'fixture');
  linkNodeModules(repository, root);
  return { root, git, put };
}

test('real commit.sh refuses a related red, accepts the fix and checks a semantic patch over peer WIP', () => {
  const { root, git, put } = fixture();
  try {
    put('.githooks/pre-commit', `#!/bin/sh\nexec '${execPath}' '${resolve(root, 'hook.mjs')}'\n`);
    chmodSync(resolve(root, '.githooks/pre-commit'), 0o755);
    put('hook.mjs', `import {execFileSync} from 'node:child_process';import {commitRelated} from '${resolve('scripts/precommit-related.mjs')}';const paths=execFileSync('git',['diff','--cached','--name-only','-z'],{encoding:'utf8'}).split('\\0').filter(Boolean);await commitRelated(process.cwd(),paths);`);
    git('config', 'core.hooksPath', '.githooks');
    const commit = (args: string[]) => spawnSync('bash', [resolve(repository, 'scripts/commit.sh'), ...args], { cwd: root, env: fixtureEnv, encoding: 'utf8', timeout: 20_000 });
    const parent = git('rev-parse', 'HEAD');
    put('src/value.ts', 'export const value = 2;\n');
    const red = commit(['test(cf1): refuse red', '--', 'src/value.ts']);
    expect(red.status, red.stdout + red.stderr).not.toBe(0);
    expect(red.stdout + red.stderr).toContain('CF1 TEST FAILURE:');
    expect(git('rev-parse', 'HEAD')).toBe(parent);
    put('test/value.test.ts', readFileSync(resolve(root, 'test/value.test.ts'), 'utf8').replace('toBe(1)', 'toBe(2)'));
    const green = commit(['test(cf1): accept fix', '--', 'src/value.ts', 'test/value.test.ts']);
    expect(green.status, green.stdout + green.stderr).toBe(0);
    expect(green.stdout + green.stderr).toContain('1 related suites');
    // Stage source 3, but retain a peer's loose source 99 through --patch.
    put('src/value.ts', 'export const value = 3;\n');
    put('test/value.test.ts', readFileSync(resolve(root, 'test/value.test.ts'), 'utf8').replace('toBe(2)', 'toBe(3)'));
    put('candidate.patch', `${git('diff', '--', 'src/value.ts', 'test/value.test.ts')}\n`);
    put('src/value.ts', 'export const value = 99;\n');
    const patched = commit(['--patch', resolve(root, 'candidate.patch'), 'test(cf1): check staged patch', '--', 'src/value.ts', 'test/value.test.ts']);
    expect(patched.status, patched.stdout + patched.stderr).toBe(0);
    expect(git('show', 'HEAD:src/value.ts')).toContain('value = 3');
    expect(readFileSync(resolve(root, 'src/value.ts'), 'utf8')).toContain('value = 99');
    put('src/dependency.ts', 'export const base = 4;\n');
    put('src/value.ts', 'import {base} from "./dependency";export const value = base;\n');
    put('test/value.test.ts', readFileSync(resolve(root, 'test/value.test.ts'), 'utf8').replace('toBe(3)', 'toBe(4)'));
    const dependency = commit(['test(cf1): add dependency', '--', 'src/value.ts', 'src/dependency.ts', 'test/value.test.ts']);
    expect(dependency.status, dependency.stdout + dependency.stderr).toBe(0);
    // The dirty dependency is NOT staged by this next commit.
    put('src/dependency.ts', 'export const base = 99;\n');
    put('src/value.ts', 'import {base} from "./dependency";export const value = base + 1;\n');
    put('test/value.test.ts', readFileSync(resolve(root, 'test/value.test.ts'), 'utf8').replace('toBe(4)', 'toBe(5)'));
    const peer = commit(['test(cf1): isolate peer WIP', '--', 'src/value.ts', 'test/value.test.ts']);
    expect(peer.status, peer.stdout + peer.stderr).toBe(0);
    expect(readFileSync(resolve(root, 'src/dependency.ts'), 'utf8')).toContain('base = 99');
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 30_000);

test('types run only when touched project metadata is already warm', () => {
  const { root, git, put } = fixture();
  try {
    put('tsconfig.json', '{"compilerOptions":{"moduleResolution":"bundler","module":"esnext"},"include":["src","test"]}');
    put('tsconfig.engine.json', '{"extends":"./tsconfig.json","compilerOptions":{"tsBuildInfoFile":".tsc-layers/engine.tsbuildinfo"},"include":["src/engine"]}');
    const file = 'src/engine/subject.test.ts';
    put(file, 'export const value = 1;'); git('add', '.');
    expect(warmTypeJobs(root, [file])).toEqual([]);
    put('.tsc-layers/engine.tsbuildinfo', '{}');
    expect(warmTypeJobs(root, [file]).map(job => job.command.slice(1, 3))).toEqual([['-p', 'tsconfig.engine.json']]);
    put('src/engine/tsconfig.test.json', '{"extends":"../../tsconfig.json","compilerOptions":{"tsBuildInfoFile":"../../.tsc-layers/engine-tests.tsbuildinfo"},"include":["**/*.test.ts"],"references":[{"path":"../../tsconfig.engine.json"}]}');
    put('tsconfig.engine.json', '{"extends":"./tsconfig.json","include":["src/engine"],"exclude":["**/*.test.ts"]}');
    put('.tsc-layers/engine-tests.tsbuildinfo', '{}'); git('add', '.');
    const jobs = warmTypeJobs(root, [file]);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.command).toContain('src/engine/tsconfig.test.json');
    expect(jobs[0]?.command.at(-1)).toBe('node_modules/.cache/commit-src-engine-tsconfig.test.json.tsbuildinfo');
    put('tsconfig.app.json', '{"extends":"./tsconfig.json","include":["src/*.ts"],"exclude":["src/*.test.ts"]}');
    put('src/tsconfig.test.json', '{"extends":"../tsconfig.json","compilerOptions":{"tsBuildInfoFile":"../.tsc-layers/app-tests.tsbuildinfo"},"include":["*.test.ts"],"references":[{"path":"../tsconfig.app.json"}]}');
    put('src/entry.test.ts', 'export const value = 1;');
    put('.tsc-layers/app-tests.tsbuildinfo', '{}'); git('add', '.');
    const appJobs = warmTypeJobs(root, ['src/entry.test.ts']);
    expect(appJobs).toHaveLength(1);
    expect(appJobs[0]?.command).toContain('src/tsconfig.test.json');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('a broken runner and an exhausted deadline defer without changing the index', async () => {
  const { root, git, put } = fixture();
  try {
    const before = readFileSync(resolve(root, '.git/index'));
    put('vitest.config.mjs', 'throw new Error("broken tooling");');
    await expect(commitRelated(root, ['src/value.ts'])).resolves.toBeUndefined();
    put('vitest.config.mjs', 'export default {test:{include:["test/**/*.test.ts"],maxWorkers:1}};');
    await expect(commitRelated(root, ['src/value.ts'], performance.now() - 1)).resolves.toBeUndefined();
    expect(readFileSync(resolve(root, '.git/index'))).toEqual(before);
    expect(git('rev-list', '--count', 'HEAD')).toBe('1');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('a beforeAll prerequisite refusal is not labelled an executed test failure', async () => {
  const { root, git, put } = fixture();
  try {
    put('test/value.test.ts', 'import {test,beforeAll,expect} from "vitest";import {value} from "../src/value";beforeAll(()=>{throw Error("Missing fixture infrastructure")});test("value",()=>expect(value).toBe(1));');
    git('add', 'test/value.test.ts');
    await expect(commitRelated(root, ['src/value.ts'])).resolves.toBeUndefined();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('a deadline preserves this worker red without mistaking nested fixture output for it', () => {
  const timedOut = { name: 'related tests', code: 124, timedOut: true, output: 'CF1 TEST FAILURE: own-token test/unit.test.ts: red' };
  expect(relatedTestFailed(timedOut, 'own-token')).toBe(true);
  expect(relatedTestFailed({ ...timedOut, output: '' }, 'own-token')).toBe(false);
  expect(relatedTestFailed(timedOut, 'outer-token')).toBe(false);
  expect(relatedTestFailed({ ...timedOut, name: 'types' }, 'own-token')).toBe(false);
});


test('real commit excludes a loose peer regression but refuses it when staged', () => {
  const {root,git,put}=fixture();
  try {
    put('.githooks/pre-commit', `#!/bin/sh\nexec '${execPath}' '${resolve(root,'hook.mjs')}'\n`);
    chmodSync(resolve(root,'.githooks/pre-commit'),0o755);
    put('hook.mjs',`import {execFileSync} from 'node:child_process';import {commitRelated} from '${resolve('scripts/precommit-related.mjs')}';await commitRelated(process.cwd(),execFileSync('git',['diff','--cached','--name-only','-z'],{encoding:'utf8'}).split('\\0').filter(Boolean));`);
    git('config','core.hooksPath','.githooks');
    put('src/value.ts','export const value = 2;\n');
    put('test/value.test.ts','import {test,expect} from "vitest";import {value} from "../src/value";test("value",()=>expect(value).toBe(2));');
    const peer='import {test,expect} from "vitest";import {value} from "../src/value";test("peer regression",()=>expect(value).toBe(99));';
    put('test/peer.test.ts',peer);
    const commit=(paths:string[])=>spawnSync('bash',[resolve(repository,'scripts/commit.sh'),'test(cf1): candidate test boundary','--',...paths],{cwd:root,env:fixtureEnv,encoding:'utf8',timeout:20_000});
    const green=commit(['src/value.ts','test/value.test.ts']);
    expect(green.status,green.stdout+green.stderr).toBe(0);
    expect(green.stdout+green.stderr).toContain('absent from the candidate index');
    expect(readFileSync(resolve(root,'test/peer.test.ts'),'utf8')).toBe(peer);
    const parent=git('rev-parse','HEAD'),red=commit(['test/peer.test.ts']);
    expect(red.status,red.stdout+red.stderr).not.toBe(0);
    expect(red.stdout+red.stderr).toContain('CF1 TEST FAILURE:');
    expect(git('rev-parse','HEAD')).toBe(parent);
  }finally{rmSync(root,{recursive:true,force:true});}
},30_000);

test('real commits refuse reds above twenty related suites and twenty staged tests', () => {
  const {root,git,put}=fixture();
  try {
    for(let index=0;index<19;index++)put(`test/extra-${index}.test.ts`,
      'import {test,expect} from "vitest";import {value} from "../src/value";test("related",()=>expect(value).toBeGreaterThan(0));');
    git('add','.');git('commit','-qm','twenty related suites');
    put('.githooks/pre-commit',`#!/bin/sh\nexec '${execPath}' '${resolve(root,'hook.mjs')}'\n`);
    chmodSync(resolve(root,'.githooks/pre-commit'),0o755);
    put('hook.mjs',`import {execFileSync} from 'node:child_process';import {commitRelated} from '${resolve('scripts/precommit-related.mjs')}';await commitRelated(process.cwd(),execFileSync('git',['diff','--cached','--name-only','-z'],{encoding:'utf8'}).split('\\0').filter(Boolean));`);
    git('config','core.hooksPath','.githooks');
    put('src/value.ts','export const value = 2;\n');
    const commit=(paths:string[])=>spawnSync('bash',[resolve(repository,'scripts/commit.sh'),'test(cf1): bounded selection','--',...paths],{cwd:root,env:fixtureEnv,encoding:'utf8',timeout:20_000});
    const parent=git('rev-parse','HEAD'),red=commit(['src/value.ts']);
    expect(red.status,red.stdout+red.stderr).not.toBe(0);
    expect(red.stdout+red.stderr).toContain('selected 20 related suites');
    expect(red.stdout+red.stderr).toContain('CF1 TEST FAILURE:');
    expect(git('rev-parse','HEAD')).toBe(parent);
    put('test/extra-19.test.ts','import {test,expect} from "vitest";import {value} from "../src/value";test("staged red above twenty",()=>expect(value).toBe(99));');
    const expanded=commit(['src/value.ts','test/extra-19.test.ts']);
    expect(expanded.status,expanded.stdout+expanded.stderr).not.toBe(0);
    expect(expanded.stdout+expanded.stderr).toContain('staged red above twenty');
    expect(expanded.stdout+expanded.stderr).toContain('CF1 TEST FAILURE:');
    expect(expanded.stdout+expanded.stderr).not.toContain('no tests executed');
    expect(git('rev-parse','HEAD')).toBe(parent);
    const staged=Array.from({length:20},(_,index)=>`test/extra-${index}.test.ts`).concat('test/value.test.ts');
    for(const file of staged)put(file,`${readFileSync(resolve(root,file),'utf8')}\n// staged batch\n`);
    const batch=commit(staged);
    expect(batch.status,batch.stdout+batch.stderr).not.toBe(0);
    expect(batch.stdout+batch.stderr).toContain('21 staged/direct suites');
    expect(batch.stdout+batch.stderr).toContain('CF1 TEST FAILURE:');
    expect(batch.stdout+batch.stderr).toContain(' RUN ');
    expect(git('rev-parse','HEAD')).toBe(parent);
  } finally {rmSync(root,{recursive:true,force:true});}
},30_000);

test('one invocation deadline includes earlier lock/guard time and never renews an exhausted budget', () => {
  expect(relatedDeadline('1000',44_000,500)).toBe(17_500);
  expect(relatedDeadline('1000',61_001,500)).toBe(500);
  expect(relatedDeadline('invalid',1000,500)).toBe(500);
});

test('the static project guard still refuses a large selection after the invocation deadline', async () => {
  const {root,git,put}=fixture();
  try {
    put('tsconfig.json','{"compilerOptions":{"moduleResolution":"bundler","module":"esnext"},"include":["test"]}');
    put('tsconfig.engine.json','{"extends":"./tsconfig.json","include":["src/engine"]}');
    put('src/engine/value.ts','import "../../test/outside";');
    put('test/outside.ts','export const outside=1;');
    const files=['src/engine/value.ts'];
    for(let index=0;index<21;index++){const file=`test/staged-${index}.test.ts`;put(file,'export const value=1;');files.push(file);}
    git('add','.');
    await expect(commitRelated(root,files,performance.now()-1)).rejects.toThrow('TS6307');
  }finally{rmSync(root,{recursive:true,force:true});}
});
