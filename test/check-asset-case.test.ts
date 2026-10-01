// oxlint-disable-next-line import/no-nodejs-modules -- CLI fixture tests execute Node commands.
import { execFileSync, spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- CLI fixtures resolve paths on the test host.
import { join } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- CLI fixture uses this Node executable.
import process from 'node:process';
import { describe, expect, it } from 'vitest';
import { checkAssetCase } from '../scripts/check-asset-case.mjs';

const fixture = join(import.meta.dirname, 'fixtures/asset-case/dist');
describe('asset URL spelling', () => {
  it('finds wrong directory case on Mac too, preserves provenance and strips cache suffixes', () => {
    expect(checkAssetCase(fixture)).toEqual({ checked: 5, missing: [
      { url: '/assets/Music/theme.mp3', from: 'assets/bundle.js', closest: '/assets/music/theme.mp3' },
      { url: '/assets/music/absent.mp3', from: 'assets/bundle.js', closest: null },
    ] });
  });
  it('fails the command rather than silently ignoring wrong case', () => {
    const result = spawnSync(process.execPath, ['scripts/check-asset-case.mjs', fixture], { encoding: 'utf8' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('wrong case; disk: /assets/music/theme.mp3');
  });
  it('reports a usage error for a missing build', () => {
    expect(() => execFileSync(process.execPath, ['scripts/check-asset-case.mjs', join(fixture, 'no-build')], { stdio: 'pipe' })).toThrow();
  });
  it('expands declared template values, rejects wrong fixed case and decodes string escapes', () => {
    expect(checkAssetCase(join(import.meta.dirname, 'fixtures/asset-case/templates')).missing).toEqual([
      { url: '/assets/packs/demo.desktop.bin', from: 'assets/bundle.js', closest: null },
      { url: '/assets/Music/theme.mp3', from: 'assets/bundle.js', closest: '/assets/music/theme.mp3' },
    ]);
  });
});
