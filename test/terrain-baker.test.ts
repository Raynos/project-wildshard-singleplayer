// oxlint-disable-next-line import/no-nodejs-modules -- The CLI fixture writes a temporary, content-addressed product.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Isolated fixture output directory.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Temporary file paths for the real validate command.
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import * as v from 'valibot';
import { bakeTerrain } from '../src/sdk/bake/terrain';
import { validateProject, contentHash } from '../src/sdk/project';
import { assetCost } from '../src/sdk/assets';
import { emptyShardfile } from '../src/sdk/author';
import { runCli } from '../src/sdk/cli';
import { TerrainSchema, validateTerrainAssets } from '../src/game/shardfile/terrain';
import { decodeTerrainTile, encodeTerrainTile, terrainTileHeight } from '../src/engine/world/terrainTileData';
import { addBakedTerrainCollider } from '../src/engine/physics/terrainTiles';
import { Physics } from '../src/engine/physics/Physics';
import { loadRapier } from '../src/engine/physics/rapier';
import { Scope } from '../src/engine/app/scope';
import { Rng } from '../src/engine/core/rng';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';
import { TERRAIN_FIXTURE } from './fixtures/shardfile/terrain/source';

const baked = bakeTerrain(TERRAIN_FIXTURE);
const temporary: string[] = [];
afterAll(() => { for (const dir of temporary) rmSync(dir, { recursive: true }); });
const colliderBytes = (): Uint8Array => { const bytes = baked.assets.get(baked.terrain.collider); if (bytes === undefined) throw new Error('Fixture collider missing'); return bytes; };
const product = () => ({ ...emptyShardfile({ slug: 'terrain-fixture', name: 'Terrain fixture', author: 'Test', revision: 1, seed: 435 }),
  tiles: structuredClone(baked.tiles), files: structuredClone(baked.files), critical: [...baked.critical], edge: structuredClone(baked.edge),
  budgets: { library: { resident: 0, compressed: 0 }, sim: { resident: 600000, compressed: 300000 }, overlap: 0 }, serverBudget: { tickMicros: 1000, memory: 600000, entities: 1, commandsPerTick: 1 } });

describe('terrain baker', () => {
  it('bakes complete L0/L1 grids, bounded actual costs and a critical collider, then validates through the CLI', async () => {
    expect(baked.tiles.filter((t) => t.lod === 0)).toHaveLength(64); expect(baked.tiles.filter((t) => t.lod === 1)).toHaveLength(16);
    expect(baked.assets.size).toBe(81); expect(baked.edge.north.heights).toHaveLength(129);
    expect(baked.tiles.filter((t) => t.lod === 0).every((t) => t.geometricError === 0)).toBe(true);
    expect(baked.tiles.some((t) => t.lod === 1 && t.geometricError > 0.1)).toBe(true);
    expect(() => validateTerrainAssets(baked.terrain, baked.assets, baked)).not.toThrow();
    const shard = validateProject(product(), baked.assets);
    for (const file of baked.files) { const bytes = baked.assets.get(file.hash); if (bytes === undefined) throw new Error('Missing file'); expect(assetCost(file.kind, bytes)).toEqual({ decoded: file.decoded, gpu: file.gpu, triangles: file.triangles, draws: file.draws }); }
    const dir = mkdtempSync(join(tmpdir(), 'terrain-baker-'));
    temporary.push(dir);
    writeFileSync(join(dir, 'shard.json'), JSON.stringify(shard));
    for (const [hash, bytes] of baked.assets) writeFileSync(join(dir, hash), bytes);
    await runCli(['validate', join(dir, 'shard.json')]);
  });
  it('produces byte-identical products and applies a hand override to collision and both render LODs', () => {
    const again = bakeTerrain(TERRAIN_FIXTURE);
    expect(again.tiles).toEqual(baked.tiles); expect([...again.assets.keys()]).toEqual([...baked.assets.keys()]);
    for (const [hash, bytes] of again.assets) expect(contentHash(bytes)).toBe(hash);
    const ground = decodeTerrainTile(colliderBytes()); expect(terrainTileHeight(ground, 0, 0)).toBe(4);
    for (const lod of [0, 1]) {
      const tile = baked.terrain.tiles.find((t) => t.lod === lod && t.x === (lod === 0 ? 4 : 2) && t.z === (lod === 0 ? 4 : 2));
      const bytes = tile === undefined ? undefined : baked.assets.get(tile.file); if (bytes === undefined) throw new Error('Override tile');
      expect(terrainTileHeight(decodeTerrainTile(bytes), 0, 0)).toBe(4);
    }
  });
  it('refuses missing/duplicate addresses, malformed binary, generator values and understated errors or costs', () => {
    expect(() => v.parse(TerrainSchema, { ...baked.terrain, tiles: baked.terrain.tiles.slice(1) })).toThrow();
    const duplicate = structuredClone(baked.terrain), first = duplicate.tiles[0]; if (first === undefined) throw new Error('First tile'); duplicate.tiles[1] = first; expect(() => v.parse(TerrainSchema, duplicate)).toThrow();
    expect(() => decodeTerrainTile(colliderBytes().subarray(0, 32))).toThrow();
    const bad = colliderBytes().slice(); new DataView(bad.buffer).setUint16(6, 65535, true); expect(() => decodeTerrainTile(bad)).toThrow();
    const nan = colliderBytes().slice(); new DataView(nan.buffer).setFloat32(32, Number.NaN, true); expect(() => decodeTerrainTile(nan)).toThrow();
    expect(() => bakeTerrain({ ...TERRAIN_FIXTURE, heightAt: () => Infinity })).toThrow();
    expect(() => bakeTerrain({ ...TERRAIN_FIXTURE, colourAt: () => [2, 0, 0] })).toThrow();
    expect(() => bakeTerrain({ ...TERRAIN_FIXTURE, overrides: [{ x: 0, z: 0, height: 0, radius: 0, mode: 'replace' }] })).toThrow();
    const error = structuredClone(baked.tiles); const coarse = error.find((t) => t.lod === 1 && t.geometricError > 0); if (coarse === undefined) throw new Error('Coarse tile'); coarse.geometricError = 0;
    expect(() => validateTerrainAssets(baked.terrain, baked.assets, { ...baked, tiles: error })).toThrow('error understated');
    const cheaper = product(); const file = cheaper.files.find((f) => !f.critical); if (file === undefined) throw new Error('Render file'); file.gpu = 0;
    expect(() => validateProject(cheaper, baked.assets)).toThrow('cost declaration understated');
  });
  it('rejects render/collider drift and edge profiles that disagree with the heightfield', () => {
    const ref = baked.terrain.tiles[0]?.file; if (ref === undefined) throw new Error('First tile');
    const data = decodeTerrainTile(baked.assets.get(ref) ?? new Uint8Array()); data.heights[0] = 1;
    const wrong = new Map(baked.assets); wrong.set(ref, encodeTerrainTile(data)); expect(() => validateTerrainAssets(baked.terrain, wrong, baked)).toThrow('seam mismatch');
    const edge = structuredClone(baked.edge); edge.north.heights[0] = 5;
    expect(() => validateTerrainAssets(baked.terrain, baked.assets, { ...baked, edge })).toThrow('edge profile mismatch');
    const colourData = decodeTerrainTile(baked.assets.get(ref) ?? new Uint8Array()); if (colourData.colours === undefined) throw new Error('Tile colours'); colourData.colours[0] = 0;
    const colourAssets = new Map(baked.assets); colourAssets.set(ref, encodeTerrainTile(colourData));
    expect(() => validateTerrainAssets(baked.terrain, colourAssets, baked)).toThrow('edge colour mismatch');
  });
  it('the scoped critical heightfield matches 10,000 ray contacts within 2cm and unloads without a stale collider', async () => {
    const R = await loadRapier(await (await fetch(wasmInline)).arrayBuffer()), physics = new Physics(R), scope = new Scope('terrain-fixture');
    try {
      const collider = addBakedTerrainCollider(physics, colliderBytes(), scope), grid = decodeTerrainTile(colliderBytes());
      physics.world.step(); const rng = new Rng(435); let worst = 0;
      for (let i = 0; i < 10000; i++) {
        const x = rng.range(-249, 249), z = rng.range(-249, 249), hit = physics.world.castRay(new R.Ray({ x, y: 250, z }, { x: 0, y: -1, z: 0 }), 500, true);
        expect(hit).not.toBeNull(); worst = Math.max(worst, Math.abs(250 - (hit?.timeOfImpact ?? 0) - terrainTileHeight(grid, x, z)));
      }
      expect(worst).toBeLessThan(0.02); scope.dispose(); expect(collider.isValid()).toBe(false);
    } finally { scope.dispose(); physics.dispose(); }
  });
});
