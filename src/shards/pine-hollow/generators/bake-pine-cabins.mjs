// SHARD-PLATFORM G285 (SF72, "bake the code-built worlds"): Pine Hollow's log buildings baked offline. The generator
// (src/shards/pine-hollow/generators/logCabin.ts) runs here only, over the page's own baked terrain grid
// (public/assets/baked/pine-hollow/terrain.bin). GR8 G25: `pineCabins` gives the geometry binary and its rows (the
// binary's hash and size, the geometries, the buildings) to the cabin scenes, cabin living and the ambience, instead of
// the retired pine-cabins job's baked/cabins.bin and data/cabins.json. D65: the grid comes from the program's sources.
import { hashImmutableBytes } from '@wildshard/sdk/immutable';
import { readNativeTerrain } from '@wildshard/sdk/bake/terrain';
import { bakePineCabins } from './logCabin.ts';
import { TERRAIN_SOURCE, perSources } from './pineSources.ts';

/** the page's terrain heights: its baked grid, as the page installs it before the homestead builds */
export function pineCabinHeights(sources) {
  return readNativeTerrain(sources.bytes(TERRAIN_SOURCE)).heightAt;
}

/** The cabins' raw geometry binary and rows, built once per sources (about 0.2 s). */
export const pineCabins = perSources(sources => {
  const { bin, rows } = bakePineCabins(pineCabinHeights(sources));
  return { bin, rows: { bin: hashImmutableBytes(bin), bytes: bin.length, ...rows } };
});
