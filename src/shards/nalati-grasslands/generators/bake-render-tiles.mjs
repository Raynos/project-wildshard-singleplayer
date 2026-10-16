#!/usr/bin/env node
// Offline geometry intake for the painter binding; this does not enable a live tile draw.
// Run with --experimental-transform-types --import ./scripts/bake-loader.mjs.
// --out=<directory> writes renderTiles.json and assets/<hash>; --check verifies that output.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bakeNalatiWorldRows } from './nalatiWorldRows.ts';

const args = process.argv.slice(2), output = args.find(arg => arg.startsWith('--out='))?.slice(6);
if (output === undefined || output.length === 0 || args.some(arg => arg !== '--check' && !arg.startsWith('--out='))) {
  throw new Error('Nalati render tiles require --out=<directory> [--check]');
}
const root = fileURLToPath(new URL('../../../../', import.meta.url));
const native = new Uint8Array(readFileSync(resolve(root, 'public/assets/baked/nalati-grasslands/terrain.bin')));
const product = bakeNalatiWorldRows(native, [], 'nalati.ground');
const { assets, ...rows } = product;
// The material name is a binding slot, never permission to draw the GLB's neutral export material.
const metadata = Buffer.from(`${JSON.stringify({ version: 1, binding: 'runtime-painter', ...rows })}\n`);
const files = new Map([['renderTiles.json', metadata]]);
for (const [hash, bytes] of assets) {
  if (createHash('sha256').update(bytes).digest('hex') !== hash) throw new Error('Nalati render tile differs from its hash');
  files.set(`assets/${hash}`, Buffer.from(bytes));
}
for (const [name, bytes] of files) {
  const path = resolve(output, name);
  if (args.includes('--check')) {
    if (!readFileSync(path).equals(bytes)) throw new Error(`Stale Nalati render tile: ${name}`);
  } else {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, bytes);
  }
}
console.info(JSON.stringify({ tiles: product.tiles.length, files: assets.size,
  bytes: [...assets.values()].reduce((sum, bytes) => sum + bytes.byteLength, 0), output: resolve(output), live: false }));
