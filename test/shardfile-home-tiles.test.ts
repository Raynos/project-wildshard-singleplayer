import { beforeAll, expect, it } from 'vitest';
import { BufferGeometry, Float32BufferAttribute, MeshStandardMaterial } from 'three';
import { Scope } from '../src/engine/app/scope';
import { CONTENT_CAPS } from '../src/engine/core/config';
import { ResidencyAllocator } from '../src/game/grid/allocator';
import { PageResidency } from '../src/game/grid/pageResidency';
import { ClientAssets } from '../src/game/shardfile/clientAssets';
import { clientWorld, type ClientWorldViews } from '../src/game/shardfile/clientWorld';
import { validateShardfileAssets } from '../src/game/shardfile/validate';
import { assetCost } from '../src/game/shardfile/assets';
import { emptyShardfile } from '../src/sdk/author';
import { bakeTerrain } from '../src/sdk/bake/terrain';
import { staticGlb } from '../src/sdk/bake/glb';
import { contentHash } from '../src/sdk/project';
import type { Shardfile } from '../src/game/shardfile/schema';

let source: Shardfile;
let bytes: ReadonlyMap<string, Uint8Array>;
beforeAll(() => {
  const baked = bakeTerrain({ heightAt: () => 0, colourAt: () => [0.4, 0.5, 0.6] });
  const data = emptyShardfile({ slug: 'home-tiles', name: 'Home tiles', author: 'Fixture', seed: 1, revision: 1 });
  Object.assign(data, { terrain: baked.terrain, tiles: baked.tiles, files: baked.files, critical: baked.critical, edge: baked.edge });
  data.look.families = ['pbr']; data.budgets.sim = { resident: 16_000_000, compressed: 2_000_000 };
  const geometry = new BufferGeometry(), material = new MeshStandardMaterial();
  geometry.setAttribute('position', new Float32BufferAttribute([10, 0, 10, 11, 0, 10, 10, 0, 11], 3));
  try {
    const prop = staticGlb([{ geometry, material }]), hash = contentHash(prop), cost = assetCost('glb', prop);
    baked.assets.set(hash, prop); data.files.push({ hash, kind: 'glb', compressed: prop.length, ...cost, dependencies: [], critical: false });
    data.props = { version: 1, family: 'pbr', tiles: [{ lod: 0, x: 4, z: 4, file: hash }], panels: [], models: [], textures: [], far: null, colliders: [] };
    const row = data.tiles.find((tile) => tile.lod === 0 && tile.x === 4 && tile.z === 4);
    if (row === undefined) throw new Error('Missing combined tile');
    row.files.push(hash); row.compressed += prop.length;
    for (const key of ['decoded', 'gpu', 'triangles', 'draws'] as const) row[key] += cost[key];
    source = validateShardfileAssets(data, baked.assets, contentHash); bytes = baked.assets;
  } finally { geometry.dispose(); material.dispose(); }
});

function reader(): ClientAssets {
  return new ClientAssets(source, bytes, { base: 'https://fixture.test/', firstParty: true, offline: true,
    fetch: () => Promise.reject(new Error('No network')), hash: (wire) => Promise.resolve(contentHash(wire)),
    cache: { product: () => Promise.resolve(null), asset: (_base, hash) => Promise.resolve(bytes.get(hash) ?? null),
      putAsset: () => Promise.resolve(), putProduct: () => Promise.resolve() },
  });
}
function tracking(allocator: ResidencyAllocator) {
  let calls = 0, propCalls = 0;
  const masks = new Map<string, number>();
  const views: ClientWorldViews = {
    terrain: (_wire, scope) => {
      calls++; const claim = allocator.entries().find((entry) => entry.id === `home:l${scope.name}`);
      expect(claim).toBeDefined();
      return { shadow: () => undefined, mask: (mask) => { masks.set(scope.name, mask.size); } };
    },
    props: (_props, key) => {
      propCalls++; const row = source.tiles.find((tile) => `${tile.lod}/${tile.x}/${tile.z}` === key);
      expect(allocator.entries().find((entry) => entry.id === `home:l${key}`)?.bytes).toBe((row?.decoded ?? 0) + (row?.gpu ?? 0));
      return Promise.resolve({ shadow: () => undefined, mask: () => undefined });
    },
    library: () => Promise.resolve({ tiles: new Map(), panels: new Map(), models: new Map(), far: null, disposeTile: () => undefined }),
  };
  return { views, masks, calls: () => calls, props: () => propCalls };
}

it('charges admitted coarse and combined fine tiles before views, then releases movement and unload leases', async () => {
  const owner = new PageResidency(), home = owner.admitHome('home', source.budgets.sim.resident), scope = new Scope('home'), tracked = tracking(owner.allocator);
  try {
    const world = await clientWorld(source, reader(), { scope, views: tracked.views, x: 0, z: 0, residency: { allocator: owner.allocator, owner: 'home' } });
    expect(tracked.props()).toBe(1);
    for (const x of [0, 220, -220]) {
      await world.refresh(x, 30);
      const entries = owner.allocator.entries();
      expect(entries.filter((row) => row.category === 'l1')).toHaveLength(16);
      expect(entries.filter((row) => row.category === 'l0')).toHaveLength(world.fine.size);
      const expected = source.tiles.filter((tile) => tile.lod === 1 || world.fine.has(`${tile.lod}/${tile.x}/${tile.z}`)).reduce((sum, row) => sum + row.decoded + row.gpu, home.bytes);
      expect(entries.reduce((sum, row) => sum + row.bytes, 0)).toBe(expected);
      expect(world.fine.size).toBeLessThanOrEqual(40);
    }
    scope.dispose(); expect(owner.allocator.entries()).toMatchObject([{ id: 'sim:home', refs: 1 }]);
  } finally { scope.dispose(); owner.dispose(); }
  expect(owner.allocator.entries()).toEqual([]);
});

it('refuses coarse admission before allocation and rolls back earlier tile claims', async () => {
  const first = source.tiles.find((tile) => tile.lod === 1); if (first === undefined) throw new Error('Missing coarse tile');
  const baseline = new ResidencyAllocator().cost().playing;
  const allocator = new ResidencyAllocator({ playing: baseline + (first.decoded + first.gpu) * CONTENT_CAPS.residentFactor + 1 });
  const scope = new Scope('refusal'), tracked = tracking(allocator);
  try {
    await expect(clientWorld(source, reader(), { scope, views: tracked.views, x: 0, z: 0, residency: { allocator, owner: 'home' } })).rejects.toThrow('coarse tile residency admission deferred');
    expect(tracked.calls()).toBe(1); expect(allocator.entries()).toEqual([]);
  } finally { scope.dispose(); }
});

it('keeps coarse coverage unmasked where quota defers fine children', async () => {
  const coarseBytes = source.tiles.filter((tile) => tile.lod === 1).reduce((sum, row) => sum + row.decoded + row.gpu, 0);
  const allocator = new ResidencyAllocator({ playing: new ResidencyAllocator().cost().playing + coarseBytes * CONTENT_CAPS.residentFactor + 1 });
  const scope = new Scope('coarse-only'), tracked = tracking(allocator);
  try {
    const world = await clientWorld(source, reader(), { scope, views: tracked.views, x: 0, z: 0, residency: { allocator, owner: 'home' } });
    expect(world.fine.size).toBe(0); expect(tracked.calls()).toBe(16);
    expect([...tracked.masks.values()]).toEqual(Array.from({ length: 16 }, () => 0));
    expect(allocator.entries()).toHaveLength(16);
  } finally { scope.dispose(); }
  expect(allocator.entries()).toEqual([]);
});

it('does not add fallback claims when a ring scheduler owns the tiles', async () => {
  const scope = new Scope('rings'), allocator = new ResidencyAllocator();
  try {
    await clientWorld(source, reader(), { scope, views: tracking(allocator).views, x: 0, z: 0, residency: { allocator, owner: 'home' },
      rings: { step: () => undefined, ready: () => true, resident: () => [], dispose: () => undefined } });
    expect(allocator.entries()).toEqual([]);
  } finally { scope.dispose(); }
});

it('releases an in-flight claim on cancellation before any view can allocate', async () => {
  const scope = new Scope('cancelled'), allocator = new ResidencyAllocator(), tracked = tracking(allocator);
  let deliver: (wire: Uint8Array) => void = () => { throw new Error('Tile read was not requested'); };
  let requested: () => void = () => { throw new Error('Request fence was not installed'); };
  const started = new Promise<void>((resolve) => { requested = resolve; });
  const assets = new ClientAssets(source, new Map(), { base: 'https://fixture.test/', firstParty: true, offline: true,
    hash: (wire) => Promise.resolve(contentHash(wire)), fetch: () => Promise.reject(new Error('No network')),
    cache: { product: () => Promise.resolve(null), asset: (_base, hash) => new Promise((resolve) => {
      deliver = () => { resolve(bytes.get(hash) ?? null); }; requested();
    }), putAsset: () => Promise.resolve(), putProduct: () => Promise.resolve() },
  });
  const loading = clientWorld(source, assets, { scope, views: tracked.views, x: 0, z: 0, residency: { allocator, owner: 'home' } });
  const rejected = expect(loading).rejects.toThrow('Tile unloaded while reading');
  await started; expect(allocator.entries()).toHaveLength(1); scope.dispose();
  deliver(new Uint8Array()); await rejected;
  expect(tracked.calls()).toBe(0); expect(allocator.entries()).toEqual([]);
});

it('rolls back every tile claim when a view fails during initial fine installation', async () => {
  const scope = new Scope('failed-view'), allocator = new ResidencyAllocator(), tracked = tracking(allocator);
  try {
    await expect(clientWorld(source, reader(), { scope, x: 0, z: 0, residency: { allocator, owner: 'home' }, views: { ...tracked.views,
      terrain: (wire, tileScope, shadow) => {
        if (tileScope.name.startsWith('0/')) throw new Error('Injected view refusal');
        return tracked.views.terrain(wire, tileScope, shadow);
      },
    } })).rejects.toThrow('Injected view refusal');
    expect(tracked.calls()).toBe(16); expect(allocator.entries()).toEqual([]);
  } finally { scope.dispose(); }
});
