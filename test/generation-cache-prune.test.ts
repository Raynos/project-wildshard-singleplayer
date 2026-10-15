// oxlint-disable-next-line import/no-nodejs-modules -- Builds a throwaway cache directory to prune.
import { existsSync, mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- The fixture cache lives in the temp dir.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Paths inside the fixture cache.
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { pruneGenerationCache } from '../scripts/generation-cache.mjs';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

/** A fake cache entry of `kib` KiB last used `hoursAgo` hours ago. */
function entry(root: string, job: string, n: number, hoursAgo: number, kib = 4): string {
  const key = n.toString(16).padStart(64, '0'), dir = join(root, job, key);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'out.bin'), new Uint8Array(kib * 1024).fill(1));
  const at = new Date(Date.now() - hoursAgo * 3_600_000);
  utimesSync(dir, at, at);
  return dir;
}
function freshCache(): string { const root = mkdtempSync(join(tmpdir(), 'generation-prune-')); roots.push(root); return root; }

describe('generation cache prune (G430)', () => {
  it('keeps the newest three per job and spares locked, protected and staging dirs', () => {
    const root = freshCache();
    const dirs = [0, 1, 2, 3, 4, 5].map(n => entry(root, 'job-a', n + 1, n));
    mkdirSync(`${dirs[4]}.lock`);
    mkdirSync(join(root, 'job-a', 'generating-abc123'));
    const protectedDir = dirs[5];
    if (protectedDir === undefined) throw new Error('fixture');
    const dry = pruneGenerationCache(root, { protect: [protectedDir], dryRun: true });
    expect(dry.deleted.map(row => row.reason)).toEqual(['keep']);
    expect(dirs.every(dir => existsSync(dir))).toBe(true);
    const report = pruneGenerationCache(root, { protect: [protectedDir] });
    expect(report.deleted).toHaveLength(1);
    expect(dirs.map(dir => existsSync(dir))).toEqual([true, true, true, false, true, true]);
    expect(existsSync(join(root, 'job-a', 'generating-abc123'))).toBe(true);
  });

  it('caps the cache least recently used first but keeps each job newest entry', () => {
    const root = freshCache();
    const a = [entry(root, 'job-a', 1, 1, 64), entry(root, 'job-a', 2, 5, 64)];
    const b = [entry(root, 'job-b', 3, 2, 64), entry(root, 'job-b', 4, 9, 64)];
    const report = pruneGenerationCache(root, { capBytes: 150 * 1024 });
    expect(report.deleted.every(row => row.reason === 'cap')).toBe(true);
    expect([...a, ...b].map(dir => existsSync(dir))).toEqual([true, false, true, false]);
    expect(report.keptEntries).toBe(2);
  });
});
