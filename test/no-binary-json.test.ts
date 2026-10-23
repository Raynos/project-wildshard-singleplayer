// oxlint-disable-next-line import/no-nodejs-modules -- Exercise exact immutable Git and staged-input policy in owned fixtures.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Own disposable source fixtures only.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve fixture paths within ignored tmp.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Drop inherited Git index variables in owned fixtures.
import { env as processEnv } from 'node:process';
import { expect, test } from 'vitest';
import { binaryJsonCounts, binaryJsonFailures, binaryJsonPolicy, binaryPolicyIncreases,
  checkBinaryRevision, checkBinaryTree } from '../scripts/no-binary-json.mjs';

import { commitCheckFailed } from '../scripts/precommit-jobs.mjs';
import { precommitInputs } from '../scripts/precommit-inputs.mjs';

const payload = 'a'.repeat(1024);
const path = 'public/assets/example/rows.json';
const source = 'a'.repeat(40);
const policy = (files = {}) => binaryJsonPolicy({ schema: 'no-binary-json/1', source, files });

test('decoded strings, keys and data URIs cannot hide behind JSON escaping', () => {
  const empty = policy();
  expect(binaryJsonFailures(path, JSON.stringify({ text: 'ordinary rows', short: 'a'.repeat(1023) }), empty)).toEqual([]);
  expect(binaryJsonFailures(path, `{"text":"${String.raw`\u0061`.repeat(1024)}"}`, empty)).toHaveLength(1);
  expect(binaryJsonFailures(path, JSON.stringify({ [payload]: 'key' }), empty)).toHaveLength(1);
  expect(binaryJsonCounts({ nested: [{ url: 'DATA:application/octet-stream;base64,AA==' }] })).toEqual({ base64Chars: 0, dataUris: 1 });
  expect(binaryJsonFailures(path, '{// config\n"value": NaN,"name":"Infinity",}', empty)).toEqual([]);
  expect(() => binaryJsonFailures(path, '{broken', empty)).toThrow('invalid JSON');
});

test('exact path caps only shrink; allowance cannot move or change binary representation', () => {
  const before = policy({ [path]: { base64Chars: 1024, dataUris: 1 } });
  expect(binaryJsonFailures(path, JSON.stringify({ text: payload }), before)).toEqual([]);
  expect(binaryJsonFailures('public/assets/example/new.json', JSON.stringify({ text: payload }), before)).toHaveLength(1);
  expect(binaryJsonFailures(path, JSON.stringify({ text: `${payload}a` }), before)).toHaveLength(1);
  expect(binaryPolicyIncreases(before, policy({ [path]: { base64Chars: 1023, dataUris: 0 } }))).toEqual([]);
  expect(binaryPolicyIncreases(before, policy({ [path]: { base64Chars: 1023, dataUris: 2 } }))).toHaveLength(1);
  expect(commitCheckFailed({ name: 'binary JSON', code: 124, timedOut: true, output: 'BINARY-JSON public/rows.json: observed refusal' })).toBe(true);
  expect(binaryPolicyIncreases(before, policy({ 'public/other.json': { base64Chars: 1024, dataUris: 0 } }))).toHaveLength(1);
  expect(() => policy({ '../escape.json': { base64Chars: 1024, dataUris: 0 } })).toThrow('invalid allowance');
});

test('wide and deep authored rows do not overflow the traversal call stack', () => {
  const wide = Array.from({ length: 200_000 }, () => 1);
  let deep: unknown = payload;
  for (let level = 0; level < 20_000; level++) deep = [deep];
  expect(binaryJsonCounts([wide, deep])).toEqual({ base64Chars: 1024, dataUris: 0 });
});

function fixture(run: (root: string, git: (...args: string[]) => string, put: (name: string, value: string) => void) => void): void {
  mkdirSync(resolve('tmp'), { recursive: true });
  const root = mkdtempSync(resolve('tmp/binary-json-test-'));
  const env = Object.fromEntries(Object.entries(processEnv).filter(([key]) => !key.startsWith('GIT_')));
  const git = (...args: string[]): string => execFileSync('git', args, { cwd: root, env, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }).trim();
  const put = (name: string, value: string): void => {
    const target = resolve(root, name); mkdirSync(resolve(target, '..'), { recursive: true }); writeFileSync(target, value);
  };
  try {
    git('init', '-q'); git('config', 'core.hooksPath', '/dev/null'); git('config', 'user.name', 'fixture'); git('config', 'user.email', 'fixture@example.invalid');
    put('lint/no-binary-json.json', JSON.stringify(policy())); git('add', '.'); git('commit', '-qm', 'fixture');
    run(root, git, put);
  } finally { rmSync(root, { recursive: true, force: true }); }
}

test('staged checks read exact index assets and reject self-approved caps', () => fixture((root, git, put) => {
  put(path, JSON.stringify({ text: payload })); git('add', path);
  put(path, '{}');
  expect(checkBinaryRevision(root, ':', 'HEAD', [path])).toHaveLength(1);
  put('lint/no-binary-json.json', JSON.stringify(policy({ [path]: { base64Chars: 1024, dataUris: 0 } })));
  git('add', 'lint/no-binary-json.json');
  expect(checkBinaryRevision(root, ':', 'HEAD', [path, 'lint/no-binary-json.json'])).toEqual([
    expect.stringContaining('allowance grew'),
  ]);
}));

test('immutable commit checks cannot be fooled by a clean index or later deletion', () => fixture((root, git, put) => {
  const parent = git('rev-parse', 'HEAD');
  put(path, JSON.stringify({ text: payload })); git('add', path); git('commit', '-qm', 'binary fixture');
  const bad = git('rev-parse', 'HEAD');
  put(path, '{}'); git('add', path); git('commit', '-qm', 'clean fixture');
  expect(checkBinaryRevision(root, bad, parent, [path])).toHaveLength(1);
  expect(checkBinaryRevision(root, 'HEAD', bad, [path])).toEqual([]);
  git('rm', 'lint/no-binary-json.json');
  expect(checkBinaryRevision(root, ':', 'HEAD', ['lint/no-binary-json.json'])).toHaveLength(1);
}));

test('CI includes ignored generator outputs and refuses symlink inputs', () => fixture((root, git, put) => {
  put('.gitignore', '*.generated.json\n'); git('add', '.gitignore'); git('commit', '-qm', 'ignore fixture');
  put('src/shards/example/data/new.generated.json', JSON.stringify({ text: payload }));
  expect(checkBinaryTree(root)).toEqual([expect.stringContaining('new.generated.json')]);
  // A tracked JSON symlink is a refused input, never followed outside its tree.
  symlinkSync(resolve(root, 'lint/no-binary-json.json'), resolve(root, 'src/policy.json'));
  git('add', 'src/policy.json');
  expect(() => checkBinaryTree(root)).toThrow('symlink');
}));


test('the parallel pre-commit job uses the staged checker and JSON, preserving foreign files', async () => {
  mkdirSync(resolve('tmp'), { recursive: true });
  const root = mkdtempSync(resolve('tmp/binary-json-hook-'));
  const env = Object.fromEntries(Object.entries(processEnv).filter(([key]) => !key.startsWith('GIT_')));
  const git = (...args: string[]): string => execFileSync('git', args, { cwd: root, env, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }).trim();
  const put = (name: string, value: string): void => {
    const target = resolve(root, name); mkdirSync(resolve(target, '..'), { recursive: true }); writeFileSync(target, value);
  };
  try {
    git('init', '-q'); git('config', 'core.hooksPath', '/dev/null'); git('config', 'user.name', 'fixture'); git('config', 'user.email', 'fixture@example.invalid');
    put('.oxlintrc.json', '{}');
    put('lint/no-binary-json.json', JSON.stringify(policy()));
    put('scripts/no-binary-json.mjs', readFileSync(new URL('../scripts/no-binary-json.mjs', import.meta.url), 'utf8'));
    git('add', '.'); git('commit', '-qm', 'fixture');
    put(path, JSON.stringify({ text: payload })); git('add', path);
    put(path, '{}'); put('scripts/no-binary-json.mjs', 'throw Error("foreign uncommitted checker");');
    const index = readFileSync(resolve(root, '.git/index'));
    await expect(precommitInputs(root)).rejects.toThrow('binary JSON: refused');
    expect(readFileSync(resolve(root, '.git/index'))).toEqual(index);
    expect(readFileSync(resolve(root, path), 'utf8')).toBe('{}');
    git('add', path); put(path, JSON.stringify({ text: payload }));
    await expect(precommitInputs(root)).resolves.toBeUndefined();
    expect(readFileSync(resolve(root, 'scripts/no-binary-json.mjs'), 'utf8')).toContain('foreign uncommitted checker');
  } finally { rmSync(root, { recursive: true, force: true }); }
});


test('a debt correction needs exact unique final-footer approval, including at committed Git checks', () => fixture((root, git, put) => {
  const before = policy(), after = policy({ [path]: { base64Chars: 13960, dataUris: 0 } });
  const line = `Binary-JSON-Approved: wildshard-new ${path} 13960 0`;
  const message = `fix: record measured debt\n\n${line}\n\nAssisted-by: fixture:model`;
  expect(binaryPolicyIncreases(before, after, message)).toEqual([]);
  for (const text of [message.replace('13960', '13961'), message.replace('wildshard-new', 'other'),
    `fix: bad\n\n${line}\n\nbody after approval`, `fix: bad\n\n${line}\n${line}`])
    expect(binaryPolicyIncreases(before, after, text).length).toBeGreaterThan(0);
  expect(binaryPolicyIncreases(before, before, message).length).toBeGreaterThan(0);
  const parent = git('rev-parse', 'HEAD');
  put('lint/no-binary-json.json', JSON.stringify(after)); put(path, JSON.stringify({ text: 'a'.repeat(13960) }));
  git('add', '.'); git('commit', '-qm', message);
  expect(checkBinaryRevision(root, 'HEAD', parent, ['lint/no-binary-json.json', path])).toEqual([]);
}));


test('source/tool base64 debt cannot grow, move or disappear from exact Git policy',()=>fixture((root,git,put)=>{
  const file='lint/base64-debt.json';
  const debt=(files:Record<string,number>)=>JSON.stringify({schema:'no-base64/1',source,files});
  put(file,debt({'src/old.ts':2,'scripts/old.mjs':1}));git('add',file);git('commit','-qm','seed source debt');
  put(file,debt({'src/old.ts':1}));git('add',file);
  expect(checkBinaryRevision(root,':','HEAD',[file])).toEqual([]);
  const cases:Record<string,number>[]=[{'src/old.ts':3},{'src/new.ts':1},{'scripts/new.mjs':1}];
  for(const files of cases){
    put(file,debt(files));git('add',file);
    expect(checkBinaryRevision(root,':','HEAD',[file]).join(' ')).toContain('base64 allowance grew');
  }
  git('rm','-f',file);
  expect(checkBinaryRevision(root,':','HEAD',[file]).join(' ')).toContain('base64 policy deleted');
}));
