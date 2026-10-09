import { describe, expect, it } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- The stale gate hashes the committed bake's bytes.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- The stale gate reads the committed bake the product ships.
import { readdirSync, readFileSync } from 'node:fs';
import { Group, MeshStandardMaterial } from 'three';
import { Scope } from '../../../src/engine/app/scope';
import { buildTerrain } from '../../../src/engine/world/terrainField';
import { ClientAssets } from '../../../src/game/shardfile/clientAssets';
import { clientViews } from '../../../src/game/shardfile/clientViews';
import { runtimeBoundWorldFiles, withoutRuntimeRows } from '../../../src/game/shardfile/hybridRows';
import { bindRuntimeTerrain } from '../../../src/game/shardfile/runtimeWorld';
import { parseShardfile } from '../../../src/game/shardfile/schema';
import { signalDunesTiles } from '../../../src/shards/sunscar-dunes/generators/tiles';
import { SEED, SPAWN, TOWER, TRAIL } from '../../../src/shards/sunscar-dunes/data/layout';
import { duneHeight } from '../../../src/shards/sunscar-dunes/world/dunes';
import tiles from '../../../src/shards/sunscar-dunes/data/tiles.json' with { type: 'json' };
import source from '../../../src/shards/sunscar-dunes/shard.config';

const folder = new URL('../../../src/shards/sunscar-dunes/assets/', import.meta.url);
const sha = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
const committed = new Map(source.files.map((file) => [file.hash, new Uint8Array(readFileSync(new URL(file.hash, folder)))]));
const options = { base: 'https://shards.test/sunscar-dunes/shard.json', offline: false, firstParty: true,
  fetch: (url: string): Promise<Response> => { const bytes = committed.get(url.split('/').at(-1) ?? ''); return Promise.resolve(bytes === undefined ? new Response(null, { status: 404 }) : new Response(bytes.slice())); },
  hash: (bytes: Uint8Array): Promise<string> => Promise.resolve(sha(bytes)) };

describe('Signal Dunes compiles its dune field into shardfile terrain tiles (SHARD-PLATFORM M3, G227)', () => {
  it('the committed tiles are byte-exact against the generator (the stale gate: rerun scripts/bake-hybrid-tiles.mjs sunscar-dunes)', () => {
    const baked = signalDunesTiles(), { assets, ...metadata } = baked;
    expect(metadata).toEqual(tiles);
    for (const [hash, bytes] of assets) {
      expect(sha(bytes)).toBe(hash);
      expect(sha(committed.get(hash) ?? new Uint8Array())).toBe(hash);
    }
    // the folder holds exactly this bake: no orphan file from an older bake ships in the product
    expect(readdirSync(folder).filter((name) => /^[a-f0-9]{64}$/u.test(name)).sort()).toEqual([...assets.keys()].sort());
    expect([tiles.tiles.length, assets.size, tiles.critical]).toEqual([80, 81, [tiles.terrain.collider]]);
  });

  it('declares the tiles bound by its runtime: the data client sees none of them, and the edge rows are the bake\'s', () => {
    expect(source.runtime?.binds).toContain('terrain');
    expect(source.terrain?.tiles).toHaveLength(80);
    expect(source.edge).toEqual(tiles.edge);
    expect(runtimeBoundWorldFiles(source).size).toBe(81);
    const data = withoutRuntimeRows(source);
    expect([data.terrain, data.tiles.length, data.files.length, data.critical.length, data.library.length]).toEqual([null, 0, 0, 0, 0]);
    // unbound, the same terrain stays the data client's
    const runtime = source.runtime; if (runtime === null) throw new Error('Signal Dunes declares its runtime');
    const unbound = parseShardfile({ ...source, runtime: { ...runtime, binds: (runtime.binds ?? []).filter((section) => section !== 'terrain') } });
    expect(runtimeBoundWorldFiles(unbound).size).toBe(0);
    expect(withoutRuntimeRows(unbound).terrain).toBe(unbound.terrain);
  });

  it('the runtime binds the tiles through the shardfile residency; its collider reads the ground the runtime builds today', async () => {
    const scope = new Scope('sunscar-tiles'), root = new Group(), material = scope.own(new MeshStandardMaterial({ vertexColors: true }));
    try {
      const views = clientViews({ root, terrain: 'pbr', materials: new Map([['pbr', material]]), textures: new Map() });
      const terrain = await bindRuntimeTerrain({ scope }, source, { assets: new ClientAssets(source, committed, options), terrain: views.terrain, x: SPAWN.x, z: SPAWN.z });
      expect(terrain.fine.size).toBeGreaterThan(0);
      const field = buildTerrain(SEED, { landscape: duneHeight, trails: TRAIL, cabinSites: [] });
      // on the 1.95 m lattice the collider is exact; between lattice points it is the bilinear of the same samples
      for (const [x, z] of [[-250, -250], [0, 250], [250, 0]] as const) expect(terrain.ground.heightAt(x, z)).toBeCloseTo(field.heightAt(x, z), 4);
      for (const at of [SPAWN, TOWER]) expect(Math.abs(terrain.ground.heightAt(at.x, at.z) - field.heightAt(at.x, at.z))).toBeLessThan(0.15);
      const near = terrain.fine;
      await terrain.refresh(TOWER.x, TOWER.z);
      expect(terrain.fine).not.toEqual(near);
    } finally { scope.dispose(); }
    expect(root.children.filter((child) => child.children.length > 0 || child.name.startsWith('terrain:'))).toHaveLength(0);
  });

  it('refuses a runtime that does not bind the terrain', async () => {
    const runtime = source.runtime; if (runtime === null) throw new Error('Signal Dunes declares its runtime');
    const unbound = parseShardfile({ ...source, runtime: { ...runtime, binds: (runtime.binds ?? []).filter((section) => section !== 'terrain') } });
    const scope = new Scope('unbound');
    try {
      await expect(bindRuntimeTerrain({ scope }, unbound, { assets: new ClientAssets(unbound, committed, options), terrain: () => ({ mask: () => undefined, shadow: () => undefined }), x: 0, z: 0 })).rejects.toThrow('not bound by its runtime');
    } finally { scope.dispose(); }
  });
});
