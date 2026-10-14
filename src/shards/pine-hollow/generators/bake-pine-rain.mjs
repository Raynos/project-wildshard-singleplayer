#!/usr/bin/env node
// SHARD-PLATFORM W2 C2: Pine Hollow's rain, the static half, baked offline (generators/rainBake.ts): the crowns' cover map
// (from the forest the page plants: the level selected, its terrain grid installed, `placeForest` on the tree set, as
// scripts/bake-chunk.mjs does) and each tier's merged puddle discs over the page's own Heightfield. One geometry pack per
// tier (@wildshard/sdk/kit/geometryPack: the puddles' positions, `aWater` and index, then the cover's floats), its 4-byte words in four lanes and
// zlib-compressed, to public/assets/pine-hollow/baked/rain[.phone].bin, and the packs' rows to
// src/shards/pine-hollow/data/rain.json; the page reads them (runtime/looks/rainFx.ts `loadRainBake`). `--check` refuses a
// stale bake.
// Usage: node --experimental-transform-types --import ./scripts/bake-loader.mjs src/shards/pine-hollow/generators/bake-pine-rain.mjs [--check]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { deflateSync } from 'node:zlib';
import { GeometryPackWriter } from '@wildshard/sdk/kit/geometryPack';
import { wildlifeWordLanes as shuffleLanes } from './wildlifeWords.ts';
import { crownCover, puddleGeometry } from './rainBake.ts';

const root = resolve(import.meta.dirname, '../../../..'), check = process.argv.includes('--check');
const load = (path) => import(pathToFileURL(resolve(root, path)).href);
const { SHARDS } = await load('src/shards.generated.ts');
const registry = await load('src/game/shard/registry.ts');
const HF = await load('src/engine/world/Heightfield.ts');
const BT = await load('src/engine/world/BakedTerrain.ts');
const placement = await load('src/engine/world/forest/placement.ts');
const config = await load('src/engine/core/config.ts');
const { PINE_RAIN } = await load('src/shards/pine-hollow/data/weatherLook.ts');

const def = SHARDS.find((shard) => shard.slug === 'pine-hollow');
if (def === undefined) throw new Error('bake-pine-rain: no pine-hollow shard');
registry.setActiveChunk(def.slug);
HF._installBakedTerrain(BT.bakedSamplers(BT.parseBakedTerrain(Uint8Array.from(readFileSync(resolve(root, 'public/assets/baked/pine-hollow/terrain.bin'))).buffer)));
const { trees } = placement.placeForest(placement.plantSpecs(def.trees));
const N = PINE_RAIN.coverN, half = config.CHUNK_HALF, seed = config.SEED;
const cover = crownCover(trees, N, half);
// the page's coverAt: the texel's byte over 255
const coverAt = (x, z) => {
  const i = Math.floor((x + half) / (2 * half) * N), j = Math.floor((z + half) / (2 * half) * N);
  return i < 0 || j < 0 || i >= N || j >= N ? 0 : (cover[j * N + i] ?? 0) / 255;
};
const ground = { heightAt: HF.heightAt, normalAt: HF.normalAt, splatAt: HF.splatAt, trailDistance: HF.trailDistance, cabinMask: HF.cabinMask, pondMask: HF.pondMask, streamAt: HF.streamAt, inChunk: HF.inChunk };
const rows = {};
let stale = false;
for (const tier of /** @type {const} */ (['phone', 'desktop'])) {
  const pack = new GeometryPackWriter(`pine rain ${tier}`);
  const puddles = puddleGeometry(ground, { seed, phone: tier === 'phone', look: PINE_RAIN.puddles, half, coverAt });
  // the uv (world x / z) and the normals the page rebuilds from the positions: a third of the download
  puddles.deleteAttribute('normal'); puddles.deleteAttribute('uv');
  pack.add(puddles); pack.addFloats(cover, 1);
  rows[tier] = pack.rows();
  const bin = deflateSync(shuffleLanes(pack.bytes()), { level: 9 });
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
