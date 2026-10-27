// oxlint-disable-next-line import/no-nodejs-modules -- Pin the original case and workflow at its quarantine boundary.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

test('D13 returns the repaired full grid case to the blocking leg before quarantine expiry', () => {
  const workflow = readFileSync('.github/workflows/boot-smoke.yml', 'utf8');
  const source = readFileSync('scripts/parity/boot-smoke.mjs', 'utf8');
  const reporting = workflow.split('\n').find(line => line.includes('continue-on-error:'));
  expect(reporting).toBeDefined();
  for (const part of ['boot-public', 'boot-developer', 'boot-grid', 'hover-chromium', 'hover-webkit', 'explorer']) expect(reporting).not.toContain(`'${part}'`);
  expect(workflow).toContain("if: matrix.part == 'boot-grid'\n        run: node scripts/parity/boot-smoke.mjs --case-group=grid");
  expect(workflow).not.toContain('grid-quarantine');
  expect(source).not.toContain('quarantinedGrid');
  expect(source).not.toContain('gridReporting');
});

test('the blocking grid case keeps every original clock, pixel and road assertion', () => {
  const source = readFileSync('scripts/parity/boot-smoke.mjs', 'utf8');
  expect(source).toContain('deadline = Date.now() + 150000;');
  expect(source).toContain('deadline = Date.now() + 90000;');
  expect(source).toContain("'grid preparation', deadline, observeGridWait");
  expect(source).toContain('await until(page, faults, () => gameplay(true)');
  expect(source).toContain("'ten live gameplay frames', deadline");
  expect(source).toContain("await captureBootFrame(page, mode === 'grid' ? 'grid HOME'");
  expect(source).toContain('await bootTemplateRoad(page, faults, frames, roadDeadline)');
  expect(source).toContain('await bootSignalRoad(page, faults, frames, roadDeadline)');
  expect(source).toContain('elapsedMs: Date.now() - started');
});
