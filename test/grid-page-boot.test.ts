// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import * as boot from '../src/game/grid/boot';
import * as debug from '../src/game/grid/debug';
import { preparePageResidency, validatePlannedGridReload, preflightGridReload } from '../src/game/grid/pageBoot';
import { PageResidency } from '../src/game/grid/pageResidency';
import { ResidencyAllocator } from '../src/game/grid/allocator';
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
  expect(owner.allocator.entries()).toMatchObject([{ id: 'sim:driftwood-isle', bytes: 531_078_379, refs: 2 }]);
  expect(owner.allocator.cost().playing).toBe(969_497_001);
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

it('keeps planned resume in row-OFF admission mode and refuses a changed source before hydration', async () => {
  const assembly = new GridAssembly({ developer: false, devserver: false, nineDragon: false });
  const cell = assembly.cell('template-4'), home = assembly.cell('driftwood-isle');
  installPlannedGridReload({ kind: 'resume', home, value: { v: 1, mode: 'grid', instance: cell.instance, revision: 1,
    layout: { developer: false, devserver: false, nineDragon: false }, cell: [...cell.cell],
    roadPose: { x: 277.5, y: 0, z: 0 }, heading: 0, mount: null, loadout: { selected: null, tools: [] },
    clock: { version: 1, elapsed: 10, wall: 10, frames: 600, paused: false, scale: 1, captureFps: null },
    recovery: { lastSafeRoadPoint: { x: 277.5, z: 0, yaw: 0 }, state: 'on-road' }, at: Date.now() } });
  const read = vi.spyOn(revisions, 'gridReloadRevision').mockResolvedValue(2);
  vi.spyOn(debug, 'gridMemoryAdmissionOn').mockReturnValue(false);
  const consume = vi.spyOn(boot, 'bootPageMode');
  expect(preparePageResidency(manifest)).toBeUndefined(); expect(consume).not.toHaveBeenCalled();
  await expect(validatePlannedGridReload()).rejects.toThrow('revision or geometry changed');
  expect(read).toHaveBeenCalledExactlyOnceWith(expect.any(GridAssembly), cell.instance);
});

it('preflights the real mandatory claims in row-ON mode without evicting or changing the current page', () => {
  const row = vi.spyOn(debug, 'gridMemoryAdmissionOn').mockReturnValue(false);
  expect(preflightGridReload(undefined, manifest.slug)).toBe(true);
  row.mockReturnValue(true); expect(preflightGridReload(undefined, manifest.slug)).toBe(false);
  const owner = new PageResidency(new ResidencyAllocator({ playing: 2_000_000_000 }));
  owner.admitHome(manifest.slug, 527_927_928);
  const lease = owner.allocator.reserve({ id: 'platform:render.road', category: 'l0', owner: 'platform',
    bytes: 20_000_000, distance: 0, needed: true });
  if (lease === null) throw new Error('Missing admitted platform');
  expect(preflightGridReload(owner, manifest.slug)).toBe(true);
  const oversize = owner.allocator.reserve({ id: 'platform:render.signs', category: 'l0', owner: 'platform',
    bytes: 22_732_832, distance: 0, needed: true });
  if (oversize === null) throw new Error('Missing over-cap diagnostic claim');
  const before = owner.allocator.entries();
  expect(preflightGridReload(owner, manifest.slug)).toBe(false); expect(owner.allocator.entries()).toEqual(before);
  expect(preflightGridReload(owner, 'other')).toBe(false);
  oversize.release(); lease.release(); owner.dispose();
});
