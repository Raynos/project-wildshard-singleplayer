// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import * as boot from '../src/game/grid/boot';
import * as debug from '../src/game/grid/debug';
import { preparePageResidency } from '../src/game/grid/pageBoot';
import { DRIFTWOOD_RUNTIME_COST } from '../src/shards/driftwood-isle/data/runtimeCost';

afterEach(() => { vi.restoreAllMocks(); });
const manifest = { slug: 'driftwood-isle' as const, runtimeCost: DRIFTWOOD_RUNTIME_COST };

it('preserves the existing row-OFF boot without consuming its grid intent early', () => {
  vi.spyOn(debug, 'gridMemoryAdmissionOn').mockReturnValue(false);
  const consume = vi.spyOn(boot, 'bootPageMode');
  expect(preparePageResidency(manifest)).toBeUndefined();
  expect(consume).not.toHaveBeenCalled();
});

it('leaves Select a shard without a grid claim even with the admission row ON', () => {
  vi.spyOn(debug, 'gridMemoryAdmissionOn').mockReturnValue(true);
  const consume = vi.spyOn(boot, 'bootPageMode').mockReturnValue('shard');
  expect(preparePageResidency(manifest)).toEqual({ mode: 'shard', instance: null });
  expect(consume).toHaveBeenCalledExactlyOnceWith(manifest.slug);
});

it('reserves the opaque measured home before hydration and exposes the same owner to the later registry', () => {
  vi.spyOn(debug, 'gridMemoryAdmissionOn').mockReturnValue(true);
  vi.spyOn(boot, 'bootPageMode').mockReturnValue('grid');
  vi.spyOn(boot, 'pageGridInstance').mockReturnValue(manifest.slug);
  const selected = preparePageResidency(manifest), owner = selected?.residency;
  if (owner === undefined) throw new Error('Missing early grid owner');
  const claim = owner.home(), registry = claim.retain();
  expect(owner.allocator.entries()).toMatchObject([{ id: 'sim:driftwood-isle', bytes: 341_781_982, refs: 2 }]);
  expect(owner.allocator.cost().playing).toBe(759_378_001);
  registry.release(); owner.dispose(); expect(owner.allocator.entries()).toEqual([]);
});

it('refuses a legacy home with missing metadata before the shell or hybrid world can allocate', () => {
  vi.spyOn(debug, 'gridMemoryAdmissionOn').mockReturnValue(true);
  vi.spyOn(boot, 'bootPageMode').mockReturnValue('grid');
  vi.spyOn(boot, 'pageGridInstance').mockReturnValue(manifest.slug);
  expect(() => preparePageResidency({ slug: manifest.slug })).toThrow('before bootstrap');
  expect(() => preparePageResidency({ ...manifest, runtimeCost: { ...DRIFTWOOD_RUNTIME_COST, webContentMB: Number.NaN } })).toThrow();
});

it('lets admitted data reserve its sim before bootstrap and refuses any late completion after hydration abort', () => {
  vi.spyOn(debug, 'gridMemoryAdmissionOn').mockReturnValue(true);
  vi.spyOn(boot, 'bootPageMode').mockReturnValue('grid');
  vi.spyOn(boot, 'pageGridInstance').mockReturnValue('template-1');
  const selected = preparePageResidency({ slug: '_template', shardfile: 'shardfiles/template/shardfile.json' }), owner = selected?.residency;
  if (owner === undefined) throw new Error('Missing early data owner');
  expect(owner.allocator.entries()).toEqual([]);
  owner.admitHome('template-1', 25_000_000);
  expect(owner.home().instance).toBe('template-1');
  owner.dispose(); expect(owner.allocator.entries()).toEqual([]);
  expect(() => owner.admitHome('template-1', 25_000_000)).toThrow('disposed');
});

