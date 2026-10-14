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

import { parseGlb } from '@wildshard/sdk/assets';
import { pineTimberWorldBake, pineTimberPlacements } from './timberWorld.ts';
import { bakeSiteTimberRows } from './bake-pine-site-timbers.mjs';
import { bakeCragRows } from './bake-pine-crags.mjs';

const root = resolve(import.meta.dirname, '../../../..');

/** the bake: the rows and the raw binary, the Pine level selected (its seed is the engine SEED, as on the page) */
export function bakeLookoutRows() {
  const { bin, rows } = bakeFireLookout();
  return { rows: { bin: createHash('sha256').update(bin).digest('hex'), bytes: bin.length, ...rows }, bin };
}

/** Original renderer lattice, read explicitly with no active world or engine service. */
export function pineTimberGround() { return readNativeTerrain(readFileSync(resolve(root, 'public/assets/baked/pine-hollow/terrain.bin'))); }

/** Write the admitted world tiles and Explorer library through the same confined launcher. */
async function writeTimberWorld() {
  const crags = await bakeCragRows(), ground = pineTimberGround();
  const baked = pineTimberWorldBake(ground.heightAt, root, { phone: { bin: crags.bins.phone, tiles: crags.rows.skin.phone.tiles }, desktop: { bin: crags.bins.desktop, tiles: crags.rows.skin.desktop.tiles } }, ground);
  const piece = baked.pieces.find(row => row.name === 'pine-timber-explorer'), cabins = baked.pieces.find(row => row.name === 'pine.cabins'), under = baked.pieces.find(row => row.name === 'pine.undergrowth');
  if (piece === undefined || cabins === undefined || under === undefined || baked.props === null) throw new Error('Pine timber Scene omitted its declared sources');
  const library = [piece, cabins, under].map(part => {
    const hash = createHash('sha256').update(part.glb).digest('hex'); baked.assets.set(hash, part.glb);
    const file = { hash, kind: 'glb', compressed: part.glb.length };
    const parsed = Object.assign(file, parseGlb(part.glb));
    return Object.assign(parsed, { dependencies: [], critical: false });
  });
  const props = { ...baked.props.props, wholeLibrary: library.map(file => file.hash) };
  const shardfile = { ...baked.shardfile, library: [...baked.shardfile.library ?? [], ...props.wholeLibrary], files: [...baked.shardfile.files, ...library].sort((a,b) => a.hash.localeCompare(b.hash)) };
  const out = resolve(root, 'src/shards/pine-hollow/assets'); mkdirSync(out, { recursive: true });
  for (const [ref, bytes] of baked.assets) writeFileSync(resolve(out, ref), bytes);
  writeFileSync(resolve(root, 'src/shards/pine-hollow/data/timberWorld.generated.json'), `${JSON.stringify({ scene: baked.sceneHash, props, shardfile, placements: pineTimberPlacements(ground.heightAt), lookout: bakeLookoutRows().rows, sites: bakeSiteTimberRows().rows, cabins: cabins.rows })}\n`);
  console.info(`Pine timber product: ${shardfile.tiles.length} tiles, ${shardfile.files.length} charged files, 3 world copies and 2 library copies`);
}

if (import.meta.main && process.argv.includes('--world')) await writeTimberWorld();
else if (import.meta.main) {
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
