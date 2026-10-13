#!/usr/bin/env node
// SHARD-PLATFORM G285 (SF72, "bake the code-built worlds"): Pine Hollow's beaver pool meshes laid out offline. The
// generator (src/shards/pine-hollow/generators/beaverPool.ts) uses explicit retained renderer height queries
// (the page's heights: the still surface keeps the ground under each vertex, the trickle rides
// the bed), and writes both meshes' f32-exact blocks to src/shards/pine-hollow/data/beaverPool.json, which the page builds
// them from (src/shards/pine-hollow/world/beaverPool.ts). test/shards/pine-hollow/beaver-pool-bake.test.ts is the stale gate.
// Usage: node --experimental-transform-types --import ./src/sdk/bake/source-loader.mjs src/shards/pine-hollow/generators/bake-pine-beaver-pool.mjs
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { bakeBeaverPool } from './beaverPool.ts';
import { pineCragGround } from './bake-pine-crags.mjs';

const root = resolve(import.meta.dirname, '../../../..');

/** the bake's rows, over the page's ground */
export function bakePoolRows() {
  return bakeBeaverPool(pineCragGround().heightAt);
}

if (import.meta.main) {
  const rows = bakePoolRows();
  writeFileSync(resolve(root, 'src/shards/pine-hollow/data/beaverPool.json'), `${JSON.stringify(rows)}\n`);
  console.info(`pine-hollow beaver pool: still ${String(rows.still.position.length / 3)} v / ${String(rows.still.index.length / 3)} tris, trickle ${String(rows.trickle.position.length / 3)} v / ${String(rows.trickle.index.length / 3)} tris (data/beaverPool.json)`);
}
