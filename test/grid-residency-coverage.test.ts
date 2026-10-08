import { expect, it } from 'vitest';
import { ResidencyAllocator } from '../src/game/grid/allocator';
import { CONTENT_CAPS } from '../src/engine/core/config';

it('charges a retained resource exactly once while covered, then atomically on whole-runtime retirement', () => {
  const allocator = new ResidencyAllocator();
  const runtime = allocator.reserve({ id: 'sim:a', category: 'sim', owner: 'a', bytes: 100_000_000, distance: 0, needed: true });
  const before = allocator.cost();
  const cache = allocator.reserve({ id: 'cache:rig', category: 'commons', owner: 'platform', bytes: 10_000_000, distance: 0, needed: true, coveredBy: 'sim:a' });
  const shared = allocator.reserve({ id: 'cache:rig', category: 'commons', owner: 'platform', bytes: 10_000_000, distance: 0, needed: true, coveredBy: 'sim:a' });
  expect(cache).not.toBeNull(); expect(shared).not.toBeNull();
  expect(allocator.cost()).toEqual(before);
  expect(allocator.entries().find(row => row.id === 'cache:rig')).toMatchObject({ bytes: 10_000_000, accountedBytes: 0, refs: 2, coveredBy: 'sim:a' });
  runtime?.release();
  expect(allocator.cost().input.commons).toBe(10_000_000);
  expect(allocator.cost().input.sims).toBe(0);
  expect(allocator.entries().find(row => row.id === 'cache:rig')).toMatchObject({ accountedBytes: 10_000_000 });
  cache?.release(); expect(allocator.cost().input.commons).toBe(10_000_000);
  shared?.release(); expect(allocator.entries()).toEqual([]);
});

it('permits coverage only by a live measured runtime and bounds the entire covered set by its bytes', () => {
  const allocator = new ResidencyAllocator();
  const cache = { id: 'cache:a', category: 'commons' as const, owner: 'platform', bytes: 8, distance: 0, needed: true, coveredBy: 'sim:a' };
  expect(() => allocator.reserve(cache)).toThrow('coverage');
  const runtime = allocator.reserve({ id: 'sim:a', category: 'sim', owner: 'a', bytes: 10, distance: 0, needed: true });
  const first = allocator.reserve(cache);
  expect(() => allocator.reserve({ ...cache, id: 'cache:b', bytes: 3 })).toThrow('coverage');
  runtime?.release(); first?.release();
});

it('moves an already retained cache into a rebuilt runtime without nominal-byte or refcount changes', () => {
  const allocator = new ResidencyAllocator();
  const cache = allocator.reserve({ id: 'cache:a', category: 'commons', owner: 'platform', bytes: 12, distance: 0, needed: true });
  const runtime = allocator.reserve({ id: 'sim:b', category: 'sim', owner: 'b', bytes: 20, distance: 0, needed: true });
  cache?.update({ coveredBy: 'sim:b' });
  expect(allocator.cost().accounted).toBe(20);
  cache?.update({ coveredBy: null });
  expect(allocator.cost().accounted).toBe(32);
  runtime?.release(); cache?.release();
});

it('prepares eviction against the net freed cost, including caches uncovered when a victim retires', () => {
  const allocator = new ResidencyAllocator({ playing: CONTENT_CAPS.engineBase + CONTENT_CAPS.overlap + Math.ceil(100 * CONTENT_CAPS.residentFactor) });
  const log: string[] = [];
  allocator.reserve({ id: 'sim:a', category: 'sim', owner: 'a', bytes: 100, distance: 10, needed: false,
    prepareEvict: () => ({ commit: () => { log.push('commit'); }, abort: () => { log.push('abort'); } }) });
  allocator.reserve({ id: 'cache:a', category: 'commons', owner: 'platform', bytes: 40, distance: 0, needed: true, coveredBy: 'sim:a' });
  expect(allocator.reserve({ id: 'sim:b', category: 'sim', owner: 'b', bytes: 70, distance: 0, needed: true })).toBeNull();
  expect(log).toEqual(['abort']); expect(allocator.has('sim:a')).toBe(true);
  expect(allocator.reserve({ id: 'sim:c', category: 'sim', owner: 'c', bytes: 60, distance: 0, needed: true })).not.toBeNull();
  expect(log).toEqual(['abort', 'commit']); expect(allocator.cost().accounted).toBe(100);
});

it('makes a calibrated page component explicit without changing the measured engine baseline', () => {
  const allocator = new ResidencyAllocator(), before = allocator.cost();
  const page = allocator.reservePageComponent('page:composer', 13_140_576, 13_140_576);
  expect(allocator.cost().playing).toBe(before.playing);
  expect(allocator.cost().input.engineBase).toBe(CONTENT_CAPS.engineBase - 13_140_576);
  expect(allocator.cost().input.page).toBe(13_140_576);
  expect(allocator.entries()).toMatchObject([{ id: 'page:composer', category: 'page', bytes: 13_140_576, accountedBytes: 13_140_576 }]);
  page?.release(); expect(allocator.cost()).toEqual(before);
  const larger = allocator.reservePageComponent('page:composer', 20_000_000, 13_140_576);
  expect(allocator.cost().playing).toBe(before.playing + 20_000_000 - 13_140_576);
  larger?.release();
});
