import { expect, test } from 'vitest';
import { Scope } from '../src/engine/app/scope';
import { emptyShardfile } from '../src/sdk/author';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { ResidencyAllocator } from '../src/game/grid/allocator';
import { ClientAssets } from '../src/game/shardfile/clientAssets';
import { clientWorld, type ClientWorldViews } from '../src/game/shardfile/clientWorld';
import type { Shardfile } from '../src/format/shardSchema';

function fixture() {
  const source = emptyShardfile({ slug: 'residency-fixture', name: 'Residency', author: 'Test', seed: 1, revision: 1 });
  const scope = new Scope('resident-world'), allocator = new ResidencyAllocator(), wire = new Map<string, Uint8Array>();
  const rows: NonNullable<Shardfile['terrain']>['tiles'] = [];
  for (const lod of [1, 0] as const) {
    const side = lod === 1 ? 4 : 8, size = 500 / side;
    for (let z = 0; z < side; z++) for (let x = 0; x < side; x++) {
      const bytes = new Uint8Array([lod, x, z]), hash = hashImmutableBytes(bytes);
      wire.set(hash, bytes); rows.push({ lod, x, z, file: hash });
      source.files.push({ hash, kind: 'binary', compressed: 3, decoded: 1, gpu: 1, triangles: 0, draws: 1, dependencies: [], critical: false });
      source.tiles.push({ lod, x, z, files: [hash], compressed: 3, decoded: 1, gpu: 1, triangles: 0, draws: 1, geometricError: 0,
        bounds: { min: [-250 + x * size, 0, -250 + z * size], max: [-250 + (x + 1) * size, 0, -250 + (z + 1) * size] } });
    }
  }
  const collider = rows[0]?.file; if (collider === undefined) throw new Error('Missing fixture root');
  source.terrain = { version: 1, family: 'fixture-ground', collider, tiles: rows };
  const live = new Map<string, { excluded: ReadonlySet<number> }>();
  let leases = 0;
  let hold: { enter: () => void; read: () => Promise<Uint8Array | null> } | undefined;
  let currentBytes: Uint8Array | null = null;
  const blockNext = () => {
    let enter: () => void = () => undefined, finish: () => void = () => undefined, refuse: () => void = () => undefined;
    const entered = new Promise<void>(resolve => { enter = resolve; });
    hold = { enter, read: () => new Promise<Uint8Array | null>((resolve, reject) => {
      finish = () => { resolve(currentBytes); }; refuse = () => { reject(new Error('Fixture read failed')); };
    }) };
    return { entered, finish: () => { finish(); }, refuse: () => { refuse(); } };
  };
  const assets = new ClientAssets(source, wire, { base: 'https://example.invalid/', offline: true, firstParty: true,
    fetch: () => Promise.reject(new Error('Unexpected network')), hash: bytes => Promise.resolve(hashImmutableBytes(bytes)), cache: {
      product: () => Promise.resolve(null), putProduct: () => Promise.resolve(), putAsset: () => Promise.resolve(true),
      pin: () => { leases++; return () => { leases--; }; },
      asset: (_base, hash) => {
        const pending = hold; if (pending === undefined) return Promise.resolve(wire.get(hash) ?? null);
        hold = undefined; currentBytes = wire.get(hash) ?? null; const result = pending.read(); pending.enter(); return result;
      },
    } });
  const views: ClientWorldViews = {
    library: () => Promise.reject(new Error('No prop library')), props: () => Promise.reject(new Error('No props')),
    terrain: (bytes, owner) => {
      const [lod, x, z] = bytes; if (lod === undefined || x === undefined || z === undefined) throw new Error('Missing fixture address');
      const key = `${String(lod)}/${String(x)}/${String(z)}`, view: { excluded: ReadonlySet<number> } = { excluded: new Set() };
      live.set(key, view); owner.onDispose(() => { live.delete(key); });
      return { mask: excluded => { view.excluded = new Set(excluded); }, shadow: () => undefined };
    },
  };
  const coverage = (): number[] => Array.from({ length: 64 }, (_, key) => {
    const x = key % 8, z = Math.floor(key / 8), coarse = live.get(`1/${String(Math.floor(x / 2))}/${String(Math.floor(z / 2))}`);
    return Number(coarse !== undefined && !coarse.excluded.has(x % 2 + 2 * (z % 2))) + Number(live.has(`0/${String(x)}/${String(z)}`));
  });
  const load = () => clientWorld(source, assets, { scope, views, x: -200, z: -200, residency: { allocator, owner: 'home' } });
  return { scope, allocator, live, assets, blockNext, load, coverage, leases: () => leases };
}

test('active loader keeps complete coarse coverage while the next fine read is pending', async () => {
  const f = fixture();
  try {
    const world = await f.load(), original = new Set(world.fine), held = f.blockNext();
    expect(f.coverage()).toEqual(Array.from({ length: 64 }, () => 1));
    const refresh = world.refresh(200, 200); await held.entered;
    expect(world.fine).toEqual(original); expect(f.coverage()).toEqual(Array.from({ length: 64 }, () => 1));
    held.finish(); await refresh;
    expect([...world.fine].some(key => !original.has(key))).toBe(true);
    expect(f.coverage()).toEqual(Array.from({ length: 64 }, () => 1));
    expect(f.assets.retained.size).toBe(0);
  } finally { f.scope.dispose(); }
  expect(f.live.size).toBe(0); expect(f.leases()).toBe(0); expect(f.allocator.entries()).toHaveLength(0);
});

test('a failed incoming read preserves old coverage and its next refresh can still progress', async () => {
  const f = fixture();
  try {
    const world = await f.load(), original = new Set(world.fine), claims = f.allocator.entries().length, leases = f.leases();
    const held = f.blockNext(), refresh = world.refresh(200, 200), refused = expect(refresh).rejects.toThrow('Fixture read failed');
    await held.entered; held.refuse(); await refused;
    expect(world.fine).toEqual(original); expect(f.coverage()).toEqual(Array.from({ length: 64 }, () => 1));
    expect(f.allocator.entries()).toHaveLength(claims); expect(f.leases()).toBe(leases);
    await world.refresh(200, 200); expect(f.coverage()).toEqual(Array.from({ length: 64 }, () => 1));
  } finally { f.scope.dispose(); }
  expect(f.live.size).toBe(0); expect(f.leases()).toBe(0); expect(f.allocator.entries()).toHaveLength(0);
});

test('retirement during a fine read releases claims and forbids late view publication', async () => {
  const f = fixture();
  try {
    const world = await f.load(), held = f.blockNext(), refresh = world.refresh(200, 200);
    const refused = expect(refresh).rejects.toThrow('Tile unloaded while reading');
    await held.entered; f.scope.dispose();
    expect(f.live.size).toBe(0); expect(f.leases()).toBe(0); expect(f.allocator.entries()).toHaveLength(0);
    held.finish(); await refused; expect(f.live.size).toBe(0);
  } finally { f.scope.dispose(); }
});
