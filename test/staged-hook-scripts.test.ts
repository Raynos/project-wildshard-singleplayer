// oxlint-disable-next-line import/no-nodejs-modules -- Run the real commit wrapper against owned Git fixtures.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Each test owns its tiny fixture under tmp.
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the actual checker and fixture paths.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Foreign Git-local overrides cannot reach fixtures.
import { env as processEnv } from 'node:process';
import { expect, test } from 'vitest';
import { precommitInputs } from '../scripts/precommit-inputs.mjs';
import wrapper from '../scripts/commit.sh?raw';

test('the wrapper preserves foreign stages, serializes messages and refuses a large blob', () => {
  expect(execFileSync('python3', ['test/fixtures/commit-index.py', resolve('.'), '-'], { encoding: 'utf8', input: wrapper }))
    .toContain('"storageRefusal": "passed"');
});

test('tsc owns diagnostics while the cheap checker retains typed and ordinary lint', async () => {
  mkdirSync('tmp', { recursive: true });
  const root = mkdtempSync(resolve('tmp/cheap-hook-'));
  const env = Object.fromEntries(Object.entries(processEnv).filter(([key]) => !key.startsWith('GIT_')));
  const git = (...args: string[]): void => { execFileSync('git', args, { cwd: root, env, stdio: 'ignore' }); };
  const file = resolve(root, 'unit.ts');
  try {
    git('init', '-q'); git('config', 'user.email', 'fixture@example.invalid'); git('config', 'user.name', 'fixture');
    git('config', 'core.hooksPath', '/dev/null');
    writeFileSync(resolve(root, '.oxlintrc.json'), JSON.stringify({ plugins:['typescript'],rules: { 'no-eval': 'error','typescript/no-floating-promises':'error' } }));
    writeFileSync(resolve(root, 'tsconfig.json'), JSON.stringify({ compilerOptions: { strict: true, target: 'esnext', types:[] }, include: ['*.ts'] }));
    writeFileSync(file, 'export const value: number = 1;\n');
    git('add', '--', 'unit.ts', '.oxlintrc.json', 'tsconfig.json'); git('commit', '-qm', 'base');
    const executable = resolve('node_modules/.bin/oxlint');
    writeFileSync(file, 'export const value: number = "wrong";\n'); git('add', '--', 'unit.ts');
    expect(()=>execFileSync(resolve('node_modules/.bin/tsc'),['--noEmit','--project',resolve(root,'tsconfig.json')],{cwd:root,env,stdio:'pipe'})).toThrow();
    await expect(precommitInputs(root, executable)).resolves.toBeUndefined();
    writeFileSync(file,'Promise.resolve(1);\n');git('add','--','unit.ts');
    await expect(precommitInputs(root,executable)).rejects.toThrow();
    writeFileSync(file, "eval('1');\n"); git('add', '--', 'unit.ts');
    await expect(precommitInputs(root, executable)).rejects.toThrow();
    writeFileSync(file, 'export const value: number = 2;\n'); git('add', '--', 'unit.ts');
    await expect(precommitInputs(root, executable)).resolves.toBeUndefined();
    // --patch mode's staged source must not lint a foreign working version.
    writeFileSync(file, 'export const value: number = "foreign";\n');
    await expect(precommitInputs(root, executable)).resolves.toBeUndefined();
    expect(execFileSync('git', ['show', ':unit.ts'], { cwd: root, env, encoding: 'utf8' })).toBe('export const value: number = 2;\n');
    expect(readFileSync(file, 'utf8')).toBe('export const value: number = "foreign";\n');
    expect(existsSync(resolve(root, '.git/push-deferred-types.json'))).toBe(false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('slow typed lint leaves staged bytes intact for CI', async () => {
  const root = mkdtempSync(resolve('tmp/soft-hook-'));
  const env = Object.fromEntries(Object.entries(processEnv).filter(([key]) => !key.startsWith('GIT_')));
  const git = (...args: string[]): string => execFileSync('git', args, { cwd: root, env, encoding: 'utf8' }).trim();
  try {
    git('init', '-q'); git('config', 'user.email', 'fixture@example.invalid'); git('config', 'user.name', 'fixture');
    git('config', 'core.hooksPath', '/dev/null');
    writeFileSync(resolve(root, '.oxlintrc.json'), '{}');
    writeFileSync(resolve(root, 'unit.ts'), 'export const value = 1;\n');
    git('add', '--', 'unit.ts', '.oxlintrc.json');
    const checker = resolve(root, 'slow-check.sh');
    writeFileSync(checker, '#!/bin/sh\nexec sleep 10\n'); chmodSync(checker, 0o755);
    const staged = readFileSync(resolve(root, '.git/index'));
    await expect(precommitInputs(root, checker)).resolves.toBeUndefined();
    expect(readFileSync(resolve(root, '.git/index'))).toEqual(staged);
    expect(existsSync(resolve(root, '.git/push-deferred-types.json'))).toBe(false);
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 15_000);

test('policy-only commits leave the index intact without deferred checks', async () => {
  const root = mkdtempSync(resolve('tmp/policy-hook-'));
  const env = Object.fromEntries(Object.entries(processEnv).filter(([key]) => !key.startsWith('GIT_')));
  const git = (...args: string[]): string => execFileSync('git', args, { cwd: root, env, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }).trim();
  try {
    git('init', '-q'); git('config', 'user.email', 'fixture@example.invalid'); git('config', 'user.name', 'fixture');
    git('config', 'core.hooksPath', '/dev/null');
    mkdirSync(resolve(root, 'lint')); mkdirSync(resolve(root, 'scripts'));
    writeFileSync(resolve(root, 'lint/ratchet.json'), '{"closedComponents":{}}');
    writeFileSync(resolve(root, 'scripts/precommit-checks.mjs'), 'setTimeout(()=>{},10000);');
    git('add', '.'); git('commit', '-qm', 'base');
    writeFileSync(resolve(root, 'lint/ratchet.json'), '{"closedComponents":{"example":["C9"]}}');
    git('add', '--', 'lint/ratchet.json');
    const index = readFileSync(resolve(root, '.git/index'));
    await precommitInputs(root);
    expect(existsSync(resolve(root, '.git/push-deferred-policy.json'))).toBe(false);
    expect(readFileSync(resolve(root, '.git/index'))).toEqual(index);
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 15_000);
