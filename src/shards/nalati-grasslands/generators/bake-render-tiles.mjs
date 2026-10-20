#!/usr/bin/env node
// Nalati's ground as baked L0 render tiles (M2 bakedTiles): the painter mesh over the native WSTR256, cut at the 62.5 m
// tile seams with every painterly channel, written to data/renderTiles.json and assets/<hash> (the shardfile's tiles,
// files and props tiles, generators/product.ts). The painted ground draws them in its own material behind the
// Debug row nalati-grasslands.ground-tiles (game/looks/painterlyLook); off, it draws the one ground mesh as before.
// Run with --experimental-transform-types --import ./scripts/bake-loader.mjs; --check verifies the outputs.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bakeNalatiWorldRows } from './nalatiWorldRows.ts';

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
