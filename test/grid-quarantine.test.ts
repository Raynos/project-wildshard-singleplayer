// oxlint-disable-next-line import/no-nodejs-modules -- Pin the original case and workflow at its quarantine boundary.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { gridQuarantine, quarantinedGrid } from '../scripts/parity/grid-quarantine.mjs';

test('only the retained grid case reports for exactly 24 hours', () => {
  const start = Date.parse(gridQuarantine.openedAt), end = Date.parse(gridQuarantine.expiresAt);
  expect(gridQuarantine.owner).toBe('sp-x8');
  expect(gridQuarantine.failure).toBe('40371580877');
  expect(gridQuarantine.sha).toBe('2b11287c5fb143b960b15cf3e37fe17be1ead3c3');
  expect(end - start).toBe(24 * 60 * 60 * 1000);
  expect(quarantinedGrid('grid', start - 1)).toBe(false);
  expect(quarantinedGrid('grid', start)).toBe(true);
  expect(quarantinedGrid('grid', end - 1)).toBe(true);
  expect(quarantinedGrid('grid', end)).toBe(false);
  for (const mode of ['standalone', 'public-policy']) expect(quarantinedGrid(mode, start)).toBe(false);
  expect(() => quarantinedGrid('grid', Number.NaN)).toThrow();
});

test('the reporting leg runs the complete original grid case without changing its clocks or assertions', () => {
  const workflow = readFileSync('.github/workflows/boot-smoke.yml', 'utf8');
  const source = readFileSync('scripts/parity/boot-smoke.mjs', 'utf8');
  const reporting = workflow.split('\n').find(line => line.includes('continue-on-error:'));
  expect(reporting).toContain("matrix.part == 'grid-quarantine'");
  for (const part of ['boot-public', 'boot-developer', 'boot-grid', 'hover-chromium', 'hover-webkit', 'explorer']) expect(reporting).not.toContain(`'${part}'`);
  expect(workflow).toContain("matrix.part == 'grid-quarantine' && 'boot-grid'");
  expect(workflow).toContain('run: node scripts/parity/boot-smoke.mjs --case-group=grid-quarantine');
  expect(source).toContain("group === 'grid-quarantine' ? 'grid' : group");
  expect(source).toContain("group === 'title-quarantine', group === 'grid-quarantine'");
  expect(source).toContain('if (!gridReporting && quarantinedGrid(mode))');
  expect(source).toContain('deadline = Date.now() + 150000;');
  expect(source).toContain("'grid preparation', deadline, observeGridWait");
  expect(source).toContain("await captureBootFrame(page, mode === 'grid' ? 'grid HOME'");
  expect(source).toContain('await bootTemplateRoad(page, faults, frames, roadDeadline)');
  expect(source).toContain('await bootSignalRoad(page, faults, frames, roadDeadline)');
  expect(source).toContain('elapsedMs: Date.now() - started');
});
