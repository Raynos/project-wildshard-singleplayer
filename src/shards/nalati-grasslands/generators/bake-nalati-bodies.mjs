#!/usr/bin/env node
// SHARD-PLATFORM M3 (Nalati's 80/20, the species bodies bake): the horse-family and canid lofts built offline. The generator
// (src/shards/nalati-grasslands/generators/bodies.ts) runs here only and writes every body's attribute and index bytes, its
// 4-byte words' bytes in four lanes and zlib-compressed, to public/assets/nalati/baked/bodies.bin and its rows (the binary's
// hash and size, each body's bones, dims and geometry layout) to src/shards/nalati-grasslands/data/bodies.json, which the
// page reads (src/shards/nalati-grasslands/species/bodies.ts `preloadNalatiBodies`).
// The stale gate: `--check` (bake-check.mjs's node baker `nalati-bodies`, cached on its inputs at the push gate) rebakes
// every body and fails on any byte that differs from the committed rows and binary. The lofts' Math.sin / hypot are
// byte-exact where the bake was made (macOS), so elsewhere --check says so and passes. test/shards/nalati-grasslands/
// bodies-bake.test.ts rebakes a representative pair of bodies and proves the page reads every one back bit-exact.
// Usage: node --experimental-transform-types --import ./scripts/bake-loader.mjs src/shards/nalati-grasslands/generators/bake-nalati-bodies.mjs [--check]
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { deflateSync, inflateSync } from 'node:zlib';
import { bakeNalatiBodies } from './bodies.ts';

const root = resolve(import.meta.dirname, '../../../..');

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

/** The binary from its shipped lanes (every 4-byte word's first bytes, then its second …). */
function unshuffleBodyLanes(lanes) {
  const n = lanes.length / 4, out = new Uint8Array(lanes.length);
  for (let b = 0; b < 4; b++) for (let i = 0; i < n; i++) out[i * 4 + b] = lanes[b * n + i] ?? 0;
  return out;
}

if (import.meta.main) {
  const out = resolve(root, 'public/assets/nalati/baked'), rowsPath = resolve(root, 'src/shards/nalati-grasslands/data/bodies.json');
  if (process.argv.includes('--check')) {
    if (process.platform !== 'darwin') { console.info('bake-nalati-bodies: --check skipped (the lofts are byte-exact on macOS, where the bake is made)'); process.exit(0); }
    const { rows, bin } = bakeBodyRows();
    const committed = readFileSync(rowsPath, 'utf8'), shipped = unshuffleBodyLanes(new Uint8Array(inflateSync(readFileSync(resolve(out, 'bodies.bin')))));
    const sameBin = shipped.length === bin.length && shipped.every((v, i) => v === bin[i]);
    if (committed !== `${JSON.stringify(rows)}\n` || !sameBin) {
      console.error('bake-nalati-bodies: the committed bodies bake is stale (rerun src/shards/nalati-grasslands/generators/bake-nalati-bodies.mjs)');
      process.exit(1);
    }
    console.info(`bake-nalati-bodies: ${String(rows.bodies.length)} bodies byte-exact (${rows.bin.slice(0, 12)})`);
    process.exit(0);
  }
  const { rows, bin } = bakeBodyRows();
  mkdirSync(out, { recursive: true });
  const packed = deflateSync(shuffleBodyLanes(bin), { level: 9 });
  writeFileSync(resolve(out, 'bodies.bin'), packed);
  writeFileSync(rowsPath, `${JSON.stringify(rows)}\n`);
  console.info(`nalati bodies: ${String(rows.bodies.length)} bodies, ${String(bin.length)} → ${String(packed.length)} zlib (baked/bodies.bin, ${rows.bin.slice(0, 12)})`);
}
