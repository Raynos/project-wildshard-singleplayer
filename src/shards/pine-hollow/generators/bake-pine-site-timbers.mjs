#!/usr/bin/env node
// SHARD-PLATFORM G285 (SF72, "bake the code-built worlds"): Pine Hollow's zipline landing and creek footbridge built
// offline. The generator (src/shards/pine-hollow/generators/siteTimbers.ts) runs here only, over the Pine level's baked
// terrain grid (the page's heights: both are fitted to the ground under them; the grid carries the level seed, which is
// the timbers' stream): `bakeSiteTimberRows` gives each builder's rows at its site and on the turntable, which the timber
// world carries (bake-pine-lookout.mjs --world). GR8 G22 retired the standalone outputs (site-timbers.bin,
// siteTimbers.json, the site-timbers Scene): nothing read them. GR8 G37: the grid comes from the program's sources.
import { bakeSiteTimbers } from './siteTimbers.ts';
import { readNativeTerrain } from '@wildshard/sdk/bake/terrain';
import { hashImmutableBytes } from '@wildshard/sdk/immutable';
import { TERRAIN_SOURCE } from './pineSources.ts';

/** the bake: the rows and the raw binary, over the page's ground */
export function bakeSiteTimberRows(sources) {
  const { bin, rows } = bakeSiteTimbers(pineTimberGround(sources).heightAt);
  return { rows: { bin: hashImmutableBytes(bin), bytes: bin.length, ...rows }, bin };
}

/** Original renderer lattice, read explicitly with no active world or engine service. */
export function pineTimberGround(sources) { return readNativeTerrain(sources.bytes(TERRAIN_SOURCE)); }

