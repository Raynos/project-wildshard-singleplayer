// Author-only byte correspondence for the content report, executed through bake-loader.
import { readFileSync } from 'node:fs';
import * as v from 'valibot';
import { TerrainSchema } from '@wildshard/format/terrain';
import { bilinearTerrainSamplers, decodeTerrainTile, encodeTerrainTile } from '@wildshard/format/terrainTileBytes';
import { readNativeTerrain } from '@wildshard/sdk/bake/terrain';

const input = JSON.parse(readFileSync(0, 'utf8')), terrain = v.parse(TerrainSchema, input.terrain), profile = terrain.sampling;
if (profile === undefined || !Array.isArray(input.aliases)) throw new Error('Missing terrain alias profile');
const bytes = readFileSync(input.payload);
bilinearTerrainSamplers(decodeTerrainTile(bytes), profile.normalEpsilon, profile.datum);
const matched = input.aliases.filter(path => {
  try {
    const legacy = readFileSync(path), native = readNativeTerrain(legacy).grid;
    if (native.undergrowth !== null || legacy.length !== 24 + native.res * native.res * 8) return false;
    const encoded = encodeTerrainTile({ resolution: native.res, x: -250, z: -250, size: native.size,
      heights: native.heights, splat: native.splat });
    return bytes.equals(encoded);
  } catch { return false; }
});
process.stdout.write(JSON.stringify(matched));
