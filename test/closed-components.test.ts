import { expect, test } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Tiny isolated source trees exercise the actual guard.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Fixture paths only.
import { dirname, join } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Small disposable fixtures.
import { tmpdir } from 'node:os';
import { closedComponents, closedComponentSources, closedComponentFailures, compareClosedComponents } from '../scripts/check-closed-components.mjs';
import { componentInventory } from '../scripts/shard-components.mjs';

test('a line in each closed component fails; other components remain available', () => {
  const root = mkdtempSync(join(tmpdir(), 'closed-components-'));
  const policy = { 'pine-hollow': ['C3', 'C7', 'C8'] };
  const put = (path: string, source: string): void => { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), source); };
  try {
    put('src/shards/pine-hollow/runtime/index.ts', 'export const worldBuild = 1;\n');
    expect(closedComponentSources(root, policy)).toEqual([]);
    for (const [id, name] of [['C3', 'windFx'], ['C7', 'mover'], ['C8', 'audio']]) {
      const path = `src/shards/pine-hollow/runtime/${name}.ts`;
      put(path, `export const ${name} = 1;\n`);
      expect(closedComponentSources(root, policy)).toEqual([expect.stringContaining(`CLOSED ${id}`)]);
      rmSync(join(root, path));
    }
    put('src/shards/pine-hollow/runtime/weapons/item.ts', 'export const weapon = 1;\n');
    expect(closedComponentSources(root, policy)).toEqual([]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('sole-user platform contributions also fail the full inventory guard', () => {
  const components = componentInventory('', 'pine-hollow', [{ path: 'src/game/audio/private.ts', kind: 'sole-export', name: 'audioCue', lines: 1 }], 1);
  expect(closedComponentFailures({ 'pine-hollow': { components } }, { 'pine-hollow': ['C8'] })).toEqual([
    'pine-hollow: CLOSED C8 Audio has 1 custom lines',
  ]);
  expect(closedComponentFailures({}, { 'pine-hollow': ['C8'] })).toEqual(['pine-hollow: closed component inventory missing']);
});

test('locks cannot be removed or changed into adjustable budgets', () => {
  const before = { 'pine-hollow': ['C8'] };
  expect(compareClosedComponents(before, { 'pine-hollow': ['C8', 'C3'] })).toEqual([]);
  expect(compareClosedComponents(before, {})).toEqual(['pine-hollow: closed component C8 lock removed']);
  expect(() => closedComponents({ 'pine-hollow': { C8: 1 } })).toThrow('Invalid closedComponents');
  expect(() => closedComponents({ 'pine-hollow': ['C8', 'C8'] })).toThrow('Invalid closedComponents');
});

test('closing counts shrink, require the lock to follow cuts, and close at zero', () => {
  const policy = { 'nalati-grasslands': { C7: 93 } };
  const row = (lines: number) => ({ 'nalati-grasslands': { components: componentInventory('', 'nalati-grasslands',
    [{ path: 'src/game/riding/mountedFigure.ts', kind: 'sole-module', lines }], lines) } });
  expect(closedComponentFailures(row(93), {}, policy)).toEqual([]);
  expect(closedComponentFailures(row(94), {}, policy)).toEqual([expect.stringContaining('SHRINK-ONLY C7')]);
  expect(closedComponentFailures(row(92), {}, policy)).toEqual([expect.stringContaining('lower shrink-only C7 lock')]);
  expect(closedComponentFailures(row(0), {}, { 'nalati-grasslands': { C7: 0 } })).toEqual([]);
  expect(compareClosedComponents({}, {}, policy, { 'nalati-grasslands': { C7: 92 } })).toEqual([]);
  expect(compareClosedComponents({}, {}, policy, { 'nalati-grasslands': { C7: 94 } })).toEqual([expect.stringContaining('raised or removed')]);
});
