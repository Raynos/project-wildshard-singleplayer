import { expect, it } from 'vitest';
import { ResidencyAllocator } from '../src/game/grid/allocator';
import { MemoryAdmission } from '../src/game/grid/memoryAdmission';
import { regionalRuntimeAccountedBytes } from '../src/game/grid/regionalRuntime';
import { CONTENT_CAPS } from '../src/engine/core/config';
import { runtimeAccountedBytes } from '../src/game/grid/runtimeCost';
import { SKY_REACH } from '../src/shards/far-reach/manifest';
import skySource from '../src/shards/far-reach/shard.config';
import { SKY_REACH_RUNTIME_COST } from '../src/shards/far-reach/data/runtimeCost';
import { NINE_DRAGON_STACK } from '../src/shards/nine-dragon-stack/manifest';
import nineSource from '../src/shards/nine-dragon-stack/shard.config';
import { NINE_DRAGON_RUNTIME_COST } from '../src/shards/nine-dragon-stack/data/runtimeCost';

it.each([
  { manifest: SKY_REACH, source: skySource, measured: SKY_REACH_RUNTIME_COST, bytes: 215_953_384 },
  { manifest: NINE_DRAGON_STACK, source: nineSource, measured: NINE_DRAGON_RUNTIME_COST, bytes: 340_966_245 },
])('admits $manifest.slug from matching reviewed full-runtime measurements rather than its empty data budget', ({ manifest, source, measured, bytes }) => {
  expect(manifest.runtimeCost).toBe(measured);
  expect(source.runtime?.cost).toEqual(measured);
  expect(regionalRuntimeAccountedBytes({ source }, manifest)).toBe(bytes);
  expect(runtimeAccountedBytes(measured)).toBe(bytes);
  expect(bytes).toBeGreaterThan(source.budgets.sim.resident);
  const allocator = new ResidencyAllocator({ memory: new MemoryAdmission() });
  const lease = allocator.reserve({ id: `sim:${manifest.slug}`, category: 'sim', owner: manifest.slug, bytes, distance: 0, needed: true });
  expect(lease).not.toBeNull();
  expect(allocator.cost().playing).toBeLessThan(CONTENT_CAPS.playing);
  lease?.release(); expect(allocator.entries()).toEqual([]);
});
