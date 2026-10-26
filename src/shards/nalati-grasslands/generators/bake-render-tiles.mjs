#!/usr/bin/env node
// Nalati's ground as baked render tiles (M2 bakedTiles): the painter mesh over the native WSTR256, cut at the 62.5 m
// tile seams with every painterly channel (64 L0), written to data/renderTiles.json and assets/<hash> (the shardfile's
// tiles, files and props tiles, generators/product.ts); and N1b's far ground, the 16 L1 125 m squares simplified to
// within L1_POLICY's appearance error (1 m, 47 % of the native triangles; drawn only beyond the 5 x 5), packed two to a
// pair GLB as named product files (assets/world-terrain/ground-l1-<x>-<z>.generated.glb, generators/output.ts): not tile
// rows, so they spend none of the shardfile envelope's JSON node budget. The painted ground draws both
// (game/looks/painterlyLook).
// Run with --experimental-transform-types --import ./scripts/bake-loader.mjs; --check verifies the outputs.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { nalatiRenderTileSources } from './renderTileSources.ts';

const args = process.argv.slice(2);
if (args.some(arg => arg !== '--check')) throw new Error('Nalati render tiles take only [--check]');
const root = fileURLToPath(new URL('../../../../', import.meta.url)), project = resolve(root, 'src/shards/nalati-grasslands');
const native = new Uint8Array(readFileSync(resolve(root, 'public/assets/baked/nalati-grasslands/terrain.bin')));
const { files, tiles, nativeGround, bytes: totalBytes } = await nalatiRenderTileSources(native);
for (const [name, bytes] of files) {
  const path = resolve(project, name);
  if (args.includes('--check')) {
    if (!readFileSync(path).equals(bytes)) throw new Error(`Stale Nalati render tile: ${name}`);
  } else {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, bytes);
  }
}
console.info(JSON.stringify({ tiles, files: files.size - 1, nativeGround,
  bytes: totalBytes }));
