// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the real pusher with disposable Git repositories.
import { execFileSync, spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Own fixture files, indexes and remotes only.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Canonical fixture directory.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Fixture path construction.
import { join } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Retain ordinary execution settings while injecting Git context.
import process from 'node:process';
import { expect, it } from 'vitest';

it.each(['index', 'repository'] as const)('isolates a detached push from inherited Git %s context', (context) => {
  const root = mkdtempSync(join(tmpdir(), 'auto-push-env-'));
  const git = (...args: string[]): string => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  try {
    git('init', '-q', '-b', 'main'); git('config', 'core.hooksPath', '/dev/null');
    git('config', 'user.name', 'Fixture'); git('config', 'user.email', 'fixture@example.invalid');
    const commit = (text: string): void => {
      writeFileSync(join(root, 'source.txt'), text); git('add', 'source.txt'); git('commit', '-qm', 'fixture');
    };
    commit('base');
    const remote = join(root, 'remote.git'); git('init', '-q', '--bare', remote);
    git('remote', 'add', 'origin', remote); git('push', '-q', 'origin', 'main');
    const delivered = git('rev-parse', 'origin/main'); commit('next');
    const head = git('rev-parse', 'HEAD'), index = join(root, 'private-index');
    execFileSync('git', ['read-tree', head], { cwd: root, env: { ...process.env, GIT_INDEX_FILE: index } });
    const originalIndex = readFileSync(index);
    mkdirSync(join(root, 'scripts'));
    mkdirSync(join(root, 'bin'));
    const mktemp = execFileSync('which', ['mktemp'], { encoding: 'utf8' }).trim();
    // GNU refuses BSD's suffix-free -t form; require a portable explicit template.
    writeFileSync(join(root, 'bin/mktemp'), `#!/usr/bin/env bash
if [ "$#" != 1 ] || [[ "$1" != */auto-push.XXXXXX ]]; then
  echo 'mktemp requires an explicit portable template' >&2
  exit 1
fi
exec '${mktemp}' "$@"
`, { mode: 0o755 });
    writeFileSync(join(root, 'scripts/auto-push.sh'), readFileSync('scripts/auto-push.sh'));
    writeFileSync(join(root, 'scripts/push-main.sh'), `set -e
trap 'echo "vercel-gate: FAILED fixture Git isolation" >&2' ERR
mkdir child
git -C child init -q
git -C child config core.hooksPath /dev/null
git -C child config user.name Fixture
git -C child config user.email fixture@example.invalid
printf 'child-owned bytes' > child/value.txt
git -C child add value.txt
git -C child commit -qm child
git push -q origin main
`);
    writeFileSync(join(root, '.git/auto-push.pending'), '');
    // A refused fixture must never message a real lane.
    writeFileSync(join(root, '.git/auto-push.pinged'), `origin ${delivered}\nwildshard-new\n`);
    const injected = context === 'index' ? { GIT_INDEX_FILE: index }
      : { GIT_DIR: join(root, '.git'), GIT_WORK_TREE: root };
    const run = spawnSync('bash', ['scripts/auto-push.sh', '--locked'], {
      cwd: root, encoding: 'utf8', timeout: 10_000,
      env: { ...process.env, ...injected, CI: '', WS_AUTO_PUSH: '1', AUTO_PUSH_SETTLE: '0',
        AUTO_PUSH_SNAP: '', PATH: `${join(root, 'bin')}:${process.env['PATH'] ?? ''}` },
    });
    expect(run.error).toBeUndefined(); expect(run.status, run.stdout + run.stderr).toBe(0);
    const logs = readdirSync(join(root, '.git/auto-push')).map(file => readFileSync(join(root, '.git/auto-push', file), 'utf8')).join('\n');
    expect(existsSync(join(root, '.git/auto-push.red')), logs).toBe(false);
    expect(git('rev-parse', 'origin/main')).toBe(head);
    expect(git('-C', 'child', 'ls-tree', '--name-only', 'HEAD')).toBe('value.txt');
    expect(readFileSync(index).equals(originalIndex)).toBe(true);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
