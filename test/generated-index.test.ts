// oxlint-disable-next-line import/no-nodejs-modules -- Exercise real Git indexes in owned temporary repositories.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Only fixture indexes and lock files are written.
import { closeSync, copyFileSync, existsSync, mkdtempSync, openSync, renameSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Fixture roots are disposable.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve fixture-local Git state.
import { join } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- A peer fixture update uses its own index and holder identity.
import { env, pid } from 'node:process';
import { expect, it } from 'vitest';
import { alignGeneratedIndex } from '../scripts/generated-index.mjs';

async function fixture(run: (root: string, git: (args: string[]) => string, before: string, after: string, foreign: string) => Promise<void>): Promise<void> {
  const root = mkdtempSync(join(tmpdir(), 'generated-index-fixture-'));
  const git = (args: string[]): string => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  try {
    git(['init', '-q', '-b', 'main']); git(['config', 'core.hooksPath', '/dev/null']);
    git(['config', 'user.name', 'Fixture']); git(['config', 'user.email', 'fixture@example.invalid']);
    for (const file of ['aligned.json', 'foreign.json', 'peer.ts']) writeFileSync(join(root, file), 'old');
    git(['add', '--', 'aligned.json', 'foreign.json', 'peer.ts']); git(['commit', '-qm', 'fixture baseline']);
    const blob = (value: string): string => execFileSync('git', ['hash-object', '-w', '--stdin'], { cwd: root, input: value, encoding: 'utf8' }).trim();
    await run(root, git, blob('old'), blob('generated'), blob('foreign'));
  } finally { rmSync(root, { recursive: true, force: true }); }
}

it('waits beyond two seconds, then atomically preserves peer edits and unrelated staged entries', async () => {
  await fixture(async (root, git, before, after, foreign) => {
    const lock = join(root, '.git/index.lock'), descriptor = openSync(lock, 'wx');
    writeFileSync(join(root, '.git/commit-message-holder.json'), JSON.stringify({ pid, lane: 'fixture-peer' }));
    const timer = setTimeout(() => {
      const peerIndex = join(root, '.git/peer-index'); copyFileSync(join(root, '.git/index'), peerIndex);
      for (const file of ['foreign.json', 'fresh.json', 'peer.ts']) execFileSync('git', ['update-index', '--add', '--cacheinfo', '100644', foreign, file], { cwd: root, env: { ...env, GIT_INDEX_FILE: peerIndex } });
      renameSync(peerIndex, join(root, '.git/index')); closeSync(descriptor); rmSync(lock);
    }, 2600);
    try {
      const started = performance.now();
      expect(await alignGeneratedIndex(root, [
        { file: 'aligned.json', before, after }, { file: 'foreign.json', before, after }, { file: 'fresh.json', before: null, after },
      ])).toEqual(['aligned.json']);
      expect(performance.now() - started).toBeGreaterThanOrEqual(2500);
      expect(git(['rev-parse', ':aligned.json'])).toBe(after);
      for (const file of ['foreign.json', 'fresh.json', 'peer.ts']) expect(git(['rev-parse', `:${file}`])).toBe(foreign);
      expect(existsSync(lock)).toBe(false);
    } finally { clearTimeout(timer); if (existsSync(lock)) { closeSync(descriptor); rmSync(lock); } }
  });
}, 10_000);

it('times out clearly while preserving the peer lock and complete shared index', async () => {
  await fixture(async (root, git, before, after) => {
    const lock = join(root, '.git/index.lock'), descriptor = openSync(lock, 'wx');
    const initial = git(['ls-files', '--stage']);
    try {
      await expect(alignGeneratedIndex(root, [{ file: 'aligned.json', before, after }], 100)).rejects.toThrow('Generated index wait expired');
      expect(existsSync(lock)).toBe(true);
      expect(git(['ls-files', '--stage'])).toBe(initial);
    } finally { closeSync(descriptor); rmSync(lock); }
  });
});

it('discards incomplete private updates without replacing the shared index', async () => {
  await fixture(async (root, git, before, after) => {
    const initial = git(['ls-files', '--stage']);
    await expect(alignGeneratedIndex(root, [
      { file: 'aligned.json', before, after }, { file: 'fresh.json', before: null, after: 'invalid-object-id' },
    ])).rejects.toThrow();
    expect(git(['ls-files', '--stage'])).toBe(initial);
    expect(existsSync(join(root, '.git/index.lock'))).toBe(false);
  });
});
