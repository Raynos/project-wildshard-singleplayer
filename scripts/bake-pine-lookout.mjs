#!/usr/bin/env node
// SHARD-PLATFORM G285 (SF72, "bake the code-built worlds"): Pine Hollow's fire lookout built offline. The generator
// (src/shards/pine-hollow/generators/fireLookout.ts) runs here only, with the Pine level selected (the timber's stream is
// the level seed's), and writes what the builder leaves (each material's parts and the glass as float32 attribute blocks,
// their 4-byte words' bytes in four lanes and zlib-compressed) to public/assets/pine-hollow/baked/lookout.bin, and the
// rows (the binary's hash and size, the part counts, colliders, deck floors and anchors) to
// src/shards/pine-hollow/data/lookout.json, which the page finishes the timber from (src/shards/pine-hollow/models/fireLookout.ts).
// test/shards/pine-hollow/lookout-bake.test.ts is the stale gate (it re-runs the generator).
// Usage: node --experimental-transform-types --import ./scripts/bake-loader.mjs scripts/bake-pine-lookout.mjs
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { deflateSync } from 'node:zlib';
import { setActiveChunk } from '../src/game/shard/registry.ts';
import { bakeFireLookout } from '../src/shards/pine-hollow/generators/fireLookout.ts';
import { shuffleLanes } from '../src/shards/pine-hollow/generators/crags.ts';

const root = resolve(import.meta.dirname, '..');

/** the bake: the rows and the raw binary, the Pine level selected (its seed is the engine SEED, as on the page) */
export function bakeLookoutRows() {
  setActiveChunk('pine-hollow');
  const { bin, rows } = bakeFireLookout();
  return { rows: { bin: createHash('sha256').update(bin).digest('hex'), bytes: bin.length, ...rows }, bin };
}

if (import.meta.main) {
  const { rows, bin } = bakeLookoutRows();
  const out = resolve(root, 'public/assets/pine-hollow/baked');
  mkdirSync(out, { recursive: true });
  const packed = deflateSync(shuffleLanes(bin), { level: 9 });
  writeFileSync(resolve(out, 'lookout.bin'), packed);
  writeFileSync(resolve(root, 'src/shards/pine-hollow/data/lookout.json'), `${JSON.stringify(rows)}\n`);
  console.info(`pine-hollow lookout: ${String(rows.parts.reduce((n, p) => n + p.counts.length, 0))} parts, ${String(rows.glass.length)} panes, ${String(rows.colliders.length)} colliders; ${String(bin.length)} → ${String(packed.length)} zlib (baked/lookout.bin)`);
}
