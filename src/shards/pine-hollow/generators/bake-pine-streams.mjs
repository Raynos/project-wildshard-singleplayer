#!/usr/bin/env node
// SHARD-PLATFORM G285 (SF72, "bake the code-built worlds"): Pine Hollow's running water baked offline. The generator
// (src/shards/pine-hollow/generators/streams.ts) runs here only, with the Pine level selected and its baked terrain grid
// installed (src/shards/pine-hollow/generators/bake-pine-crags.mjs `installPineGround`: the page's heights and normals), and writes the water mesh,
// its 4-byte words' bytes in four lanes and zlib-compressed, to public/assets/pine-hollow/baked/streams.bin and its rows
// (the binary's hash and size, the counts, the fall's anchors) to src/shards/pine-hollow/data/streams.json, which the page
// reads (src/shards/pine-hollow/world/streams.ts). test/shards/pine-hollow/streams-bake.test.ts is the stale gate.
// Usage: node --experimental-transform-types --import ./scripts/bake-loader.mjs src/shards/pine-hollow/generators/bake-pine-streams.mjs
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { deflateSync } from 'node:zlib';
import { installPineGround } from './bake-pine-crags.mjs';
import { shuffleLanes } from './crags.ts';
import { bakePineStreams } from './streams.ts';

const root = resolve(import.meta.dirname, '../../../..');

/** the bake: the rows and the raw binary */
export function bakeStreamRows() {
  installPineGround();
  const { bin, rows } = bakePineStreams();
  return { rows: { bin: createHash('sha256').update(bin).digest('hex'), bytes: bin.length, ...rows }, bin };
}

if (import.meta.main) {
  const { rows, bin } = bakeStreamRows();
  const out = resolve(root, 'public/assets/pine-hollow/baked');
  mkdirSync(out, { recursive: true });
  const packed = deflateSync(shuffleLanes(bin), { level: 9 });
  writeFileSync(resolve(out, 'streams.bin'), packed);
  writeFileSync(resolve(root, 'src/shards/pine-hollow/data/streams.json'), `${JSON.stringify(rows)}\n`);
  console.info(`pine-hollow streams: ${String(rows.vertices)} vertices, ${String(rows.indices / 3)} triangles, ${String(bin.length)} → ${String(packed.length)} zlib (baked/streams.bin, ${rows.bin.slice(0, 12)})`);
}
