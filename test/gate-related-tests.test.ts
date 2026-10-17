import { expect, it } from 'vitest';
import { capRelated, productReaderTests, scriptScenarioTests } from '../scripts/gate-related-tests.mjs';

const durations = new Map([['test/slow.test.ts', 40], ['test/cheap.test.ts', 1], ['test/mid.test.ts', 8], ['test/cover-grid.test.ts', 30]]);
const related = [...durations.keys()];

it('runs every related test file when the estimate fits the budget', () => {
  expect(capRelated(related, ['src/x.ts'], durations, 45, 4)).toEqual({ run: [...related].sort(), left: [] });
});

it('runs the files named after a changed source first, then the cheapest, and leaves the rest to CI', () => {
  // Budget (45 - 5) × 2 = 80 test seconds; each file adds 0.5 s of module load.
  expect(capRelated(related, ['src/world/coverGrid.ts'], durations, 45, 2))
    .toEqual({ run: ['test/cheap.test.ts', 'test/cover-grid.test.ts', 'test/mid.test.ts'], left: ['test/slow.test.ts'] });
});

it('always runs a changed test file, even one the import walk did not return', () => {
  expect(capRelated([], ['test/new.test.ts', 'src/a.ts'], durations, 45, 4)).toEqual({ run: ['test/new.test.ts'], left: [] });
});

const scenarios = ['test/scripts/far-reach-roc.test.ts', 'test/scripts/far-reach-gust.test.ts', 'test/scripts/sunscar-dunes-matriarch.test.ts'];

it('maps changed and removed Wasm author sources without an import edge', () => {
  expect(scriptScenarioTests(['src/shards/far-reach/behaviour/roc.as'], scenarios)).toEqual([scenarios[0]]);
  expect(scriptScenarioTests(['src/shards/sunscar-dunes/behaviour/matriarch.as'], scenarios)).toEqual([scenarios[2]]);
});

it('selects shard scenarios for composed script rows and build bindings', () => {
  for (const file of ['data/scripts.ts', 'data/encounters.ts', 'generators/product.ts', 'shard.config.ts', 'behaviour/generated/roc.ts']) {
    expect(scriptScenarioTests([`src/shards/far-reach/${file}`], scenarios)).toEqual([scenarios[1], scenarios[0]]);
  }
  expect(scriptScenarioTests(['src/shards/far-reach/runtime/index.ts', 'src/engine/renderer.ts'], scenarios)).toEqual([]);
});

it('keeps required scenarios once even when the related-test budget is exhausted', () => {
  const scenario = 'test/scripts/far-reach-roc.test.ts';
  expect(capRelated([scenario, 'test/slow.test.ts'], [], new Map([[scenario, 3]]), 0, 1, [scenario, scenario]))
    .toEqual({ run: [scenario], left: ['test/slow.test.ts'] });
});

it('preserves author-source edges for tests consuming complete disk products', () => {
  const registry = { 'test/npc.test.ts': ['pine-hollow'], 'test/scripts/captain.test.ts': ['driftwood-isle', 'pine-hollow'] };
  expect(productReaderTests(['src/shards/pine-hollow/generators/output.ts'], registry)).toEqual(Object.keys(registry));
  expect(productReaderTests(['src/shards/driftwood-isle/assets/removed'], registry)).toEqual(['test/scripts/captain.test.ts']);
  expect(productReaderTests(['src/sdk/project.ts'], registry)).toEqual(Object.keys(registry));
  expect(productReaderTests(['scripts/gate-test-products.json'], registry)).toEqual(Object.keys(registry));
  expect(productReaderTests(['src/shards/far-reach/data/rows.json', 'docs/ENGINE.md'], registry)).toEqual([]);
});
