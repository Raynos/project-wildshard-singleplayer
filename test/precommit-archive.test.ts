// oxlint-disable-next-line import/no-nodejs-modules -- The test creates an actual isolated Git tree and extracts its archive.
import { spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- All filesystem writes belong to the temporary fixture.
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Keep the fixture outside the shared working tree.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Exercise archive paths containing spaces.
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { extractGuardArchive } from '../scripts/precommit-guards.mjs';

it('extracts selected immutable tree bytes, including large files, without reading later index or working edits', () => {
  const owned = mkdtempSync(join(tmpdir(), 'guard archive fixture '));
  const root = join(owned, 'source'), destination = join(owned, 'destination');
  mkdirSync(root); mkdirSync(destination);
  const git = (...args: string[]): string => {
    const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    if (result.status !== 0) throw new Error(result.stderr);
    return result.stdout.trim();
  };
  try {
    git('init', '-q'); git('config', 'user.name', 'Fixture'); git('config', 'user.email', 'fixture@example.com');
    const payload = 'immutable archive bytes\n'.repeat(150_000);
    writeFileSync(join(root, 'selected.txt'), payload);
    writeFileSync(join(root, 'unselected.txt'), 'not in the guard snapshot');
    git('add', '--', 'selected.txt', 'unselected.txt');
    const tree = git('write-tree');
    writeFileSync(join(root, 'selected.txt'), 'later staged value'); git('add', '--', 'selected.txt');
    writeFileSync(join(root, 'selected.txt'), 'invalid working value');
    extractGuardArchive(root, tree, ['selected.txt'], destination);
    expect(readFileSync(join(destination, 'selected.txt'), 'utf8')).toBe(payload);
    expect(readdirSync(destination)).toEqual(['selected.txt']);
    expect(() => extractGuardArchive(root, 'missing-tree', ['selected.txt'], destination)).toThrow('git failed');
    expect(readFileSync(join(destination, 'selected.txt'), 'utf8')).toBe(payload);
  } finally { rmSync(owned, { recursive: true, force: true }); }
});
