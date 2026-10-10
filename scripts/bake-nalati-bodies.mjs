#!/usr/bin/env node
// SHARD-PLATFORM M3 (Nalati's 80/20, the species bodies bake): the horse-family and canid lofts built offline. The generator
// (src/shards/nalati-grasslands/generators/bodies.ts) runs here only and writes every body's attribute and index bytes, its
// 4-byte words' bytes in four lanes and zlib-compressed, to public/assets/nalati/baked/bodies.bin and its rows (the binary's
// hash and size, each body's bones, dims and geometry layout) to src/shards/nalati-grasslands/data/bodies.json, which the
// page reads (src/shards/nalati-grasslands/species/bodies.ts `preloadNalatiBodies`).
// test/shards/nalati-grasslands/bodies-bake.test.ts is the stale gate.
// Usage: node --experimental-transform-types --import ./scripts/bake-loader.mjs scripts/bake-nalati-bodies.mjs
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { deflateSync } from 'node:zlib';
import { bakeNalatiBodies } from '../src/shards/nalati-grasslands/generators/bodies.ts';

const root = resolve(import.meta.dirname, '..');

/** The binary in four byte lanes (every word's first bytes, then its second …): floats compress better so. */
export function shuffleBodyLanes(bin) {
  if (bin.length % 4 !== 0) throw new Error('[nalati bodies] the bake is not whole words');
  const n = bin.length / 4, out = new Uint8Array(bin.length);
  for (let i = 0; i < n; i++) for (let b = 0; b < 4; b++) out[b * n + i] = bin[i * 4 + b] ?? 0;
  return out;
}

/** the bake: the rows and the raw binary */
export function bakeBodyRows() {
  const { bin, rows } = bakeNalatiBodies();
  return { rows: { bin: createHash('sha256').update(bin).digest('hex'), bytes: bin.length, ...rows }, bin };
}

if (import.meta.main) {
  const { rows, bin } = bakeBodyRows();
  const out = resolve(root, 'public/assets/nalati/baked');
  mkdirSync(out, { recursive: true });
  const packed = deflateSync(shuffleBodyLanes(bin), { level: 9 });
  writeFileSync(resolve(out, 'bodies.bin'), packed);
  writeFileSync(resolve(root, 'src/shards/nalati-grasslands/data/bodies.json'), `${JSON.stringify(rows)}\n`);
  console.info(`nalati bodies: ${String(rows.bodies.length)} bodies, ${String(bin.length)} → ${String(packed.length)} zlib (baked/bodies.bin, ${rows.bin.slice(0, 12)})`);
}
