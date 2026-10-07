import { expect, it } from 'vitest';
import { ResidencyAllocator } from '../src/game/grid/allocator';
import { MemoryAdmission } from '../src/game/grid/memoryAdmission';
import { PageResidency } from '../src/game/grid/pageResidency';

it('admits an over-budget Developer home with its exact cost and releases every charged byte', () => {
  let developer = false;
  const memory = new MemoryAdmission(() => developer), allocator = new ResidencyAllocator({ memory }), page = new PageResidency(allocator);
  expect(() => page.admitHome('pine', 800_000_000)).toThrow('Home residency admission deferred');
  expect(allocator.entries()).toEqual([]);
  developer = true;
  const home = page.admitHome('pine', 800_000_000), registry = home.retain();
  expect(page.memory).toBe(memory);
  expect(allocator.entries()).toEqual([{ id: 'sim:pine', category: 'sim', bytes: 800_000_000, owner: 'pine', distance: 0, needed: true, refs: 2, holds: 0 }]);
  expect(allocator.cost().playing).toBe(1_268_000_001);
  expect(memory.reports()[0]).toMatchObject({ claimedBytes: 800_000_000, accountedBytes: 800_000_000, playingBytes: allocator.cost().playing, playingCap: 1_000_000_000 });
  developer = false;
  expect(allocator.reserve({ id: 'far:b', category: 'far', bytes: 1, owner: 'b', distance: 10, needed: true })).toBeNull();
  page.dispose(); expect(allocator.cost().accounted).toBe(800_000_000);
  registry.release(); expect(allocator.cost().accounted).toBe(0); expect(memory.reports()).toEqual([]);
});

it('tries normal durable eviction first and aborts refused victims before Developer admits the full claim', () => {
  const memory = new MemoryAdmission(() => true), allocator = new ResidencyAllocator({ memory, playing: 413_300_001 }), log: string[] = [];
  allocator.reserve({ id: 'a', owner: 'a', category: 'sim', bytes: 10_000_000, needed: false, distance: 10,
    prepareEvict: () => ({ commit: () => { log.push('commit'); }, abort: () => { log.push('abort'); } }) });
  allocator.reserve({ id: 'b', owner: 'b', category: 'sim', bytes: 20_000_000, needed: true, distance: 0 });
  const next = allocator.reserve({ id: 'c', owner: 'c', category: 'sim', bytes: 30_000_000, needed: true, distance: 0 });
  expect(next).not.toBeNull(); expect(log).toEqual(['abort']);
  expect(allocator.cost().accounted).toBe(60_000_000);
  expect(memory.reports()[0]?.claimedBytes).toBe(30_000_000);
  expect(() => allocator.reserve({ id: 'bad', owner: 'c', category: 'sim', bytes: -1, needed: true, distance: 0 })).toThrow('Invalid residency claim');
  next?.release(); expect(allocator.cost().accounted).toBe(30_000_000); expect(memory.reports()).toEqual([]);
});
