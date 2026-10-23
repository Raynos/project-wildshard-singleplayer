#!/usr/bin/env node
// Nalati's ground as baked render tiles (M2 bakedTiles): the painter mesh over the native WSTR256, cut at the 62.5 m
// tile seams with every painterly channel (64 L0), written to data/renderTiles.json and assets/<hash> (the shardfile's
// tiles, files and props tiles, generators/product.ts); and N1b's far ground, the 16 L1 125 m squares simplified to
// within L1_POLICY's appearance error (1 m, 47 % of the native triangles; drawn only beyond the 5 x 5), packed two to a
// pair GLB as named product files (assets/world-terrain/ground-l1-<x>-<z>.generated.glb, generators/output.ts): not tile
// rows, so they spend none of the shardfile envelope's JSON node budget. The painted ground draws both
// (game/looks/painterlyLook).
// Run with --experimental-transform-types --import ./scripts/bake-loader.mjs; --check verifies the outputs.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bakeNalatiWorldRows } from './nalatiWorldRows.ts';
import { bakeNalatiGroundQuads, nalatiGroundSource } from './nalatiGroundSource.ts';

/** N1b fidelity review (2026-10-23): 0.5 m 61 % / 1 m 47 % / 2 m 32 % of native L1 triangles; 1 m is ~2-3 phone pixels at 125 m. */
const L1_POLICY = { targetRatio: 0.1, maxErrorMetres: 1 };

const args = process.argv.slice(2);
if (args.some(arg => arg !== '--check')) throw new Error('Nalati render tiles take only [--check]');
const root = fileURLToPath(new URL('../../../../', import.meta.url)), project = resolve(root, 'src/shards/nalati-grasslands');
const native = new Uint8Array(readFileSync(resolve(root, 'public/assets/baked/nalati-grasslands/terrain.bin')));
const product = bakeNalatiWorldRows(native, [], 'painterly', undefined, [0]);
const { assets, nativeGround, ...rows } = product;
// the native WSTR stays the query terrain's own file (generators/terrain.ts); only the tile GLBs ship from here
const tiles = new Set(rows.tiles.flatMap(tile => tile.files));
const metadata = Buffer.from(`${JSON.stringify({ version: 1, tiles: rows.tiles, files: rows.files.filter(file => tiles.has(file.hash)), props: rows.props })}\n`);
const files = new Map([['data/renderTiles.json', metadata]]);
for (const quad of await bakeNalatiGroundQuads(nalatiGroundSource(native), L1_POLICY)) {
  // the repo's blob limit (STORAGE.md): each pair stays under 1 MB
  if (quad.bytes.byteLength >= 1_000_000) throw new Error(`Nalati L1 pair ${quad.x}.${quad.z} is ${quad.bytes.byteLength} bytes (>= 1 MB)`);
  files.set(`assets/world-terrain/ground-l1-${quad.x}-${quad.z}.generated.glb`, Buffer.from(quad.bytes));
}
for (const [hash, bytes] of assets) {
  if (!tiles.has(hash)) continue;
  if (createHash('sha256').update(bytes).digest('hex') !== hash) throw new Error('Nalati render tile differs from its hash');
  files.set(`assets/${hash}`, Buffer.from(bytes));
}
for (const [name, bytes] of files) {
  const path = resolve(project, name);
  if (args.includes('--check')) {
    if (!readFileSync(path).equals(bytes)) throw new Error(`Stale Nalati render tile: ${name}`);
  } else {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, bytes);
  }
}
console.info(JSON.stringify({ tiles: rows.tiles.length, files: files.size - 1, nativeGround: nativeGround.file,
  bytes: [...files.values()].reduce((sum, bytes) => sum + bytes.byteLength, 0) }));
