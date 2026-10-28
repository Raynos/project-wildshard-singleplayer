#!/usr/bin/env node
// SHARD-PLATFORM W2 C2: Pine Hollow's rain, the static half, baked offline (generators/rainBake.ts): the crowns' cover map
// (from explicit native candidates, ground masks and the retained terrain, without selecting or installing a level)
// and each tier's merged puddle discs over those same terrain samplers. One geometry pack per
// tier (@wildshard/sdk/kit/geometryPack: the puddles' positions, `aWater` and index, then the cover's floats), its 4-byte words in four lanes and
// zlib-compressed, to public/assets/pine-hollow/baked/rain[.phone].bin, and the packs' rows to
// src/shards/pine-hollow/data/rain.json; the page reads them (runtime/looks/rainFx.ts `loadRainBake`). `--check` refuses a
// stale bake.
// Usage: node --experimental-transform-types --import ./scripts/bake-loader.mjs src/shards/pine-hollow/generators/bake-pine-rain.mjs [--check]
import weather from '../data/weatherLook.json' with { type: 'json' };
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { encodeBuildBytes } from '@wildshard/sdk/bake/byteCodec';
import { GeometryPackWriter } from '@wildshard/sdk/kit/geometryPack';
import { readNativeTerrain } from '@wildshard/sdk/bake/terrain';
import { bakePlantedForest, nativeTerrainQueries } from '@wildshard/sdk/bake/forest';
import manifest from '../manifest.json' with { type: 'json' };
import terrainBindings from '../data/terrainBindings.json' with { type: 'json' };
import { pineGeographyRows } from './geographyRows.ts';
import { pineForestRows } from './forestRows.ts';
import { creekWaterAt } from './geography.ts';
import { wildlifeWordLanes as shuffleLanes } from './wildlifeWords.ts';
import { crownCover, puddleGeometry } from './rainBake.ts';

const root = resolve(import.meta.dirname, '../../../..'), check = process.argv.includes('--check');
const { PINE_RAIN } = weather;
const terrain = Uint8Array.from(readFileSync(resolve(root, terrainBindings.terrain))), native = readNativeTerrain(terrain);
const declaredGround = pineGeographyRows().ground;
const { trees } = bakePlantedForest({
  seed: manifest.seed, treeCount: manifest.treeCount, forest: manifest.forest, candidates: pineForestRows(manifest), terrain,
  ground: { seed: declaredGround.terrain.seed, trails: declaredGround.trails, cabinSites: declaredGround.cabinSites,
    pond: declaredGround.pond, water: declaredGround.water },
  variants: manifest.trees.setVariants.map(row => ({ trunkRadius: row.trunk, height: row.height, species: row.species, collider: row.collider })),
});
const N = PINE_RAIN.coverN, half = native.grid.size / 2, seed = manifest.seed;
const cover = crownCover(trees, N, half);
// the page's coverAt: the texel's byte over 255
const coverAt = (x, z) => {
  const i = Math.floor((x + half) / (2 * half) * N), j = Math.floor((z + half) / (2 * half) * N);
  return i < 0 || j < 0 || i >= N || j >= N ? 0 : (cover[j * N + i] ?? 0) / 255;
};
const ground = { ...native, ...nativeTerrainQueries(declaredGround.terrain.seed, {
  trails: declaredGround.trails, cabinSites: declaredGround.cabinSites, pond: declaredGround.pond, streamAt: creekWaterAt,
}, () => declaredGround.water), inChunk: (x, z, margin = 0) => Math.abs(x) <= half - margin && Math.abs(z) <= half - margin };
const rows = {};
let stale = false;
for (const tier of /** @type {const} */ (['phone', 'desktop'])) {
  const pack = new GeometryPackWriter(`pine rain ${tier}`);
  const puddles = puddleGeometry(ground, { seed, phone: tier === 'phone', look: PINE_RAIN.puddles, half, coverAt });
  // the uv (world x / z) and the normals the page rebuilds from the positions: a third of the download
  puddles.deleteAttribute('normal'); puddles.deleteAttribute('uv');
  pack.add(puddles); pack.addFloats(cover, 1);
  rows[tier] = pack.rows();
  const bin = encodeBuildBytes(shuffleLanes(pack.bytes()), 'deflate', 9, 'native');
  const path = resolve(root, `public/assets/pine-hollow/baked/rain${tier === 'phone' ? '.phone' : ''}.bin`);
  if (check) {
    if (!existsSync(path) || Buffer.compare(readFileSync(path), bin) !== 0) { console.error(`Pine rain stale: ${path}`); stale = true; }
  } else { mkdirSync(resolve(path, '..'), { recursive: true }); writeFileSync(path, bin); }
  console.info(`Pine rain (${tier}): ${String(puddles.getAttribute('position').count)} puddle vertices, ${String(trees.length)} trees, ${String(pack.bytes().length)} → ${String(bin.length)} zlib${check ? (stale ? ' STALE' : ' match') : ''}`);
}
const json = `${JSON.stringify(rows)}\n`, rowsPath = resolve(root, 'src/shards/pine-hollow/data/rain.json');
if (check) { if (!existsSync(rowsPath) || readFileSync(rowsPath, 'utf8') !== json) { console.error(`Pine rain rows stale: ${rowsPath}`); stale = true; } }
else writeFileSync(rowsPath, json);
if (stale) process.exitCode = 1;
