#!/usr/bin/env node
// SHARD-PLATFORM G285 (SF72, "bake the code-built worlds"): Nine Dragon's layout step (the square, the towers, the Well)
// baked offline. The generator (src/shards/nine-dragon-stack/generators/layout.ts) runs it here with a recording stand-in
// for the sign builder and writes the filled build context, zlib-compressed, to public/assets/nine-dragon/baked/layout.bin,
// and its stamp (the inflated binary's hash and size) to src/shards/nine-dragon-stack/data/layout.json; the page restores
// it (src/shards/nine-dragon-stack/world/layoutBake.ts). test/shards/nine-dragon-stack/layout-bake.test.ts is the stale gate.
// Usage: node --experimental-transform-types --import ./scripts/bake-loader.mjs scripts/bake-nine-layout.mjs
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { deflateSync } from 'node:zlib';
import { bakeNineLayout } from '../src/shards/nine-dragon-stack/generators/layout.ts';

const root = resolve(import.meta.dirname, '..');

/** the bake's inflated binary and its stamp */
export function nineLayoutBake() {
  const bin = bakeNineLayout();
  return { bin, stamp: { version: 1, bin: createHash('sha256').update(bin).digest('hex'), bytes: bin.length } };
}

if (import.meta.main) {
  const { bin, stamp } = nineLayoutBake();
  const out = resolve(root, 'public/assets/nine-dragon/baked');
  mkdirSync(out, { recursive: true });
  const packed = deflateSync(bin, { level: 9 });
  writeFileSync(resolve(out, 'layout.bin'), packed);
  writeFileSync(resolve(root, 'src/shards/nine-dragon-stack/data/layout.json'), `${JSON.stringify(stamp)}\n`);
  console.info(`nine-dragon layout: ${String(bin.length)} bytes → ${String(packed.length)} zlib (baked/layout.bin, ${stamp.bin.slice(0, 12)})`);
}
