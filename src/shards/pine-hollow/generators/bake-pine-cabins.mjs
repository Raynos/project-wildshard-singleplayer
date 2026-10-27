// SHARD-PLATFORM G285 (SF72, "bake the code-built worlds"): Pine Hollow's log buildings baked offline. The generator
// (src/shards/pine-hollow/generators/logCabin.ts) runs here only, over the page's own baked terrain grid
// (public/assets/baked/pine-hollow/terrain.bin). GR8 G25: `pineCabins` gives the geometry binary and its rows (the
// binary's hash and size, the geometries, the buildings) to the cabin scenes, cabin living and the ambience, instead of
// the retired pine-cabins job's baked/cabins.bin and data/cabins.json.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { readNativeTerrain } from '@wildshard/sdk/bake/terrain';
import { bakePineCabins } from './logCabin.ts';

const root = resolve(import.meta.dirname, '../../../..');
/** the page's terrain heights: its baked grid, as the page installs it before the homestead builds */
export function pineCabinHeights() {
  const bytes = readFileSync(resolve(root, 'public/assets/baked/pine-hollow/terrain.bin'));
  return readNativeTerrain(bytes).heightAt;
}

let cabins;
/** The cabins' raw geometry binary and rows, built once per process (about 0.2 s). */
export function pineCabins() {
  if (cabins === undefined) {
    const { bin, rows } = bakePineCabins(pineCabinHeights());
    cabins = { bin, rows: { bin: createHash('sha256').update(bin).digest('hex'), bytes: bin.length, ...rows } };
  }
  return cabins;
}
