import { Group, type Object3D } from 'three';
import { expect, test } from 'vitest';
import { Scope, disposalErrorMessages } from '../src/engine/app/scope';
import { TileStreamer } from '../src/engine/world/tileStreamer';
import { emptyShardfile } from '../src/sdk/author';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { ResidencyAllocator } from '../src/game/grid/allocator';
import { TileDecoder } from '../src/game/grid/tileDecoder';
import { ClientAssets } from '../src/game/shardfile/clientAssets';
import { standaloneClientTiles, clientRingCatalogue, clientRingPorts, clientTileRegistration, type ClientRingInstance } from '../src/game/shardfile/tileContent';
import type { Shardfile } from '../src/format/shardSchema';

function isGroup(object: Object3D): object is Group { return object instanceof Group; }

const camera = { x: -31.25, z: -31.25, vx: 0, vz: 0 };
function fixture(coarse = true, fail = false) {
  const scope = new Scope('page'), resident = scope.child('resident'), allocator = new ResidencyAllocator(), decoder = new TileDecoder();
  const source = emptyShardfile({ slug: 'registered-fixture', name: 'Registered', author: 'Test', seed: 1, revision: 1 });
  const wire = new Map<string, Uint8Array>(), rows: NonNullable<Shardfile['props']>['tiles'] = [];
  for (const lod of coarse ? [1, 0] as const : [0] as const) for (let z = 0; z < (lod === 1 ? 4 : 8); z++) for (let x = 0; x < (lod === 1 ? 4 : 8); x++) {
    const bytes = new Uint8Array([lod, x, z]), hash = hashImmutableBytes(bytes), size = lod === 1 ? 125 : 62.5;
    rows.push({ lod, x, z, file: hash }); wire.set(hash, bytes);
    source.files.push({ hash, kind: 'binary', compressed: bytes.length, decoded: 1, gpu: 1, triangles: 0, draws: 1, dependencies: [], critical: false });
    source.tiles.push({ lod, x, z, files: [hash], compressed: bytes.length, decoded: 1, gpu: 1, triangles: 0, draws: 1, geometricError: 0,
      bounds: { min: [-250 + x * size, 0, -250 + z * size], max: [-250 + (x + 1) * size, 0, -250 + (z + 1) * size] } });
  }
  source.props = { version: 1, family: 'fixture', tiles: rows, wholeLibrary: [], models: [], panels: [], far: null, colliders: [], textures: [] };
  let pins = 0, radius = 1;
  const active = new Map<Group, { key: string; root: Group; excluded: ReadonlySet<number> }>();
  const make = (name: string): ClientRingInstance & { root: Group } => {
    const root = new Group(); root.name = name;
    const assets = new ClientAssets(source, wire, { base: 'https://example.invalid/', firstParty: true, offline: true,
      hash: bytes => Promise.resolve(hashImmutableBytes(bytes)), fetch: () => Promise.reject(new Error('Unexpected network')), cache: {
        product: () => Promise.resolve(null), putProduct: () => Promise.resolve(), putAsset: () => Promise.resolve(true),
        asset: (_base, hash) => Promise.resolve(wire.get(hash) ?? null),
        pin: () => { pins++; return () => { pins--; }; },
      } });
    return { source, assets, root, views: {
      terrain: () => { throw new Error('No fixture terrain'); }, panels: () => Promise.resolve(new Map()),
      props: (_props, key, _bytes, group, owner) => {
        if (!isGroup(group)) throw new Error('Expected detached group');
        if (fail && key === '0/3/3' && name === 'entered') throw new Error('Fixture preparation refused');
        const tile: { key: string; root: Group; excluded: ReadonlySet<number> } = { key, root, excluded: new Set() };
        active.set(group, tile); owner.onDispose(() => { active.delete(group); });
        return Promise.resolve({ mask: excluded => { tile.excluded = new Set(excluded); }, shadow: () => undefined });
      },
    } };
  };
  const neighbour = make('neighbour'), entered = make('entered'), instances = new Map([['home', neighbour]]);
  const ports = clientRingPorts(instances, { scope, decoder });
  const streamer = new TileStreamer([{ instance: 'home', origin: { x: 0, z: 0 } }], { reserve: claim => allocator.reserve(claim), now: () => 0 }, clientRingCatalogue(instances), ports);
  const registration = clientTileRegistration(instances, streamer, () => radius);
  scope.onDispose(() => { registration.dispose(); streamer.dispose(); decoder.dispose(); });
  const drive = async (view = camera, check?: () => void): Promise<void> => {
    for (let frame = 0; frame < 150; frame++) { streamer.step(view); await Promise.resolve(); check?.(); }
  };
  const coverage = (root: Group): number[] => Array.from({ length: 64 }, (_, key) => {
    const x = key % 8, z = Math.floor(key / 8); let draws = 0;
    for (const [group, tile] of active) if (tile.root === root && group.parent === root) {
      if (tile.key === `0/${String(x)}/${String(z)}`) draws++;
      if (tile.key === `1/${String(Math.floor(x / 2))}/${String(Math.floor(z / 2))}` && !tile.excluded.has(x % 2 + 2 * (z % 2))) draws++;
    }
    return draws;
  });
  return { scope, resident, allocator, streamer, registration, neighbour, entered, instances, make, drive, coverage,
    radius: (value: number) => { radius = value; }, pins: () => pins };
}

test('entered tiles use the existing streamer, keep coarse coverage and restore the newest neighbour root', async () => {
  const f = fixture();
  try {
    await f.drive(); const pending = f.registration.enter('home', f.entered, f.resident, camera);
    await f.drive(); const world = await pending;
    expect(f.registration.owns('home')).toBe(true); expect(f.neighbour.root.children).toHaveLength(0);
    expect(f.coverage(f.entered.root)).toEqual(Array.from({ length: 64 }, () => 1)); expect(world.fine.size).toBe(9);
    const newest = f.make('newest'); f.registration.offer('home', newest);
    expect(f.instances.get('home')?.root).toBe(f.entered.root);
    f.radius(2); await world.refresh(); await f.drive(camera, () => { expect(f.coverage(f.entered.root)).toEqual(Array.from({ length: 64 }, () => 1)); });
    expect(world.fine.size).toBe(25);
    f.resident.dispose(); expect(f.registration.owns('home')).toBe(false); expect(f.entered.root.children).toHaveLength(0);
    expect(f.instances.get('home')?.root).toBe(newest.root); await f.drive(); expect(newest.root.children.length).toBeGreaterThan(0);
  } finally { f.scope.dispose(); }
  expect(f.pins()).toBe(0); expect(f.allocator.entries()).toHaveLength(0);
});

test('a missing coarse tier keeps its fine patches as coverage beyond the selected full ring', async () => {
  const f = fixture(false);
  try {
    const pending = f.registration.enter('home', f.entered, f.resident, camera); await f.drive(); const world = await pending;
    expect(world.fine.size).toBe(64); expect(f.coverage(f.entered.root)).toEqual(Array.from({ length: 64 }, () => 1));
  } finally { f.scope.dispose(); }
  expect(f.pins()).toBe(0); expect(f.allocator.entries()).toHaveLength(0);
});

test('data entry waits for offered near coverage and retires with its regional owner', async () => {
  const f = fixture(false);
  try {
    await expect(f.registration.enterOffered('unknown', f.resident, camera)).rejects.toThrow('not been admitted');
    f.registration.offer('home', f.entered);
    let ready = false;
    const pending = f.registration.enterOffered('home', f.resident, camera).then(() => { ready = true; return undefined; });
    expect(ready).toBe(false);
    for (let frame = 0; frame < 10; frame++) { f.streamer.step(camera); await Promise.resolve(); }
    expect(ready).toBe(false);
    await f.drive(); await pending;
    expect(f.registration.owns('home')).toBe(true);
    expect(f.coverage(f.entered.root)).toEqual(Array.from({ length: 64 }, () => 1));
    f.resident.dispose();
    expect(f.registration.owns('home')).toBe(false);
    expect(f.entered.root.children).toHaveLength(0);
    const returned = f.scope.child('returned');
    const again = f.registration.enterOffered('home', returned, camera);
    await f.drive(); await again;
    expect(f.coverage(f.entered.root)).toEqual(Array.from({ length: 64 }, () => 1));
  } finally { f.scope.dispose(); }
  expect(f.pins()).toBe(0); expect(f.allocator.entries()).toHaveLength(0);
});

test('data entry keeps preparation refusal and closed-owner fences', async () => {
  const f = fixture(true, true);
  try {
    f.registration.offer('home', f.entered);
    const pending = f.registration.enterOffered('home', f.resident, camera);
    const refusal = expect(pending).rejects.toThrow('Fixture preparation refused');
    await f.drive(); await refusal;
    expect(f.registration.owns('home')).toBe(false);
    f.resident.dispose();
    await expect(f.registration.enterOffered('home', f.resident, camera)).rejects.toThrow('owner left');
  } finally { f.scope.dispose(); }
  expect(f.pins()).toBe(0); expect(f.allocator.entries()).toHaveLength(0);
});

test('data entry retains already uploaded neighbour tiles instead of reloading them', async () => {
  const f = fixture();
  try {
    await f.drive();
    const roots = f.neighbour.root.children.filter(root => root.name.includes(':l1/'));
    expect(roots.length).toBeGreaterThan(0);
    const pending = f.registration.enterOffered('home', f.resident, camera);
    for (const root of roots) expect(root.parent).toBe(f.neighbour.root);
    await f.drive(); await pending;
    for (const root of roots) expect(root.parent).toBe(f.neighbour.root);
    expect(f.coverage(f.neighbour.root)).toEqual(Array.from({ length: 64 }, () => 1));
  } finally { f.scope.dispose(); }
  expect(f.pins()).toBe(0); expect(f.allocator.entries()).toHaveLength(0);
});

test('failed preparation and page disposal release registrations and their real leases', async () => {
  const f = fixture(true, true);
  try {
    const pending = f.registration.enter('home', f.entered, f.resident, camera), refused = expect(pending).rejects.toThrow('Fixture preparation refused');
    await f.drive(); await refused;
    expect(f.registration.owns('home')).toBe(false); expect(f.instances.get('home')?.root).toBe(f.neighbour.root);
    expect(f.entered.root.children).toHaveLength(0);
  } finally { f.scope.dispose(); }
  expect(f.pins()).toBe(0); expect(f.allocator.entries()).toHaveLength(0);
});

test('pending retirement refuses readiness, restores ownership and cannot publish late work', async () => {
  const f = fixture();
  try {
    const pending = f.registration.enter('home', f.entered, f.resident, camera), refused = expect(pending).rejects.toThrow('released');
    f.resident.dispose(); await refused; await f.drive();
    expect(f.entered.root.children).toHaveLength(0); expect(f.instances.get('home')?.root).toBe(f.neighbour.root);
    const closed = new Scope('closed'); closed.dispose();
    await expect(f.registration.enter('home', f.entered, closed, camera)).rejects.toThrow('owner left');
  } finally { f.scope.dispose(); }
  expect(f.pins()).toBe(0); expect(f.allocator.entries()).toHaveLength(0);
});

test('standalone publication uses the same leased ports, then advances only from its late callback', async () => {
  const f = fixture(), library = { tiles: new Map<string, Object3D>(), panels: new Map<string, Object3D>(), models: new Map<string, Object3D>(), far: null, disposeTile: () => undefined };
  let late: (() => void) | undefined, pauses = 0;
  try {
    const world = await standaloneClientTiles(f.entered, f.scope, {
      instance: 'solo', budget: { reserve: claim => f.allocator.reserve(claim), now: () => 0 }, start: camera, radius: () => 1,
      library: () => Promise.resolve(library), viewer: () => camera, frame: run => { late = run; },
      pause: () => { if (++pauses > 300) throw new Error('Fixture failed to settle'); return Promise.resolve(); },
    });
    expect(pauses).toBeGreaterThan(0); expect(world.props).toBe(library); expect(world.fine.size).toBe(9);
    expect(f.coverage(f.entered.root)).toEqual(Array.from({ length: 64 }, () => 1));
    expect(f.allocator.entries().filter(row => row.category === 'l1')).toHaveLength(16);
    if (late === undefined) throw new Error('Missing standalone frame callback');
    for (let frame = 0; frame < 25; frame++) {
      const before = f.entered.root.children.length;
      late(); await Promise.resolve();
      expect(f.entered.root.children.length - before).toBeLessThanOrEqual(1);
    }
    f.scope.dispose(); late(); expect(f.entered.root.children).toHaveLength(0);
  } finally { f.scope.dispose(); }
  expect(f.pins()).toBe(0); expect(f.allocator.entries()).toHaveLength(0);
});

test('standalone budget refusal fails immediately and releases its half-built owner', async () => {
  const f = fixture(), baseline = f.scope.census;
  let pauses = 0, libraryClosed = false;
  try {
    await expect(standaloneClientTiles(f.entered, f.scope, {
      instance: 'solo', budget: { reserve: () => null, now: () => 0 }, start: camera, radius: () => 1,
      library: owner => { owner.onDispose(() => { libraryClosed = true; }); return Promise.resolve(null); },
      viewer: () => camera, frame: () => { throw new Error('Failed owner must not register a frame'); },
      pause: () => { pauses++; return Promise.resolve(); },
    })).rejects.toThrow('Home tile residency admission deferred');
    expect(pauses).toBe(1); expect(libraryClosed).toBe(true); expect(f.scope.census).toEqual(baseline);
  } finally { f.scope.dispose(); }
  expect(f.pins()).toBe(0); expect(f.allocator.entries()).toHaveLength(0);
});

test('standalone parent retirement during loading forbids later publication or frame registration', async () => {
  const f = fixture();
  try {
    await expect(standaloneClientTiles(f.entered, f.scope, {
      instance: 'solo', budget: { reserve: claim => f.allocator.reserve(claim), now: () => 0 }, start: camera, radius: () => 1,
      library: () => Promise.resolve(null), viewer: () => camera,
      frame: () => { throw new Error('Retired owner must not register a frame'); },
      pause: () => { f.scope.dispose(); return Promise.resolve(); },
    })).rejects.toThrow('Standalone tile owner left');
    expect(f.entered.root.children).toHaveLength(0);
  } finally { f.scope.dispose(); }
  expect(f.pins()).toBe(0); expect(f.allocator.entries()).toHaveLength(0);
});

test('standalone failure preserves its original error and cleanup diagnostics', async () => {
  const f = fixture();
  try {
    const error: unknown = await standaloneClientTiles(f.entered, f.scope, {
      instance: 'solo', budget: f.allocator, start: camera, radius: () => 1, viewer: () => camera,
      library: owner => { owner.onDispose(() => { throw new Error('Fixture cleanup refused'); }); return Promise.reject(new Error('Fixture library refused')); },
      frame: () => { throw new Error('Failed owner must not register a frame'); }, pause: () => Promise.resolve(),
    }).catch((failure: unknown) => failure);
    expect(error).toBeInstanceOf(AggregateError);
    expect(disposalErrorMessages(error)).toEqual(['Fixture library refused', 'Fixture cleanup refused']);
  } finally { f.scope.dispose(); }
  expect(f.pins()).toBe(0); expect(f.allocator.entries()).toHaveLength(0);
});

test('invalid standalone instance data releases the construction scope before library work', async () => {
  const f = fixture(), baseline = f.scope.census;
  try {
    await expect(standaloneClientTiles(f.entered, f.scope, {
      instance: '', budget: f.allocator, start: camera, radius: () => 1, viewer: () => camera,
      library: () => { throw new Error('Invalid instance must not build a library'); },
      frame: () => { throw new Error('Invalid instance must not register a frame'); }, pause: () => Promise.resolve(),
    })).rejects.toThrow('Invalid ring cells');
    expect(f.scope.census).toEqual(baseline);
  } finally { f.scope.dispose(); }
  expect(f.pins()).toBe(0); expect(f.allocator.entries()).toHaveLength(0);
});
