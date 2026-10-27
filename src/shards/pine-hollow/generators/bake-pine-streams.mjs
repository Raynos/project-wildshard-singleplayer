#!/usr/bin/env node
// SHARD-PLATFORM G285 (SF72, "bake the code-built worlds"): Pine Hollow's running water baked offline. The generator
// (src/shards/pine-hollow/generators/streams.ts) runs here only, over the Pine level's baked terrain grid (the page's
// heights and normals): `bakeStreamRows` gives the water mesh's raw binary and its rows (the binary's hash and size, the
// counts, the fall's anchors), which the world scene models (bake-world-scene-models.mjs) and the spray puffs
// (sprayPuffs.ts) call. GR8 G23 retired the standalone outputs (streams.bin, streams.json, the streams Scene, its tiles and
// named blobs): their only readers now call this.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { readNativeTerrain } from '@wildshard/sdk/bake/terrain';
import { bakePineStreams } from './streams.ts';

const root = resolve(import.meta.dirname, '../../../..');

/** the bake: the rows and the raw binary */
export function bakeStreamRows() {
  const { bin, rows } = bakePineStreams(pineStreamGround());
  return { rows: { bin: createHash('sha256').update(bin).digest('hex'), bytes: bin.length, ...rows }, bin };
}

/** Original renderer lattice; no active level, terrain service or browser is installed. */
export function pineStreamGround() { return readNativeTerrain(readFileSync(resolve(root, 'public/assets/baked/pine-hollow/terrain.bin'))); }
