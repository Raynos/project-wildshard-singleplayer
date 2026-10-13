#!/usr/bin/env node
// SHARD-PLATFORM G285 (SF72, "bake the code-built worlds"): Pine Hollow's procedural wildlife baked offline. The generator
// (src/shards/pine-hollow/generators/wildlife.ts) runs here only and writes the raven's, the owl's, the woodpecker's and the
// hare's geometry, its 4-byte words' bytes in four lanes and zlib-compressed, to public/assets/pine-hollow/baked/wildlife.bin
// and its rows (the binary's hash and size, each kind's counts) to src/shards/pine-hollow/data/wildlife.json, which the page
// reads (src/shards/pine-hollow/models/wildlife.ts `preloadPineWildlife`). test/shards/pine-hollow/wildlife-bake.test.ts is
// the stale gate.
// Usage: node --experimental-transform-types --import ./src/sdk/bake/source-loader.mjs src/shards/pine-hollow/generators/bake-pine-wildlife.mjs
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { deflateSync } from 'node:zlib';
import { wildlifeWordLanes } from './wildlifeWords.ts';
import { bakePineWildlife, pineWildlifeBake } from './wildlife.ts';

const root = resolve(import.meta.dirname, '../../../..');

/** the bake: the rows and the raw binary */
export function bakeWildlifeRows() {
  const { bin, rows } = bakePineWildlife();
  return { rows: { bin: createHash('sha256').update(bin).digest('hex'), bytes: bin.length, ...rows }, bin };
}

if (import.meta.main) {
  const { rows, bin } = bakeWildlifeRows();
  const scene = pineWildlifeBake(root);
  const piece = scene.pieces.find(part => part.name === 'pine.wildlife');
  if (piece === undefined) throw new Error('Wildlife author scene omitted its library');
  const out = resolve(root, 'public/assets/pine-hollow/baked');
  mkdirSync(out, { recursive: true });
  const packed = deflateSync(wildlifeWordLanes(bin), { level: 9 });
  writeFileSync(resolve(out, 'wildlife.bin'), packed);
  writeFileSync(resolve(out, 'wildlife.glb'), piece.glb);
  writeFileSync(resolve(root, 'src/shards/pine-hollow/data/wildlife.json'), `${JSON.stringify(rows)}\n`);
  console.info(`pine-hollow wildlife: ${rows.kinds.map((k) => `${String(k.kind)}: ${String(k.vertices)} v`).join(', ')}, ${String(bin.length)} → ${String(packed.length)} zlib (baked/wildlife.bin, ${rows.bin.slice(0, 12)})`);
}
