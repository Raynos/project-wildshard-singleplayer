import { expect, it } from 'vitest';
import { CONTENT_CAPS as C, CONTENT_MB as MB } from '../src/engine/core/config';
import { ResidencyAllocator } from '../src/game/grid/allocator';

it('charges every category through the SF22a cost model and refuses what cannot fit', () => {
  const allocator = new ResidencyAllocator();
  const sim = allocator.reserve({ id: 'sim:a', category: 'sim', bytes: C.sim.resident, owner: 'a', distance: 0, needed: true });
  expect(sim).not.toBeNull();
  expect(allocator.cost().input).toEqual({ l0: 0, l1: 0, far: 0, libraries: 0, sims: C.sim.resident, commons: 0, products: 0, overlap: C.overlap });
  expect(allocator.cost().playing).toBe(C.engineBase + Math.ceil(C.sim.resident * C.residentFactor) + C.overlap);
  // (1000 − 300 − 80) / 1.11 ≈ 558 MB accounted (G65's 1.0 GB envelope); a needed 600 MB claim never fits and evicts nothing
  expect(allocator.reserve({ id: 'library:huge', category: 'library', bytes: 600 * MB, owner: 'b', distance: 0, needed: true })).toBeNull();
  expect(allocator.has('sim:a')).toBe(true);
});

it('shares an id once, evicts unneeded unheld claims farthest-first, and never evicts needed or held ones', () => {
  const allocator = new ResidencyAllocator({ playing: C.engineBase + C.overlap + Math.ceil(10 * MB * C.residentFactor) });
  const evicted: string[] = [];
  const claim = (id: string, distance: number, needed = false): ReturnType<ResidencyAllocator['reserve']> =>
    allocator.reserve({ id, category: 'l0', bytes: 2 * MB, owner: 'x', distance, needed, evictSync: () => { evicted.push(id); } });
  const commonsA = allocator.reserve({ id: 'commons:h', category: 'commons', bytes: 2 * MB, owner: 'platform', distance: 0, needed: true });
  const commonsB = allocator.reserve({ id: 'commons:h', category: 'commons', bytes: 2 * MB, owner: 'platform', distance: 0, needed: true });
  expect(allocator.cost().input.commons).toBe(2 * MB);
  commonsA?.release(); expect(allocator.has('commons:h')).toBe(true); commonsB?.release(); expect(allocator.has('commons:h')).toBe(false);
  const near = claim('near', 10, true), mid = claim('mid', 50), far = claim('far', 90), held = claim('held', 200);
  const unhold = held?.hold();
  expect([near, mid, far, held].every((l) => l !== null)).toBe(true);
  claim('new', 5);
  expect(claim('new2', 5)).not.toBeNull();
  expect(evicted).toEqual(['far']);
  expect(allocator.has('held')).toBe(true);
  unhold?.();
  expect(claim('new3', 5)).not.toBeNull();
  expect(evicted).toEqual(['far', 'held']);
  // an evicted claim's own lease is dead: releasing it again changes nothing
  far?.release(); expect(allocator.cost().input.l0).toBe(10 * MB);
});

it('refuses without evicting when every evictable claim together is not enough', () => {
  const allocator = new ResidencyAllocator({ playing: C.engineBase + C.overlap + Math.ceil(4 * MB * C.residentFactor) });
  let evictions = 0;
  allocator.reserve({ id: 'a', category: 'far', bytes: 2 * MB, owner: 'x', distance: 1, needed: true });
  allocator.reserve({ id: 'b', category: 'far', bytes: 2 * MB, owner: 'x', distance: 9, needed: false, evictSync: () => { evictions++; } });
  expect(allocator.reserve({ id: 'c', category: 'l1', bytes: 3 * MB, owner: 'x', distance: 0, needed: true })).toBeNull();
  expect(evictions).toBe(0);
  expect(allocator.reserve({ id: 'd', category: 'l1', bytes: 2 * MB, owner: 'x', distance: 0, needed: true })).not.toBeNull();
  expect(evictions).toBe(1);
});

it('two-phase eviction: a late victim that refuses at prepare aborts the earlier prepared ones, which stay resident', () => {
  const allocator = new ResidencyAllocator({ playing: C.engineBase + C.overlap + Math.ceil(30 * MB * C.residentFactor) });
  const log: string[] = [];
  const sim = (id: string, distance: number, refuse: boolean, needed = false): void => {
    allocator.reserve({ id, category: 'sim', bytes: 10 * MB, owner: id, distance, needed, prepareEvict: () => {
      log.push(`prepare ${id}`); if (refuse) return null;
      return { commit: () => { log.push(`commit ${id}`); }, abort: () => { log.push(`abort ${id}`); } };
    } });
  };
  sim('sim:needed', 999, false, true); sim('sim:far', 300, false); sim('sim:near', 100, true);
  expect(allocator.reserve({ id: 'sim:new', category: 'sim', bytes: 20 * MB, owner: 'new', distance: 0, needed: true })).toBeNull();
  expect(log).toEqual(['prepare sim:far', 'prepare sim:near', 'abort sim:far']);
  expect(['sim:needed', 'sim:far', 'sim:near'].every((id) => allocator.has(id))).toBe(true);
  log.length = 0;
  expect(allocator.reserve({ id: 'sim:small', category: 'sim', bytes: 10 * MB, owner: 'small', distance: 0, needed: true })).not.toBeNull();
  expect(log).toEqual(['prepare sim:far', 'commit sim:far']);
  expect(allocator.has('sim:far')).toBe(false);
});
