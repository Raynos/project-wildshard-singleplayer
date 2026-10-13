#!/usr/bin/env node
// SHARD-PLATFORM G285 (SF72, "bake the code-built worlds"): Pine Hollow's fire lookout built offline. The generator
// (src/shards/pine-hollow/generators/fireLookout.ts) runs here only, with the Pine level selected (the timber's stream is
// the level seed's), and writes what the builder leaves (each material's parts and the glass as float32 attribute blocks,
// their 4-byte words' bytes in four lanes and zlib-compressed) to public/assets/pine-hollow/baked/lookout.bin, and the
// rows (the binary's hash and size, the part counts, colliders, deck floors and anchors) to
// src/shards/pine-hollow/data/lookout.json, which the page finishes the timber from (src/shards/pine-hollow/models/fireLookout.ts).
// test/shards/pine-hollow/lookout-bake.test.ts is the stale gate (it re-runs the generator).
// Usage: node --experimental-transform-types --import ./src/sdk/bake/source-loader.mjs src/shards/pine-hollow/generators/bake-pine-lookout.mjs
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { deflateSync } from 'node:zlib';
import { readNativeTerrain } from '@wildshard/sdk/bake/terrain';
import { bakeFireLookout } from './fireLookout.ts';
import { pineLookoutBake } from './timberScene.ts';
import { wildlifeWordLanes as shuffleLanes } from './wildlifeWords.ts';

const root = resolve(import.meta.dirname, '../../../..');

/** the bake: the rows and the raw binary, the Pine level selected (its seed is the engine SEED, as on the page) */
export function bakeLookoutRows() {
  const { bin, rows } = bakeFireLookout();
  return { rows: { bin: createHash('sha256').update(bin).digest('hex'), bytes: bin.length, ...rows }, bin };
}

/** Original renderer lattice, read explicitly with no active world or engine service. */
export function pineTimberGround() { return readNativeTerrain(readFileSync(resolve(root, 'public/assets/baked/pine-hollow/terrain.bin'))); }

if (import.meta.main) {
  const { rows, bin } = bakeLookoutRows();
  const authored = pineLookoutBake(pineTimberGround().heightAt, root);
  const out = resolve(root, 'public/assets/pine-hollow/baked');
  mkdirSync(out, { recursive: true });
  const packed = deflateSync(shuffleLanes(bin), { level: 9 });
  writeFileSync(resolve(out, 'lookout.bin'), packed);
  writeFileSync(resolve(root, 'src/shards/pine-hollow/data/lookout.json'), `${JSON.stringify(rows)}\n`);
  const assets = resolve(out, 'lookout'); mkdirSync(assets, { recursive: true });
  for (const [hash, asset] of authored.assets) writeFileSync(resolve(assets, `${hash}.glb`), asset);
  writeFileSync(resolve(root, 'src/shards/pine-hollow/data/lookoutScene.generated.json'), `${JSON.stringify({ scene: authored.sceneHash, props: authored.props?.props, shardfile: authored.shardfile })}\n`);
  console.info(`pine-hollow lookout: ${String(rows.parts.reduce((n, p) => n + p.counts.length, 0))} parts, ${String(rows.glass.length)} panes, ${String(rows.colliders.length)} colliders; ${String(bin.length)} → ${String(packed.length)} zlib (baked/lookout.bin)`);
}
