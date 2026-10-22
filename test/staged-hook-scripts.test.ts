// oxlint-disable-next-line import/no-nodejs-modules -- Run the real commit wrapper against owned Git fixtures.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Each test owns its tiny fixture under tmp.
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the actual checker and fixture paths.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Foreign Git-local overrides cannot reach fixtures.
import { env as processEnv } from 'node:process';
import { expect, test } from 'vitest';
import { precommitInputs } from '../scripts/precommit-inputs.mjs';

test('the wrapper preserves foreign stages, serializes messages and refuses a large blob', () => {
  expect(execFileSync('python3', ['test/fixtures/commit-index.py', resolve('.')], { encoding: 'utf8' }))
    .toContain('"storageRefusal": "passed"');
});

test('the cheap checker actually refuses types and lint without a mirror or generation', () => {
  mkdirSync('tmp', { recursive: true });
  const root = mkdtempSync(resolve('tmp/cheap-hook-'));
  const env = Object.fromEntries(Object.entries(processEnv).filter(([key]) => !key.startsWith('GIT_')));
  const git = (...args: string[]): void => { execFileSync('git', args, { cwd: root, env, stdio: 'ignore' }); };
  const file = resolve(root, 'unit.ts');
  try {
    git('init', '-q'); git('config', 'user.email', 'fixture@example.invalid'); git('config', 'user.name', 'fixture');
    git('config', 'core.hooksPath', '/dev/null');
    writeFileSync(resolve(root, '.oxlintrc.json'), JSON.stringify({ rules: { 'no-eval': 'error' } }));
    writeFileSync(resolve(root, 'tsconfig.json'), JSON.stringify({ compilerOptions: { strict: true, target: 'esnext' }, include: ['*.ts'] }));
    writeFileSync(file, 'export const value: number = 1;\n');
    git('add', '--', 'unit.ts'); git('commit', '-qm', 'base');
    const executable = resolve('node_modules/.bin/oxlint');
    writeFileSync(file, 'export const value: number = "wrong";\n'); git('add', '--', 'unit.ts');
    expect(() => precommitInputs(root, executable)).toThrow();
    writeFileSync(file, "eval('1');\n"); git('add', '--', 'unit.ts');
    expect(() => precommitInputs(root, executable)).toThrow();
    writeFileSync(file, 'export const value: number = 2;\n'); git('add', '--', 'unit.ts');
    expect(() => precommitInputs(root, executable)).not.toThrow();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('time alone defers the exact staged blob to the push gate', () => {
  const root = mkdtempSync(resolve('tmp/soft-hook-'));
  const env = Object.fromEntries(Object.entries(processEnv).filter(([key]) => !key.startsWith('GIT_')));
  const git = (...args: string[]): string => execFileSync('git', args, { cwd: root, env, encoding: 'utf8' }).trim();
  try {
    git('init', '-q'); git('config', 'user.email', 'fixture@example.invalid'); git('config', 'user.name', 'fixture');
    git('config', 'core.hooksPath', '/dev/null');
    writeFileSync(resolve(root, '.oxlintrc.json'), '{}');
    writeFileSync(resolve(root, 'unit.ts'), 'export const value = 1;\n');
    git('add', '--', 'unit.ts');
    const checker = resolve(root, 'slow-check.sh');
    writeFileSync(checker, '#!/bin/sh\nexec sleep 10\n'); chmodSync(checker, 0o755);
    expect(() => precommitInputs(root, checker)).not.toThrow();
    expect(JSON.parse(readFileSync(resolve(root, '.git/push-deferred-types.json'), 'utf8')))
      .toEqual({ 'unit.ts': [git('rev-parse', ':unit.ts')] });
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 15_000);
