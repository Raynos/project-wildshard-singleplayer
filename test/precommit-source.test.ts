// oxlint-disable-next-line import/no-nodejs-modules -- Exercise exact Git blobs in owned tiny repositories.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Each fixture owns and removes its source and index.
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the checker and owned fixture paths.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Fixtures must not inherit a peer's Git index.
import { env } from 'node:process';
import { expect, test } from 'vitest';
import { precommitInputs } from '../scripts/precommit-inputs.mjs';

const { WS_PRECOMMIT_FIXTURE: fixturePath, WS_PRECOMMIT_SOURCE: sourcePath } = env;

test('selected source retains exact imports, predecessor, assets, deleted readers and locked owners', () => {
  const output = execFileSync('python3', [fixturePath ?? 'test/fixtures/precommit-source-selection.py',
    sourcePath ?? resolve('scripts/precommit-source.py')],
  { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  expect(output).toContain('12 exact staged-source selection regressions passed');
  expect(output).toContain('13 staged import guard regressions passed');
});

test('docs-only commits make no source snapshot or lint worker', async () => {
  mkdirSync('tmp', { recursive: true });
  const root = mkdtempSync(resolve('tmp/docs-hook-'));
  const gitEnv = Object.fromEntries(Object.entries(env).filter(([key]) => !key.startsWith('GIT_')));
  const git = (...args: string[]): void => { execFileSync('git', args, { cwd: root, env: gitEnv, stdio: 'ignore', maxBuffer: 32 * 1024 * 1024 }); };
  try {
    git('init', '-q'); git('config', 'user.email', 'fixture@example.invalid'); git('config', 'user.name', 'fixture'); git('config', 'core.hooksPath', '/dev/null');
    mkdirSync(resolve(root, 'docs')); mkdirSync(resolve(root, 'lint'));
    writeFileSync(resolve(root, 'docs/HOST-BAR.md'), 'Reviewed owner documentation.\n');
    writeFileSync(resolve(root, 'lint/ratchet.json'), '{"closedComponents":{"example":["C9"]}}');
    git('add', '.'); git('commit', '-qm', 'fixture');
    writeFileSync(resolve(root, 'docs/HOST-BAR.md'), 'Updated owner documentation.\n'); git('add', 'docs/HOST-BAR.md');
    const checker = resolve(root, 'refuse.sh'); writeFileSync(checker, '#!/bin/sh\nexit 1\n'); chmodSync(checker, 0o755);
    const initial = readFileSync(resolve(root, '.git/index'));
    await expect(precommitInputs(root, checker)).resolves.toBeUndefined();
    expect(existsSync(resolve(root, 'tmp'))).toBe(false);
    expect(readFileSync(resolve(root, '.git/index'))).toEqual(initial);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('test-only changes retain fast lint without running a source ratchet', async () => {
  mkdirSync('tmp', { recursive: true });
  const root = mkdtempSync(resolve('tmp/test-hook-'));
  const gitEnv = Object.fromEntries(Object.entries(env).filter(([key]) => !key.startsWith('GIT_')));
  const git = (...args: string[]): void => { execFileSync('git', args, { cwd: root, env: gitEnv, stdio: 'ignore', maxBuffer: 32 * 1024 * 1024 }); };
  try {
    git('init', '-q'); git('config', 'user.email', 'fixture@example.invalid'); git('config', 'user.name', 'fixture'); git('config', 'core.hooksPath', '/dev/null');
    mkdirSync(resolve(root, 'test')); mkdirSync(resolve(root, 'lint'));
    writeFileSync(resolve(root, '.oxlintrc.json'), '{}');
    // Deliberately invalid source policy must never execute for a test-only edit.
    writeFileSync(resolve(root, 'lint/ratchet.json'), '{"closedComponents":{"example":["bad"]}}');
    writeFileSync(resolve(root, 'test/unit.test.ts'), 'export const value = 1;\n');
    git('add', '.'); git('commit', '-qm', 'fixture');
    writeFileSync(resolve(root, 'test/unit.test.ts'), 'export const value = 2;\n'); git('add', 'test/unit.test.ts');
    const calls = resolve(root, 'calls.txt'), checker = resolve(root, 'checker.sh');
    writeFileSync(checker, `#!/bin/sh\nprintf '%s\\n' "$@" >> '${calls}'\n`); chmodSync(checker, 0o755);
    await precommitInputs(root, checker);
    const output = readFileSync(calls, 'utf8');
    expect(output).toContain('--type-aware'); expect(output).toContain('test/unit.test.ts');
    expect(output).not.toContain('.commit-ratchet-lint.json');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
