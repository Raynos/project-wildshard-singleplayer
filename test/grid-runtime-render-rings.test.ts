import { expect, it } from 'vitest';
import { Scope } from '../src/engine/app/scope';
import { currentOwner } from '../src/engine/app/ownership';
import { CONTENT_CAPS } from '../src/engine/core/config';
import { contentCost } from '../src/engine/core/contentCost';
import { ResidencyAllocator } from '../src/game/grid/allocator';
import { RenderRings, type RingTile, type RingView } from '../src/game/grid/rings';
import { compileRuntimeRenderPlan, type RuntimeRenderPorts } from '../src/game/grid/runtimeRenderPlan';
import { RuntimeRenderDependencies } from '../src/game/grid/runtimeRenderDependencies';
import { runtimeRenderRings, type RuntimeRenderPrepared } from '../src/game/grid/runtimeRenderRings';

const measured = { webContentMB: 350, glMB: 50, engineBaseMB: 299, rev: 'abcdef123', device: 'scope fixture', evidence: 'progress/memory/runtime-rings/summary.json' };
const inventory = () => compileRuntimeRenderPlan({ measurement: measured, nonStreamingBytes: 20_000_000,
  dependencies: [{ id: 'materials.verified', jsBytes: 10_000_000, gpuBytes: 10_000_000 }, { id: 'textures.verified', jsBytes: 10_000_000, gpuBytes: 10_000_000 }],
  chunks: [
    { id: 'terrain.coarse', level: 'l1', x: 0, z: 0, jsBytes: 10_000_000, gpuBytes: 10_000_000, dependencyIds: ['materials.verified', 'textures.verified'] },
    { id: 'props.coarse', level: 'l1', x: 0, z: 0, jsBytes: 5_000_000, gpuBytes: 5_000_000, dependencyIds: ['materials.verified'] },
    { id: 'terrain.next', level: 'l1', x: 1, z: 0, jsBytes: 10_000_000, gpuBytes: 10_000_000, dependencyIds: ['materials.verified'] },
    { id: 'terrain.fine', level: 'l0', x: 0, z: 0, jsBytes: 10_000_000, gpuBytes: 10_000_000, dependencyIds: ['materials.verified'] },
  ] }, measured);
const camera = { x: -200, z: -200, vx: 0, vz: 0 };
const tile: RingTile = { key: 'cell:l1/0/0', instance: 'cell', level: 'l1', x: 0, z: 0 };
const emptyView = (): RingView => ({ mask: () => undefined, shadow: () => undefined, dispose: () => undefined });
function fixture(playing?: number) {
  const allocator = new ResidencyAllocator(playing === undefined ? {} : { playing }), page = new Scope('page');
  const dependencies = new RuntimeRenderDependencies(allocator, page), region = page.child('region'), checked = inventory();
  const residual = allocator.reserve({ id: 'sim:cell', category: 'sim', bytes: checked.nonStreamingBytes, owner: 'cell', distance: 0, needed: true });
  if (residual === null) throw new Error('Fixture requires opaque residual');
  region.onDispose(residual.release);
  return { allocator, page, region, dependencies, checked };
}

it('admits components and dependencies before preparation, shares their scopes and masks every tile component together', () => {
  const { allocator, page, region, dependencies, checked } = fixture();
  const masks = new Map<string, readonly number[]>(), live = new Set<string>(), sharedScopes = new Set<Scope>();
  let allocated = 0, sharedAllocated = 0;
  const renderer: RuntimeRenderPorts<string> = {
    prepare: (chunk, scope, done, shared) => {
      expect(currentOwner()).toBe(scope);
      expect(allocator.entries().some((entry) => entry.category === chunk.level && entry.owner === 'cell')).toBe(true);
      for (const id of chunk.dependencyIds) {
        expect(allocator.has(`runtime-render:dependency:${id}`)).toBe(true);
        const owner = shared.scope(id);
        if (!sharedScopes.has(owner)) { sharedScopes.add(owner); sharedAllocated++; owner.onDispose(() => { sharedAllocated--; }); }
      }
      expect(() => shared.scope('not-declared')).toThrow('not admitted');
      allocated++; scope.onDispose(() => { allocated--; }); done(chunk.id);
    },
    upload: (chunk, data, scope) => {
      expect(data).toBe(chunk.id); expect(currentOwner()).toBe(scope); live.add(chunk.id);
      return { mask: (excluded) => { masks.set(chunk.id, [...excluded]); }, shadow: () => undefined, dispose: () => { live.delete(chunk.id); } };
    }, discard: () => undefined,
  };
  const adapter = runtimeRenderRings<string>('cell', checked, dependencies, region, renderer);
  const rings = new RenderRings([{ instance: 'cell', origin: { x: 0, z: 0 } }], allocator, adapter.catalogue, adapter.ports);
  // Each 20-30 MB tile exceeds the per-frame upload allowance: parents publish over two steps, then the fine child.
  rings.step(camera); rings.step(camera); rings.step(camera);
  expect(rings.resident()).toEqual(['cell:l0/0/0', 'cell:l1/0/0', 'cell:l1/1/0']);
  expect(allocated).toBe(4); expect(sharedAllocated).toBe(2);
  expect(allocator.entries().filter((entry) => entry.category === 'library')).toHaveLength(2);
  expect(masks.get('props.coarse')).toEqual([0]); expect(masks.get('terrain.coarse')).toEqual([0]);
  rings.dispose(); expect(allocated).toBe(0); expect(sharedAllocated).toBe(0); expect(live.size).toBe(0);
  expect(allocator.entries().map((entry) => entry.id)).toEqual(['sim:cell']); page.dispose(); expect(allocator.entries()).toEqual([]);
});

it('rolls back partly admitted dependencies before any renderer work when the ring cannot fit', () => {
  const playing = contentCost({ l0: 0, l1: 30_000_000, far: 0, libraries: 20_000_000, sims: 20_000_000, commons: 0, overlap: CONTENT_CAPS.overlap }).playing;
  const { allocator, page, region, dependencies, checked } = fixture(playing);
  let prepares = 0;
  const adapter = runtimeRenderRings<string>('cell', checked, dependencies, region, {
    prepare: () => { prepares++; }, upload: emptyView, discard: () => undefined,
  });
  const rings = new RenderRings([{ instance: 'cell', origin: { x: 0, z: 0 } }], allocator, adapter.catalogue, adapter.ports);
  rings.step(camera); expect(prepares).toBe(0);
  expect(allocator.entries().map((entry) => entry.id)).toEqual(['sim:cell']); expect(rings.ready()).toBe(false);
  rings.dispose(); page.dispose(); expect(allocator.entries()).toEqual([]);
});

it('cancels every partial component, discards late payloads and cannot resurrect dependency claims', () => {
  const { allocator, page, region, dependencies, checked } = fixture();
  const callbacks = new Map<string, (result: string | Error) => void>(), discarded: string[] = [];
  let allocated = 0;
  const adapter = runtimeRenderRings<string>('cell', checked, dependencies, region, {
    prepare: (chunk, scope, done) => { callbacks.set(chunk.id, done); allocated++; scope.onDispose(() => { allocated--; }); },
    upload: () => { throw new Error('Cancelled work cannot publish'); }, discard: (_chunk, payload) => { discarded.push(payload); },
  });
  const componentClaim = allocator.reserve({ id: `render:${tile.key}`, category: 'l1', bytes: adapter.catalogue('cell', 'l1', 0, 0) ?? 0, owner: 'cell', distance: 0, needed: true });
  if (componentClaim === null) throw new Error('Fixture requires tile');
  let reports = 0;
  adapter.ports.fetch(tile, () => { reports++; });
  const props = callbacks.get('props.coarse'), terrain = callbacks.get('terrain.coarse');
  if (props === undefined || terrain === undefined) throw new Error('Fixture requires both component callbacks');
  props('ready-before-cancel'); adapter.ports.cancel?.(tile); componentClaim.release();
  expect(allocated).toBe(0); terrain('late'); expect(reports).toBe(0);
  expect(discarded).toEqual(['ready-before-cancel', 'late']);
  expect(allocator.entries().map((entry) => entry.id)).toEqual(['sim:cell']); page.dispose(); expect(allocator.entries()).toEqual([]);
});

it('rolls back a component upload failure while the rings also retire the tile claim', () => {
  const { allocator, page, region, dependencies, checked } = fixture(); let views = 0, allocated = 0;
  const adapter = runtimeRenderRings<string>('cell', checked, dependencies, region, {
    prepare: (chunk, scope, done) => { allocated++; scope.onDispose(() => { allocated--; }); done(chunk.id); },
    upload: (chunk) => {
      if (chunk.id === 'terrain.coarse') throw new Error('upload failed');
      views++; return { ...emptyView(), dispose: () => { views--; } };
    }, discard: () => undefined,
  });
  const rings = new RenderRings([{ instance: 'cell', origin: { x: 0, z: 0 } }], allocator, adapter.catalogue, adapter.ports, { maxInFlight: 1 });
  expect(() => rings.step(camera)).toThrow('upload failed'); expect(views).toBe(0); expect(allocated).toBe(0);
  expect(allocator.entries().map((entry) => entry.id)).toEqual(['sim:cell']); rings.dispose(); page.dispose(); expect(allocator.entries()).toEqual([]);
});

it('cancels partial renderer preparation on page teardown and refuses later work', () => {
  const { allocator, page, region, dependencies, checked } = fixture(); let allocated = 0, prepares = 0;
  const adapter = runtimeRenderRings<string>('cell', checked, dependencies, region, {
    prepare: (chunk, scope) => {
      prepares++; allocated++;
      scope.onDispose(() => { for (const id of chunk.dependencyIds) expect(allocator.has(`runtime-render:dependency:${id}`)).toBe(true); allocated--; });
    },
    upload: emptyView, discard: () => undefined,
  });
  adapter.ports.fetch(tile, () => undefined); expect(allocated).toBe(2); page.dispose(); expect(allocated).toBe(0);
  expect(allocator.entries()).toEqual([]);
  let error: unknown; adapter.ports.fetch(tile, (result) => { error = result; });
  expect(error).toBeInstanceOf(Error); expect(prepares).toBe(2); expect(allocator.entries()).toEqual([]);
});

it('forgets queued payload references and stops advertising a retired region before the scheduler drains', () => {
  const { allocator, page, region, dependencies, checked } = fixture();
  const adapter = runtimeRenderRings<string>('cell', checked, dependencies, region, {
    prepare: (chunk, _scope, done) => { done(chunk.id); }, upload: emptyView, discard: () => undefined,
  });
  let queued: RuntimeRenderPrepared<string> | undefined;
  adapter.ports.fetch(tile, (result) => { if (result instanceof Error) throw result; queued = result; });
  if (queued === undefined) throw new Error('Fixture requires a prepared tile');
  expect(queued.parts).toHaveLength(2); region.dispose(); expect(queued.parts).toHaveLength(0);
  expect(adapter.catalogue('cell', 'l1', 0, 0)).toBeNull(); expect(allocator.entries()).toEqual([]);
  adapter.ports.discard?.(tile, queued); page.dispose();
});
