// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import * as boot from '../src/game/grid/boot';
import * as debug from '../src/game/grid/debug';
import { preparePageResidency, validatePlannedGridReload } from '../src/game/grid/pageBoot';
import { installPlannedGridReload } from '../src/game/grid/reloadBoot';
import { GridAssembly } from '../src/game/grid/assembly';
import * as revisions from '../src/game/grid/reloadRevision';
import { DRIFTWOOD_RUNTIME_COST } from '../src/shards/driftwood-isle/data/runtimeCost';

afterEach(() => { vi.restoreAllMocks(); installPlannedGridReload({ kind: 'none' }); });
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
  expect(owner.allocator.entries()).toMatchObject([{ id: 'sim:driftwood-isle', bytes: 527_927_928, refs: 2 }]);
  expect(owner.allocator.cost().playing).toBe(966_000_001);
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

it('refuses a consumed source revision before creating a page owner or hydrating any assets', async () => {
  const assembly = new GridAssembly({ developer: false, devserver: false, nineDragon: false });
  const cell = assembly.cell('template-4'), home = assembly.cell('driftwood-isle');
  installPlannedGridReload({ kind: 'resume', home, value: { v: 1, mode: 'grid', instance: cell.instance, revision: 1,
    layout: { developer: false, devserver: false, nineDragon: false }, cell: [...cell.cell],
    roadPose: { x: 277.5, y: 0, z: 0 }, heading: 0, mount: null, loadout: { selected: null, tools: [] },
    clock: { version: 1, elapsed: 10, wall: 10, frames: 600, paused: false, scale: 1, captureFps: null },
    recovery: { lastSafeRoadPoint: { x: 277.5, z: 0, yaw: 0 }, state: 'on-road' }, at: Date.now() } });
  const read = vi.spyOn(revisions, 'gridReloadRevision').mockResolvedValue(2);
  await expect(validatePlannedGridReload()).rejects.toThrow('revision or geometry changed');
  expect(read).toHaveBeenCalledExactlyOnceWith(expect.any(GridAssembly), cell.instance);
});
