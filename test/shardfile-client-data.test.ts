import { expect, it } from 'vitest';
import { App } from '../src/engine/app/app';
import { terrainTileCost } from '../src/engine/world/terrainTileData';
import { ClientAssets } from '../src/game/shardfile/clientAssets';
import { clientSimStep } from '../src/game/shardfile/clientStep';
import { terrainResidency } from '../src/game/shardfile/residency';
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
      for (const dx of [0, 62.5]) for (const dz of [0, 62.5]) expect(Math.hypot(-250 + tx * 62.5 + dx - x, -250 + tz * 62.5 + dz - z)).toBeLessThanOrEqual(80);
    }
  }
  expect(() => terrainResidency(Number.NaN, 0)).toThrow();
});

it('charges the terrain construction peak and GPU indices independently', () => {
  const resolution = 33, vertices = resolution ** 2, cells = (resolution - 1) ** 2;
  const cost = terrainTileCost({ resolution, x: -250, z: -250, size: 62.5, heights: new Float32Array(vertices), colours: new Float32Array(vertices * 3) });
  expect(cost).toEqual({ decoded: 32 + vertices * 56 + cells * 6 * 2, gpu: vertices * 36 + cells * 6 * 2, triangles: cells * 2, draws: 2 });
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
  return { assets: new ClientAssets(source, cached, options), cached, tile, tileHash, libraryHash };
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
