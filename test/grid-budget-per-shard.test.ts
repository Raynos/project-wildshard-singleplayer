import { expect, test } from 'vitest';
import { CONTENT_CAPS } from '../src/engine/core/config';
import { contentCost, type ContentCostInput } from '../src/format/contentCost';
import { ResidencyAllocator, type ResidencyEntry } from '../src/game/grid/allocator';
import { MemoryAdmission } from '../src/format/product';
import { budgetPoints, shardLimit } from '../src/game/grid/budgetPoints';
import { shardTone } from '../src/game/grid/budgetOverlay';

const entry = (owner: string, bytes: number): ResidencyEntry =>
  ({ id: `sim:${owner}`, category: 'sim', bytes, owner, distance: 0, needed: true, refs: 1, holds: 0, accountedBytes: bytes });

test('G556: each shard is scored against its own limit; the page total has no cap', () => {
  const entries = [entry('a', 400_000_000), entry('b', 400_000_000), entry('heavy', 900_000_000)];
  const input: ContentCostInput = { l0: 0, l1: 0, far: 0, libraries: 0, sims: 1_700_000_000, commons: 0, overlap: CONTENT_CAPS.overlap };
  const points = budgetPoints({ entries, cost: { ...contentCost(input), input } });
  expect(points.crossroads.playing).toBeGreaterThan(CONTENT_CAPS.playing);
  expect(Object.keys(points.crossroads)).not.toContain('tone');
  const byOwner = new Map(points.shards.map(shard => [shard.owner, shard]));
  const light = byOwner.get('a'), heavy = byOwner.get('heavy');
  expect(light?.limit).toEqual(shardLimit(400_000_000, input));
  expect(light?.limit?.tone).toBe('green');
  // over its category budget, under its own limit: amber, never red
  expect(light?.tone).toBe('red');
  expect(light === undefined ? null : shardTone(light)).toBe('amber');
  expect(heavy?.limit?.playing).toBeGreaterThan(CONTENT_CAPS.playing);
  expect(heavy === undefined ? null : shardTone(heavy)).toBe('red');
});

test('G556: enforce mode refuses a claim only when its owner alone is over the limit, never on the page total', () => {
  const allocator = new ResidencyAllocator({ playing: CONTENT_CAPS.engineBase + CONTENT_CAPS.overlap + 1000, memory: new MemoryAdmission(() => false) });
  const claim = (id: string, owner: string) => ({ id, owner, category: 'sim' as const, bytes: 600, distance: 0, needed: true });
  expect(allocator.reserve(claim('a1', 'a'))).not.toBeNull();
  expect(allocator.reserve(claim('b1', 'b'))).not.toBeNull();
  expect(allocator.cost().playing).toBeGreaterThan(CONTENT_CAPS.engineBase + CONTENT_CAPS.overlap + 1000);
  expect(allocator.reserve(claim('a2', 'a'))).toBeNull();
  expect(allocator.memory.reports()).toEqual([]);
});
