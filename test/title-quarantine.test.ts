// oxlint-disable-next-line import/no-nodejs-modules -- Pin the real workflow's narrow quarantine and exact artifact reuse.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { quarantinedTitle, titleQuarantine } from '../scripts/parity/title-quarantine.mjs';

test('only both original Nine title captures are quarantined for exactly 24 hours', () => {
  const start = Date.parse(titleQuarantine.openedAt), end = Date.parse(titleQuarantine.expiresAt);
  expect(titleQuarantine.owner).toBe('sp-x1');
  expect(titleQuarantine.failures).toEqual(['40346975383', '40355584392']);
  expect(end - start).toBe(24 * 60 * 60 * 1000);
  for (const mode of ['standalone', 'public-policy']) {
    expect(quarantinedTitle('nine-dragon-stack', mode, start - 1)).toBe(false);
    expect(quarantinedTitle('nine-dragon-stack', mode, start)).toBe(true);
    expect(quarantinedTitle('nine-dragon-stack', mode, end - 1)).toBe(true);
    expect(quarantinedTitle('nine-dragon-stack', mode, end)).toBe(false);
  }
  expect(quarantinedTitle('nine-dragon-stack', 'grid', start)).toBe(false);
  expect(quarantinedTitle('driftwood-isle', 'standalone', start)).toBe(false);
  expect(() => quarantinedTitle('nine-dragon-stack', 'standalone', Number.NaN)).toThrow();
});

test('the reporting leg reuses the exact Developer artifact while gameplay legs still block', () => {
  const source = readFileSync('.github/workflows/boot-smoke.yml', 'utf8');
  const job = source.split('\n  boot-smoke:\n')[1]?.split('\n  verdict:\n')[0];
  if (job === undefined) throw new Error('Missing smoke job');
  const reporting = job.split('\n').find(line => line.includes('continue-on-error:'));
  expect(reporting).toContain("matrix.part == 'title-quarantine'");
  for (const part of ['boot-public', 'boot-developer', 'boot-grid', 'hover-chromium', 'hover-webkit', 'explorer']) expect(reporting).not.toContain(`'${part}'`);
  expect(job.split('\n').find(line => line.includes('SMOKE_PART:'))).toContain("matrix.part == 'title-quarantine' && 'boot-developer' || matrix.part");
  expect(job.split('\n').find(line => line.includes('name: boot-dist-') && line.includes('matrix.part'))).toContain("matrix.part == 'title-quarantine' && 'boot-developer'");
  for (const group of ['public', 'developer', 'grid']) expect(job).toContain(`run: node scripts/parity/boot-smoke.mjs --case-group=${group}`);
  expect(job).toContain('run: node scripts/parity/boot-smoke.mjs --case-group=title-quarantine');
  expect(job).toContain('if: always()');
  expect(job.split('\n').find(line => line.includes('name: boot-smoke-'))).toContain('matrix.part');
});
