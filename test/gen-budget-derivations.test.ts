// oxlint-disable-next-line import/no-nodejs-modules -- CLI integration tests run the real generator in isolated fixtures.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Generator fixtures own their temporary filesystem.
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Fixture roots stay outside the shared checkout.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve fixture files and the generator entry point.
import { join, resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Use the Node executable for CLI fixtures.
import process from 'node:process';
import { describe, expect, it } from 'vitest';
import calibration from '../budgets/calibration.json';
import calibrationText from '../budgets/calibration.json?raw';

describe('budget derivation generator', () => {
  it('refreshes one slug, detects stale committed output and preserves measured provenance and other WIP', () => {
    const root = mkdtempSync(join(tmpdir(), 'gen-derived-'));
    const run = (...args: string[]): string => execFileSync(process.execPath, [resolve('scripts/gen-budget-derivations.mjs'), `--root=${root}`, ...args], { encoding: 'utf8', stdio: 'pipe' });
    const file = join(root, 'budgets/ceiling-sources.json');
    try {
      mkdirSync(join(root, 'budgets'));
      writeFileSync(join(root, 'budgets/calibration.json'), calibrationText);
      for (const slug of ['mine', 'other']) {
        mkdirSync(join(root, 'src/shards', slug), { recursive: true });
        writeFileSync(join(root, 'src/shards', slug, 'manifest.ts'), 'export default { budgets: {} };');
      }
      mkdirSync(join(root, 'src/shards/mine-legacy'));
      writeFileSync(join(root, 'src/shards/mine-legacy/manifest.ts'), 'frozen copy is not a new measured budget');
      mkdirSync(join(root, 'lint'));
      writeFileSync(join(root, 'lint/legacy-shards.json'), JSON.stringify({ version: 1, sealed: true, shards: { 'mine-legacy': { primary: 'mine', source: 'a'.repeat(40), files: { 'manifest.ts': 'b'.repeat(64), 'plugin.ts': 'c'.repeat(64) } } } }));
      const measured = { reRecords: [{ approval: 'lead', gpuMB: 7 }], baselines: ['captured'], source: 'measured' };
      writeFileSync(file, `${JSON.stringify({ ...measured, derived: {} })}\n`);
      run();
      const fresh = readFileSync(file, 'utf8');
      expect(JSON.parse(fresh) as unknown).toMatchObject({ ...measured, calibration: calibration.measuredAt, derived: { mine: { phone: null, desktop: null }, other: { phone: null, desktop: null } } });
      expect(Object.keys((JSON.parse(fresh) as { derived: Record<string, unknown> }).derived)).toEqual(['mine', 'other']);
      run('--check');
      writeFileSync(join(root, 'src/shards/other/manifest.ts'), 'unfinished other shard WIP');
      const stale = fresh.replace('"mine": {', '"mine": { "stale": true,');
      writeFileSync(file, stale);
      expect(() => run('--check', '--shard=mine')).toThrow('stale budgets/ceiling-sources.json');
      expect(readFileSync(file, 'utf8')).toBe(stale);
      run('--shard=mine');
      expect(readFileSync(file, 'utf8')).toBe(fresh);
      run('--check', '--shard=mine');
      expect(() => run('--shard=missing')).toThrow('unknown shard');
      expect(() => run('--shard=../mine')).toThrow('unknown shard');
      writeFileSync(file, fresh.replace(calibration.measuredAt, 'different-calibration'));
      expect(() => run('--shard=mine')).toThrow('calibration changed');
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});
