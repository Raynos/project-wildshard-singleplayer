// oxlint-disable-next-line import/no-nodejs-modules -- These tests own real tiny Git indexes and child processes.
import { execFileSync } from 'node:child_process';
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

test('fast lint retains custom rules and overrides except the two approved whole-program rules', () => {
  const original = { options: { typeAware: true, reportUnusedDisableDirectives: 'error' },
    jsPlugins: ['./lint/wildshard-plugin.js'], rules: { 'wildshard/no-authored-html': 'error', 'wildshard/no-shard-branch': 'error' },
    overrides: [{ files: ['src/**'], rules: { 'wildshard/no-shard-host-callback': 'error' } }] };
  const config = fastCommitLintConfig(structuredClone(original));
  expect(config.options).toMatchObject({ typeAware: false, reportUnusedDisableDirectives: 'off' });
  expect(config['rules']).toEqual({ 'wildshard/no-authored-html': 'off', 'wildshard/no-shard-host-callback': 'off', 'wildshard/no-shard-branch': 'error' });
  expect(config['overrides']).toEqual([...original.overrides, { files: ['**/*'], rules: { 'wildshard/no-authored-html': 'off', 'wildshard/no-shard-host-callback': 'off' } }]);
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
  for (const output of ['unit.ts:1: error typescript(TS2322): wrong', ' FAIL test/bad.test.ts', 'CLOSED C1 has custom lines', 'src/a.ts: deleted path src/gone.ts']) {
    expect(commitCheckFailed({ name: 'check', code: 124, timedOut: true, output })).toBe(true);
  }
});
