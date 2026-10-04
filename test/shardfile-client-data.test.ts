import { expect, it } from 'vitest';
import { App } from '../src/engine/app/app';
import { Scope } from '../src/engine/app/scope';
import { terrainTileCost } from '../src/engine/world/terrainTileData';
import { ClientAssets } from '../src/game/shardfile/clientAssets';
import { clientSimStep } from '../src/game/shardfile/clientStep';
import { clientWorld } from '../src/game/shardfile/clientWorld';
import { terrainResidency, tileDistance } from '../src/game/shardfile/residency';
import type { ProductOptions } from '../src/game/shardfile/product';
import { emptyShardfile } from '../src/sdk/author';
import { contentHash } from '../src/sdk/project';

it('the normal Game driver calls the embedded simulation exactly once per fixed step, after the player', () => {
  const app = new App(), scope = app.engineScope.child('client'), calls: string[] = [];
  let free = false;
  const driver = clientSimStep({ app, scope, freeCamera: () => free, system: (system) => { app.addSystem(system, scope); } });
  const remove = driver(() => { calls.push('sim'); });
  app.addSystem({ id: 'player.step', phase: 'fixed.post', run: () => { calls.push('player'); } }, scope);
  const fixed = () => { for (const phase of ['fixed.pre', 'fixed.step', 'fixed.post'] as const) for (const system of app.systemsByPhase()[phase]) if (system.when?.(app) !== false) system.run(1 / 60, 0); };
  app.setState('play'); fixed(); fixed(); expect(calls).toEqual(['player', 'sim', 'player', 'sim']);
  app.setState('paused'); fixed(); free = true; app.setState('play'); fixed();
  expect(calls.filter((call) => call === 'sim')).toHaveLength(2);
  free = false; remove(); fixed(); expect(calls.filter((call) => call === 'sim')).toHaveLength(2);
  expect(() => driver(() => undefined)).toThrow('already installed');
  scope.dispose(); expect(app.systemIds(scope)).toEqual([]); app.engineScope.dispose();
});

it('resident refinement masks exactly the replaced quadrants and fits the charged 40-tile maximum', () => {
  for (let z = -250; z <= 250; z += 12.5) for (let x = -250; x <= 250; x += 12.5) {
    const selection = terrainResidency(x, z);
    expect(selection.fine.size).toBeLessThanOrEqual(40);
    expect([...selection.masks.values()].reduce((count, mask) => count + mask.size, 0)).toBe(selection.fine.size);
    for (const key of selection.shadows) {
      const [, tx, tz] = key.split('/').map(Number);
      if (tx === undefined || tz === undefined) throw new Error('Invalid tile');
      expect(tileDistance(x, z, tx, tz, 62.5)).toBeLessThanOrEqual(80);
    }
  }
  expect(() => terrainResidency(Number.NaN, 0)).toThrow();
  expect(terrainResidency(0, 0).shadows.size).toBeGreaterThanOrEqual(4);
});

it('charges the terrain construction peak and GPU indices independently', () => {
  const resolution = 33, vertices = resolution ** 2, cells = (resolution - 1) ** 2;
  const cost = terrainTileCost({ resolution, x: -250, z: -250, size: 62.5, heights: new Float32Array(vertices), colours: new Float32Array(vertices * 3) });
  const skirts = 4 * (resolution - 1), indices = (cells * 6 + skirts * 6) * 2;
  expect(cost).toEqual({ decoded: 32 + vertices * 68 + skirts * 36 + indices, gpu: (vertices + skirts) * 36 + indices, triangles: cells * 2 + skirts * 2, draws: 2 });
});

function residentFixture() {
  const source = emptyShardfile({ slug: 'resident-test', name: 'Resident', author: 'Local', revision: 1, seed: 1 });
  const tile = new Uint8Array([1, 2, 3]), library = new Uint8Array([4, 5, 6]), tileHash = contentHash(tile), libraryHash = contentHash(library);
  for (const hash of [tileHash, libraryHash]) source.files.push({ hash, kind: 'binary', compressed: 3, decoded: 3, gpu: 0, triangles: 0, draws: 0, dependencies: [], critical: false });
  source.library.push(libraryHash);
  const cached = new Map([[tileHash, tile], [libraryHash, library]]);
  const options: ProductOptions = { base: 'https://example.test/resident/', offline: true, firstParty: false,
    hash: (bytes) => Promise.resolve(contentHash(bytes)), fetch: () => Promise.reject(new Error('Offline must never fetch')),
    cache: { product: () => Promise.resolve(null), asset: (_base, hash) => Promise.resolve(cached.get(hash) ?? null), putAsset: () => Promise.resolve(), putProduct: () => Promise.resolve() },
  };
  return { assets: new ClientAssets(source, cached, options), cached, tile, tileHash, libraryHash, source, options };
}
it('releases tile transport bytes, retains library roots and rechecks cache corruption on revisit', async () => {
  const fixture = residentFixture(); fixture.assets.releaseTiles();
  expect([...fixture.assets.retained.keys()]).toEqual([fixture.libraryHash]);
  expect(await fixture.assets.read(fixture.tileHash)).toEqual(fixture.tile);
  expect(fixture.assets.retained.has(fixture.tileHash)).toBe(false);
  fixture.cached.set(fixture.tileHash, new Uint8Array(3));
  await expect(fixture.assets.read(fixture.tileHash)).rejects.toThrow('hash or size');
  await expect(fixture.assets.read('a'.repeat(64))).rejects.toThrow('Undeclared');
});
it('fails an evicted offline tile without touching the network', async () => {
  const fixture = residentFixture(); fixture.assets.releaseTiles(); fixture.cached.delete(fixture.tileHash);
  await expect(fixture.assets.read(fixture.tileHash)).rejects.toThrow('Missing cached');
});
it('leases library roots separately from resident tiles and releases both at their respective lifetimes', () => {
  const f = residentFixture(), cache = f.options.cache; if (cache === undefined) throw new Error('Missing fixture cache');
  const active = new Map<string, number>();
  cache.pin = (hashes) => {
    const keys = [...hashes]; for (const hash of keys) active.set(hash, (active.get(hash) ?? 0) + 1);
    return () => { for (const hash of keys) { const next = (active.get(hash) ?? 0) - 1; if (next === 0) active.delete(hash); else active.set(hash, next); } };
  };
  const assets = new ClientAssets(f.source, f.cached, f.options), level = assets.pin();
  expect([...active.keys()]).toEqual([f.libraryHash]);
  const tile = assets.lease([f.tileHash]); expect(active.size).toBe(2);
  tile(); expect([...active.keys()]).toEqual([f.libraryHash]); level(); expect(active.size).toBe(0);
});
it('caches reloaded tile bytes for the next visit and still tolerates a full cache', async () => {
  const f = residentFixture(), cache = f.options.cache; if (cache === undefined) throw new Error('Missing fixture cache');
  f.cached.delete(f.tileHash); let writes = 0;
  const assets = new ClientAssets(f.source, f.cached, { ...f.options, offline: false, fetch: () => Promise.resolve(new Response(Uint8Array.from(f.tile))),
    cache: { ...cache, putAsset: (_base, hash, bytes) => { writes++; expect(hash).toBe(f.tileHash); expect(bytes).toEqual(f.tile); return Promise.resolve(false); } },
  });
  expect(await assets.read(f.tileHash)).toEqual(f.tile); expect(writes).toBe(1); expect(assets.retained.has(f.tileHash)).toBe(false);
});
it('waits for injected coarse coverage and releases the one ring owner when its world unloads', async () => {
  const f = residentFixture(), scope = new Scope('ring-world'); let steps = 0, released = 0;
  const rings = { step: () => { steps++; }, ready: () => steps >= 2, resident: () => ['copy:l0/3/4'], dispose: () => { released++; } };
  const world = await clientWorld(f.source, f.assets, { scope, x: 0, z: 0, rings,
    views: { terrain: () => { throw new Error('Rings own tiles'); }, props: () => { throw new Error('Rings own tiles'); }, library: () => { throw new Error('Fixture has no prop library'); } } });
  expect(steps).toBe(2); expect([...world.fine]).toEqual(['copy:l0/3/4']);
  world.step({ x: 10, z: 20, vx: 3, vz: 4 }); expect(steps).toBe(3);
  scope.dispose(); expect(released).toBe(1); expect(world.fine.size).toBe(0);
});
