import { Group, type Object3D } from 'three';
import { expect, test } from 'vitest';
import { Scope } from '../src/engine/app/scope';
import { TileStreamer } from '../src/engine/world/tileStreamer';
import { emptyShardfile } from '../src/sdk/author';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { ResidencyAllocator } from '../src/game/grid/allocator';
import { TileDecoder } from '../src/game/grid/tileDecoder';
import { ClientAssets } from '../src/game/shardfile/clientAssets';
import { clientRingCatalogue, clientRingPorts, clientTileRegistration, type ClientRingInstance } from '../src/game/shardfile/clientRings';
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
