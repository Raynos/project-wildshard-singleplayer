// meta DEV-SPEED DS6: scripts/commit.sh run in a linked worktree commits through that worktree's own index and never
// rewrites the main checkout's (engine fixed the same bug; codex-mock found it repairing 8 entries by hand).
// oxlint-disable-next-line import/no-nodejs-modules -- Exercise Git and the public commit entry in a disposable repository.
import { spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Own and remove only this fixture's temporary files.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Use the test runner's managed temporary directory.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve fixture paths.
import { join } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the real entry independently of the fixture checkout.
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

const entry = fileURLToPath(new URL('../scripts/commit.sh', import.meta.url));
const message = 'test(fixture): commit from a worktree\n\nAssisted-by: Claude-Code:claude-opus-5-5';

test('a commit from a linked worktree uses its own index and leaves the main index untouched', () => {
  const root = mkdtempSync(join(tmpdir(), 'commit-worktree-'));
  const git = (cwd: string, ...args: string[]): string => {
    const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    return result.stdout.trim();
  };
  try {
    git(root, 'init', '-q', '--initial-branch=main');
    git(root, 'config', 'user.name', 'Fixture');
    git(root, 'config', 'user.email', 'fixture@example.com');
    git(root, 'config', 'core.hooksPath', join(root, '.git/hooks'));
    writeFileSync(join(root, 'selected'), 'old\n');
    writeFileSync(join(root, 'foreign'), 'old\n');
    git(root, 'add', '--', 'selected', 'foreign');
    git(root, 'commit', '-qm', 'fixture');
    writeFileSync(join(root, 'foreign'), 'foreign stage\n');
    git(root, 'add', '--', 'foreign');
    git(root, 'worktree', 'add', '-q', '-b', 'plan/p', 'tmp/p', 'main');
    const tree = join(root, 'tmp/p'), mainIndex = readFileSync(join(root, '.git/index')), mainHead = git(root, 'rev-parse', 'HEAD');
    writeFileSync(join(tree, 'selected'), 'from the worktree\n');
    const result = spawnSync(entry, [message, '--', 'selected'], { cwd: tree, encoding: 'utf8', timeout: 10_000 });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(git(tree, 'show', 'plan/p:selected')).toBe('from the worktree');
    expect(git(tree, 'status', '--porcelain', '--', 'selected')).toBe('');
    expect(readFileSync(join(root, '.git/index')).equals(mainIndex)).toBe(true);
    expect(git(root, 'rev-parse', 'HEAD')).toBe(mainHead);
    expect(git(root, 'diff', '--cached', '--name-only')).toBe('foreign');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
