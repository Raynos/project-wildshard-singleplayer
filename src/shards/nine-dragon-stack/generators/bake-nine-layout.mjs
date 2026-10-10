#!/usr/bin/env node
// SHARD-PLATFORM G285 (SF72, "bake the code-built worlds"): Nine Dragon's layout step (the square, the towers, the Well)
// baked offline. The generator (src/shards/nine-dragon-stack/generators/layout.ts) runs it here with a recording stand-in
// for the sign builder and writes the filled build context, zlib-compressed, to public/assets/nine-dragon/baked/layout.bin,
// and its stamp (the inflated binary's hash and size) to src/shards/nine-dragon-stack/data/layout.json; the page restores
// it (src/shards/nine-dragon-stack/world/layoutBake.ts). test/shards/nine-dragon-stack/layout-bake.test.ts is the stale gate.
// Then the code-built models' geometry and the world's banyan crown (generators/specimens.ts) to baked/specimens.bin,
// stamped in data/specimens.json (world/specimens.ts; stale gate test/shards/nine-dragon-stack/specimens-bake.test.ts).
// Usage: node --experimental-transform-types --import ./scripts/bake-loader.mjs src/shards/nine-dragon-stack/generators/bake-nine-layout.mjs
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { deflateSync } from 'node:zlib';
import { bakeNineLayout } from './layout.ts';
import { bakeNineSpecimens } from './specimens.ts';
import { banyanOut } from '../world/banyanPlan.ts';

const root = resolve(import.meta.dirname, '../../../..');

const stampOf = (bin) => ({ version: 1, bin: createHash('sha256').update(bin).digest('hex'), bytes: bin.length });

/** the bake's inflated binary and its stamp */
export function nineLayoutBake() {
  const bin = bakeNineLayout();
  return { bin, stamp: stampOf(bin) };
}

/** the specimens bake (generators/specimens.ts) over the layout's banyan plan (run the layout first) */
export function nineSpecimensBake() {
  const bins = bakeNineSpecimens(banyanOut.plan?.lumps ?? []);
  const { version: _b, ...boot } = stampOf(bins.boot), { version: _e, ...explorer } = stampOf(bins.explorer);
  return { bins, stamp: { version: 1, boot, explorer } };
}

if (import.meta.main) {
  const { bin, stamp } = nineLayoutBake();
  const out = resolve(root, 'public/assets/nine-dragon/baked');
  mkdirSync(out, { recursive: true });
  const packed = deflateSync(bin, { level: 9 });
  writeFileSync(resolve(out, 'layout.bin'), packed);
  writeFileSync(resolve(root, 'src/shards/nine-dragon-stack/data/layout.json'), `${JSON.stringify(stamp)}\n`);
  console.info(`nine-dragon layout: ${String(bin.length)} bytes → ${String(packed.length)} zlib (baked/layout.bin, ${stamp.bin.slice(0, 12)})`);
  const specimens = nineSpecimensBake();
  for (const [part, file] of [['boot', 'specimens.bin'], ['explorer', 'specimens-explorer.bin']]) {
    const packedPart = deflateSync(specimens.bins[part], { level: 9 });
    writeFileSync(resolve(out, file), packedPart);
    console.info(`nine-dragon specimens (${part}): ${String(specimens.bins[part].length)} bytes → ${String(packedPart.length)} zlib (baked/${file}, ${specimens.stamp[part].bin.slice(0, 12)})`);
  }
  writeFileSync(resolve(root, 'src/shards/nine-dragon-stack/data/specimens.json'), `${JSON.stringify(specimens.stamp)}\n`);
}
