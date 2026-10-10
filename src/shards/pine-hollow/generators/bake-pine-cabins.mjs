#!/usr/bin/env node
// SHARD-PLATFORM G285 (SF72, "bake the code-built worlds"): Pine Hollow's log buildings baked offline. The generator
// (src/shards/pine-hollow/generators/logCabin.ts) runs here only, over the page's own baked terrain grid
// (public/assets/baked/pine-hollow/terrain.bin), and writes the geometry binary, zlib-compressed, to
// public/assets/pine-hollow/baked/cabins.bin and its rows (the binary's hash and size, the geometries, the buildings) to
// src/shards/pine-hollow/data/cabins.json, which the page assembles (src/shards/pine-hollow/world/cabinBake.ts).
// test/shards/pine-hollow/cabin-bake.test.ts is the stale gate (it re-runs the generator).
// Usage: node --experimental-transform-types --import ./scripts/bake-loader.mjs src/shards/pine-hollow/generators/bake-pine-cabins.mjs
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { deflateSync } from 'node:zlib';
import { bakedSamplers, parseBakedTerrain } from '../../../engine/world/BakedTerrain.ts';
import { bakePineCabins } from './logCabin.ts';

const root = resolve(import.meta.dirname, '../../../..');
/** the page's terrain heights: its baked grid, as the page installs it before the homestead builds */
export function pineCabinHeights() {
  const bytes = readFileSync(resolve(root, 'public/assets/baked/pine-hollow/terrain.bin'));
  const grid = parseBakedTerrain(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  if (grid === null) throw new Error('bake-pine-cabins: no Pine terrain grid');
  return bakedSamplers(grid).heightAt;
}

if (import.meta.main) {
  const { bin, rows } = bakePineCabins(pineCabinHeights());
  const out = resolve(root, 'public/assets/pine-hollow/baked');
  mkdirSync(out, { recursive: true });
  const packed = deflateSync(bin, { level: 9 });
  writeFileSync(resolve(out, 'cabins.bin'), packed);
  const hash = createHash('sha256').update(bin).digest('hex');
  writeFileSync(resolve(root, 'src/shards/pine-hollow/data/cabins.json'), `${JSON.stringify({ bin: hash, bytes: bin.length, ...rows })}\n`);
  console.info(`pine-hollow cabins: ${String(rows.buildings.length)} buildings, ${String(rows.geometries.length)} geometries, ${String(bin.length)} bytes → ${String(packed.length)} zlib (baked/cabins.bin, ${hash.slice(0, 12)})`);
}
