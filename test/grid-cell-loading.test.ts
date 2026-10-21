import { expect, test } from 'vitest';
import { cellLoadingStep, type CellLoadingInput } from '../src/game/grid/cellLoading';
import { loadingPath } from '../src/game/boot/loadingPaths';

const base: CellLoadingInput = { instance: 'pine-hollow', slug: 'pine-hollow', name: 'Pine Hollow', refusal: null, product: false,
  claimedMB: 0, requested: true, runtime: false, colliders: false, sim: false, hooks: new Set(), hook: null, hybrid: true,
  entered: false, gameplayReady: false };
const key = (input: Partial<CellLoadingInput>): string => { const step = cellLoadingStep({ ...base, ...input }); return step.kind === 'step' ? step.key : step.kind; };

test('G555: a cell entry walks the cell path step by step, on its live admission', () => {
  const steps = loadingPath('cell').steps.map(row => row.key);
  expect(steps).toEqual(['admission', 'world', 'loadout', 'gameplay', 'colliders', 'warm', 'enter']);
  expect(key({})).toBe('admission');
  expect(key({ product: true, hook: 'world' })).toBe('world');
  expect(key({ product: true, hooks: new Set(['afterWorld']) })).toBe('loadout');
  expect(key({ product: true, hooks: new Set(['afterWorld', 'afterKit']) })).toBe('gameplay');
  const hooked = new Set(['afterWorld', 'afterKit', 'afterPlay']);
  expect(key({ product: true, hooks: hooked, runtime: true })).toBe('colliders');
  expect(key({ product: true, hooks: hooked, runtime: true, colliders: true, sim: true })).toBe('warm');
  expect(key({ product: true, hooks: hooked, runtime: true, colliders: true, sim: true, entered: true, hook: 'activate' })).toBe('enter');
  expect(key({ product: true, hooks: hooked, runtime: true, colliders: true, sim: true, entered: true, gameplayReady: true })).toBe('done');
  // a bodyless declared region has no hooks: its world, equipment and gameplay rows pass on its runtime fence
  expect(key({ product: true, hybrid: false, runtime: true })).toBe('colliders');
});

test('G555: a refused cell shows why on the same screen, never a short-form card', () => {
  const step = cellLoadingStep({ ...base, refusal: 'Too big for this device' });
  expect(step).toEqual({ kind: 'failed', reason: 'Too big for this device' });
});
