#!/usr/bin/env node
// SHARD-PLATFORM G285 (SF72, "bake the code-built worlds"): Pine Hollow's procedural wildlife baked offline. The generator
// (src/shards/pine-hollow/generators/wildlife.ts) runs here only and writes the raven's, the owl's, the woodpecker's and the
// hare's geometry, its 4-byte words' bytes in four lanes and zlib-compressed, to public/assets/pine-hollow/baked/wildlife.bin
// and its rows (the binary's hash and size, each kind's counts) to src/shards/pine-hollow/data/wildlife.json, which the page
// reads (src/shards/pine-hollow/models/wildlife.ts `preloadPineWildlife`). test/shards/pine-hollow/wildlife-bake.test.ts is
// the stale gate.
// Usage: node --experimental-transform-types --import ./scripts/bake-loader.mjs scripts/bake-pine-wildlife.mjs
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { deflateSync } from 'node:zlib';
import { shuffleLanes } from '../src/shards/pine-hollow/generators/crags.ts';
import { bakePineWildlife } from '../src/shards/pine-hollow/generators/wildlife.ts';

const root = resolve(import.meta.dirname, '..');

/** the bake: the rows and the raw binary */
export function bakeWildlifeRows() {
  const { bin, rows } = bakePineWildlife();
  return { rows: { bin: createHash('sha256').update(bin).digest('hex'), bytes: bin.length, ...rows }, bin };
}

if (import.meta.main) {
  const { rows, bin } = bakeWildlifeRows();
  const out = resolve(root, 'public/assets/pine-hollow/baked');
  mkdirSync(out, { recursive: true });
  const packed = deflateSync(shuffleLanes(bin), { level: 9 });
  writeFileSync(resolve(out, 'wildlife.bin'), packed);
  writeFileSync(resolve(root, 'src/shards/pine-hollow/data/wildlife.json'), `${JSON.stringify(rows)}\n`);
  console.info(`pine-hollow wildlife: ${rows.kinds.map((k) => `${String(k.kind)}: ${String(k.vertices)} v`).join(', ')}, ${String(bin.length)} → ${String(packed.length)} zlib (baked/wildlife.bin, ${rows.bin.slice(0, 12)})`);
}
