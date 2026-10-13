import { expect, it } from 'vitest';
import { BUDGETS, SKY_REACH_RUNTIME_COST } from '../src/shards/far-reach/data/budgets';
import { BUDGET_CEILINGS } from '../src/shards/far-reach/data/budgetCeilings';
import manifest from '../src/shards/far-reach/manifest';
import { SKY_DISCOVERY } from '../src/shards/far-reach/data/discovery';

it('keeps discovery and play declarations serializable and bound to their authored rows', () => {
  // oxlint-disable-next-line unicorn/prefer-structured-clone -- JSON admission is the row contract.
  expect(JSON.parse(JSON.stringify(SKY_DISCOVERY))).toStrictEqual(SKY_DISCOVERY);
  for (const [key, value] of Object.entries(SKY_DISCOVERY)) {
    expect(Reflect.get(manifest, key), key).toStrictEqual(value);
  }
  expect(Object.keys(SKY_DISCOVERY)).toHaveLength(32);
});

it('keeps both shipping budget tiers equal to the original authored formula', () => {
  const tier = (fps: number) => ({ fps, variability: 1.3, cpuMs: fps === 30 ? 9.6 : 4.8, gcMs: 0.3,
    systems: { physics: 0.3, ai: 0.3, animation: 0.3, player: 0.2, world: 0.2, hud: 0.1, audio: 0.1 },
    vertexShare: 0.5, lanes: { opaque: 0.4, shadow: 0.2, transparent: 0.1, viewmodel: 0.1, post: 0.1, reserve: 0.1 }, linkMs: 1000 });
  expect(BUDGETS).toStrictEqual({ ceilings: BUDGET_CEILINGS, phone: tier(30), desktop: tier(60),
    load: { coldPlay4G: null, fixedSeconds: 0, cpuRatio: 2, bytesPerSecond: 1125000 } });
  expect(manifest.budgets).toBe(BUDGETS);
  expect(manifest.runtimeCost).toBe(SKY_REACH_RUNTIME_COST);
});

it('publishes finite serializable budgets and preserves the measured claims', () => {
  // oxlint-disable-next-line unicorn/prefer-structured-clone -- JSON rows are the persisted authoring contract.
  expect(JSON.parse(JSON.stringify({ BUDGETS, SKY_REACH_RUNTIME_COST }))).toStrictEqual({ BUDGETS, SKY_REACH_RUNTIME_COST });
  expect(SKY_REACH_RUNTIME_COST).toMatchObject({ webContentMB: 641.55256, glMB: 180.34796,
    residentBaseMB: 660.691638, imagesFirst: { webContentMB: 270.994576, glMB: 267.71368 } });
});
