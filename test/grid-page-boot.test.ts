// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import * as boot from '../src/game/grid/boot';
import { preparePageResidency } from '../src/game/grid/pageBoot';
import { jsonSlot } from '../src/engine/saves/slots';
import { DRIFTWOOD_RUNTIME_COST } from '../src/shards/driftwood-isle/data/runtimeCost';

afterEach(() => { vi.restoreAllMocks(); });
const manifest = { slug: 'driftwood-isle' as const, runtimeCost: DRIFTWOOD_RUNTIME_COST };

it('leaves Select a shard without a grid claim', () => {
  const consume = vi.spyOn(boot, 'bootPageMode').mockReturnValue('shard');
  expect(preparePageResidency(manifest)).toEqual({ mode: 'shard', instance: null });
  expect(consume).toHaveBeenCalledExactlyOnceWith(manifest.slug);
});

it('reserves the opaque measured home before hydration and exposes the same owner to the later registry', () => {
  vi.spyOn(boot, 'bootPageMode').mockReturnValue('grid');
  vi.spyOn(boot, 'pageGridInstance').mockReturnValue(manifest.slug);
  const selected = preparePageResidency(manifest), owner = selected.residency;
  if (owner === undefined) throw new Error('Missing early grid owner');
  const claim = owner.home(), registry = claim.retain();
  expect(owner.allocator.entries()).toMatchObject([{ id: 'sim:driftwood-isle', bytes: 341_781_982, refs: 2 }]);
  expect(owner.allocator.cost().playing).toBe(759_378_001);
  registry.release(); owner.dispose(); expect(owner.allocator.entries()).toEqual([]);
});

it('refuses a legacy home with missing metadata before the shell or hybrid world can allocate', () => {
  vi.spyOn(boot, 'bootPageMode').mockReturnValue('grid');
  vi.spyOn(boot, 'pageGridInstance').mockReturnValue(manifest.slug);
  expect(() => preparePageResidency({ slug: manifest.slug })).toThrow('before bootstrap');
  expect(() => preparePageResidency({ ...manifest, runtimeCost: { ...DRIFTWOOD_RUNTIME_COST, webContentMB: Number.NaN } })).toThrow();
});

it('lets admitted data reserve its sim before bootstrap and refuses any late completion after hydration abort', () => {
  vi.spyOn(boot, 'bootPageMode').mockReturnValue('grid');
  vi.spyOn(boot, 'pageGridInstance').mockReturnValue('template-1');
  const selected = preparePageResidency({ slug: '_template', shardfile: 'shardfiles/template/shardfile.json' }), owner = selected.residency;
  if (owner === undefined) throw new Error('Missing early data owner');
  expect(owner.allocator.entries()).toEqual([]);
  owner.admitHome('template-1', 25_000_000);
  expect(owner.home().instance).toBe('template-1');
  owner.dispose(); expect(owner.allocator.entries()).toEqual([]);
  expect(() => owner.admitHome('template-1', 25_000_000)).toThrow('disposed');
});

it('ignores the retired opt-out and always admits a grid home before hydration', () => {
  const retired = jsonSlot('debug.global.gridMemoryAdmission', 'device');
  retired.write('off');
  vi.spyOn(boot, 'bootPageMode').mockReturnValue('grid');
  vi.spyOn(boot, 'pageGridInstance').mockReturnValue(manifest.slug);
  const page = preparePageResidency(manifest);
  try {
    expect(page.mode).toBe('grid');
    expect(page.residency?.home().bytes).toBe(341_781_982);
    expect(page.residency?.allocator.cost().playing).toBe(759_378_001);
  } finally { page.residency?.dispose(); retired.reset(); }
});
