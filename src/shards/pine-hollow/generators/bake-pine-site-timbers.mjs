#!/usr/bin/env node
// SHARD-PLATFORM G285 (SF72, "bake the code-built worlds"): Pine Hollow's zipline landing and creek footbridge built
// offline. The generator (src/shards/pine-hollow/generators/siteTimbers.ts) runs here only, over the Pine level's baked
// terrain grid (the page's heights: both are fitted to the ground under them; the grid carries the level seed, which is
// the timbers' stream): `bakeSiteTimberRows` gives each builder's rows at its site and on the turntable, which the timber
// world carries (bake-pine-lookout.mjs --world). GR8 G22 retired the standalone outputs (site-timbers.bin,
// siteTimbers.json, the site-timbers Scene): nothing read them.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { bakeSiteTimbers } from './siteTimbers.ts';
import { readNativeTerrain } from '@wildshard/sdk/bake/terrain';

const root = resolve(import.meta.dirname, '../../../..');

/** the bake: the rows and the raw binary, over the page's ground */
export function bakeSiteTimberRows() {
  const { bin, rows } = bakeSiteTimbers(pineTimberGround().heightAt);
  return { rows: { bin: createHash('sha256').update(bin).digest('hex'), bytes: bin.length, ...rows }, bin };
}

/** Original renderer lattice, read explicitly with no active world or engine service. */
export function pineTimberGround() { return readNativeTerrain(readFileSync(resolve(root, 'public/assets/baked/pine-hollow/terrain.bin'))); }

