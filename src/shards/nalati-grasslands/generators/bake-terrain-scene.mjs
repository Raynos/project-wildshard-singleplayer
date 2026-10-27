#!/usr/bin/env node
// Build the original native draws before config admission; config declares paths only.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseBakedTerrain, bakedSamplers } from '@wildshard/engine/world/BakedTerrain';
import { byteWriter } from '../../../../scripts/bake-output.mjs';
import { TERRAIN_PAINT_SOURCE } from './nalatiGroundSource.ts';
import { terrainSceneBlobs, waterSceneBlob } from './terrainScene.ts';
import { bakeWaterStrips } from './waterStrips.ts';
import { RIVER } from './terrainRecipe.ts';
import { MELT_STREAM } from './layout.ts';

const root = new URL('../../../../', import.meta.url), project = new URL('../', import.meta.url);
const grid = parseBakedTerrain(Uint8Array.from(readFileSync(new URL('public/assets/baked/nalati-grasslands/terrain.bin', root))).buffer);
if (grid === null) throw new Error('Missing native painter lattice');
const terrain = TERRAIN_PAINT_SOURCE.terrain;
const field = { ...bakedSamplers(grid), ready: () => Promise.resolve(true), trails: () => terrain.trails, trailDistance: terrain.trailDistance };
// GR6: the river and brook strips over the same lattice (the retired nalati-water job's heights, byte for byte)
const water = bakeWaterStrips({ heightAt: field.heightAt, river: RIVER, brook: MELT_STREAM, chunkHalf: grid.size / 2 });
const blobs = [...terrainSceneBlobs(field, TERRAIN_PAINT_SOURCE), waterSceneBlob(water)];
const writer = byteWriter(process.argv.includes('--check'), 'nalati-terrain-scene');
for (const blob of blobs) {
  const name = blob.file.name;
  if (name === undefined) throw new Error('Terrain draw requires its logical name');
  const id = name.split('/').at(-1)?.replace('.glb', '');
  if (id === undefined || !['ground', 'slab', 'water'].includes(id)) throw new Error('Unknown native terrain draw');
  writer.put(fileURLToPath(new URL(`assets/world-terrain/${id}.generated.glb`, project)), blob.bytes);
}
writer.finish();
