// oxlint-disable-next-line import/no-nodejs-modules -- Read original retained renderer terrain, not the physics capture.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Exact byte comparison avoids instrumenting every typed-array element.
import { Buffer } from 'node:buffer';
import { expect, it } from 'vitest';
import * as v from 'valibot';
import { bakeTerrain, readNativeTerrain } from '@wildshard/sdk/bake/terrain';
import { emptyShardfile } from '@wildshard/sdk/author';
import { validateProject } from '@wildshard/sdk/project';
import { clientGround } from '../src/game/shardfile/clientGround';
import { ShardfileSchema } from '@wildshard/format/shardSchema';
import { TerrainSchema } from '@wildshard/format/terrain';
import { assetCost, validateTerrainAssets } from '@wildshard/format/product';
import { bilinearTerrainSamplers, decodeTerrainTile, encodeTerrainTile, terrainTileHeight } from '@wildshard/format/terrainTileBytes';
import { bakedSamplers, parseBakedTerrain } from '@wildshard/engine/world/BakedTerrain';
import { driftwoodGroundBytes } from '../src/shards/driftwood-isle/generators/groundRows';
import { TERRAIN_FIXTURE } from './fixtures/shardfile/terrain/source';

it('keeps Pine and Driftwood native renderer samples and placement queries byte-exact', () => {
  const pine = readFileSync('public/assets/baked/pine-hollow/terrain.bin');
  for (const bytes of [pine, driftwoodGroundBytes()]) {
    const original = parseBakedTerrain(Uint8Array.from(bytes).buffer);
    if (original === null) throw new Error('Missing native renderer grid');
    const expected = bakedSamplers(original), authored = readNativeTerrain(bytes);
    expect(Buffer.from(authored.grid.heights.buffer).equals(new Uint8Array(original.heights.buffer))).toBe(true);
    expect(Buffer.from(authored.grid.splat.buffer, authored.grid.splat.byteOffset, authored.grid.splat.byteLength).equals(original.splat)).toBe(true);
    for (let sample = 0; sample < 10000; sample++) {
      const x = ((sample * 137.031) % 620) - 310, z = ((sample * 71.917) % 620) - 310;
      expect(authored.heightAt(x, z)).toBe(expected.heightAt(x, z));
      expect(authored.normalAt(x, z)).toEqual(expected.normalAt(x, z));
      expect(authored.normalAt(x, z, 1.25)).toEqual(expected.normalAt(x, z, 1.25));
      expect(authored.splatAt(x, z)).toEqual(expected.splatAt(x, z));
    }
  }
});

it('owns the supplied view without reading surrounding bytes or allowing later source mutation', () => {
  const original = readFileSync('public/assets/baked/pine-hollow/terrain.bin');
  const surrounding = new Uint8Array(original.length + 37); surrounding.set(original, 17);
  const source = surrounding.subarray(17, 17 + original.length), authored = readNativeTerrain(source);
  const expected = authored.heightAt(12, 34); source.fill(0);
  expect(authored.heightAt(12, 34)).toBe(expected);
});

it('refuses malformed, oversized, nonfinite and truncated native grids before sampling', () => {
  const bytes = readFileSync('public/assets/baked/pine-hollow/terrain.bin');
  expect(() => readNativeTerrain(new Uint8Array(23))).toThrow(/byte cap/u);
  expect(() => readNativeTerrain(new Uint8Array(8_000_001))).toThrow(/byte cap/u);
  const altered = (offset: number, value: number): Uint8Array => {
    const result = Uint8Array.from(bytes); new DataView(result.buffer).setUint32(offset, value, true); return result;
  };
  expect(() => readNativeTerrain(altered(8, 0xffffffff))).toThrow(/grid cap/u);
  expect(() => readNativeTerrain(altered(0, 0))).toThrow(/Invalid native/u);
  expect(() => readNativeTerrain(altered(24, 0x7fc00000))).toThrow(/Invalid native/u);
  expect(() => readNativeTerrain(Uint8Array.from(bytes.subarray(0, 100)))).toThrow(/Invalid native/u);
  const end = 24 + 256 ** 2 * 8;
  if (bytes.length <= end) throw new Error('Missing retained decision log');
  expect(() => readNativeTerrain(altered(end + 12, 0xffffffff))).toThrow(/placement cap/u);
});

it('admits an independently charged bilinear profile without changing any original collider or render payload', () => {
  const native = readNativeTerrain(driftwoodGroundBytes());
  const recipe = { heightAt: () => 0, colourAt: (): [number, number, number] => [0.38, 0.4, 0.42] };
  const base = bakeTerrain(recipe);
  const profiled = bakeTerrain({ ...recipe, sampling: { source: native, datum: -0.8 } });
  expect(profiled.terrain.collider).toBe(base.terrain.collider);
  expect(profiled.tiles).toEqual(base.tiles); expect(profiled.edge).toEqual(base.edge);
  for (const [hash, bytes] of base.assets) expect(Buffer.from(profiled.assets.get(hash) ?? []).equals(bytes)).toBe(true);
  const sampling = profiled.terrain.sampling;
  if (sampling === undefined) throw new Error('Sampling profile omitted');
  const bytes = profiled.assets.get(sampling.file);
  if (bytes === undefined) throw new Error('Sampling bytes omitted');
  const data = decodeTerrainTile(bytes);
  expect(data.resolution).toBe(256);
  expect(Buffer.from(data.heights.buffer).equals(new Uint8Array(native.grid.heights.buffer, native.grid.heights.byteOffset, native.grid.heights.byteLength))).toBe(true);
  expect(Buffer.from(data.splat ?? []).equals(native.grid.splat)).toBe(true);
  expect(Buffer.from(encodeTerrainTile(data)).equals(bytes)).toBe(true);
  const file = profiled.files.find(row => row.hash === sampling.file);
  expect(file).toMatchObject({ kind: 'binary', critical: true, ...assetCost('binary', bytes) });
  expect(assetCost('binary', bytes)).toMatchObject({ gpu: 0, draws: 0, triangles: 0 });
  const source = v.parse(ShardfileSchema, { ...emptyShardfile({ slug: 'profile-fixture', name: 'Profile fixture', author: 'Test', revision: 1, seed: 1337 }),
    terrain: profiled.terrain, files: profiled.files, critical: profiled.critical, tiles: profiled.tiles, edge: profiled.edge,
    look: { families: ['toon'], grade: { exposure: 0, saturation: 1, contrast: 1, lut: null }, clock: 'engine' as const, dayOverride: null, keys: [] },
    budgets: { library: { resident: 0, compressed: 0 }, sim: { resident: 2_000_000, compressed: 1_000_000 }, overlap: 0 },
    serverBudget: { tickMicros: 1000, memory: 2_000_000, entities: 1, commandsPerTick: 1 } });
  expect(() => validateProject(source, profiled.assets)).not.toThrow();
  const ground = clientGround(source, profiled.assets), raw = clientGround(source, profiled.assets, 0);
  for (let sample = 0; sample < 10000; sample++) {
    const x = ((sample * 137.031) % 620) - 310, z = ((sample * 71.917) % 620) - 310;
    expect(ground.heightAt(x, z)).toBe(native.heightAt(x, z) - 0.8);
    expect(raw.heightAt(x, z)).toBe(native.heightAt(x, z));
    expect(ground.normalAt(x, z)).toEqual(native.normalAt(x, z));
    expect(ground.splatAt(x, z)).toEqual(native.splatAt(x, z));
  }
  const ordinary = clientGround({ ...source, terrain: base.terrain }, base.assets);
  const collider = base.assets.get(base.terrain.collider);
  if (collider === undefined) throw new Error('Collider omitted');
  expect(ordinary.heightAt(12, 34)).toBe(terrainTileHeight(decodeTerrainTile(collider), 12, 34));
  expect(ordinary.heightAt(300, 0)).toBe(0);
  // The query lattice creates no collider and never replaces the independently admitted critical collision root.
  expect(profiled.critical).toEqual([base.terrain.collider, sampling.file]);
});

it('refuses missing, uncharged, malformed or incompatible profile references and payloads', () => {
  const native = readNativeTerrain(driftwoodGroundBytes()), baked = bakeTerrain({ ...TERRAIN_FIXTURE, sampling: { source: native } });
  const sampling = baked.terrain.sampling;
  if (sampling === undefined) throw new Error('Sampling profile omitted');
  expect(() => v.parse(TerrainSchema, { ...baked.terrain, sampling: { ...sampling, law: 'unknown' } })).toThrow();
  expect(() => v.parse(TerrainSchema, { ...baked.terrain, sampling: { ...sampling, normalEpsilon: 0 } })).toThrow();
  expect(() => v.parse(TerrainSchema, { ...baked.terrain, sampling: { ...sampling, datum: Infinity } })).toThrow();
  expect(() => validateTerrainAssets(baked.terrain, baked.assets, { ...baked, critical: [baked.terrain.collider] })).toThrow(/critical query/u);
  const missing = new Map(baked.assets); missing.delete(sampling.file);
  expect(() => validateTerrainAssets(baked.terrain, missing, baked)).toThrow(/Missing terrain/u);
  const collider = baked.assets.get(baked.terrain.collider);
  if (collider === undefined) throw new Error('Collider omitted');
  const wrong = new Map(baked.assets); wrong.set(sampling.file, collider);
  expect(() => validateTerrainAssets(baked.terrain, wrong, baked)).toThrow(/bilinear terrain/u);
  const source = v.parse(ShardfileSchema, { ...emptyShardfile({ slug: 'profile-fixture', name: 'Profile fixture', author: 'Test', revision: 1, seed: 1337 }),
    terrain: baked.terrain, files: baked.files, critical: baked.critical, tiles: baked.tiles, edge: baked.edge });
  expect(() => clientGround(source, missing)).toThrow(/Missing admitted terrain sampling/u);
  const bytes = baked.assets.get(sampling.file);
  if (bytes === undefined) throw new Error('Profile omitted');
  const data = decodeTerrainTile(bytes);
  expect(() => bilinearTerrainSamplers(data, 0, 0)).toThrow();
  expect(() => decodeTerrainTile(bytes.subarray(0, -1))).toThrow();
});
