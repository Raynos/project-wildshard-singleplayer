import { readNativeTerrain } from '@wildshard/sdk/bake/terrain';
import type { NamedBlob } from '@wildshard/sdk/blobs';
import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { TERRAIN_PAINT_SOURCE } from './nalatiGroundSource';
import { terrainSceneBlobs, waterSceneBlob } from './terrainScene';
import { bakeWaterStrips } from './waterStrips';
import { RIVER } from './terrainRecipe';
import { MELT_STREAM } from './layout';

const LATTICE = '/assets/baked/nalati-grasslands/terrain.bin';

/**
 * GR6: Nalati's native terrain draws at build time (the retired nalati-terrain-scene job's bytes): the painted ground and
 * its slab over the native lattice, and the river and brook strips' water mesh, as `world/terrain/ground.glb`,
 * `world/terrain/slab.glb` and `world/water.glb`. The product ships the slab and the water; the map paints all three.
 */
export function nalatiTerrainScene(lattice: Uint8Array): NamedBlob[] {
  const { grid, ...samplers } = readNativeTerrain(lattice), terrain = TERRAIN_PAINT_SOURCE.terrain;
  const field = { ...samplers, grid, trails: () => terrain.trails };
  const water = bakeWaterStrips({ heightAt: samplers.heightAt, river: RIVER, brook: MELT_STREAM, chunkHalf: grid.size / 2 });
  return [...terrainSceneBlobs(field, TERRAIN_PAINT_SOURCE), waterSceneBlob(water)];
}

/** The terrain draws over the lattice read through the build cache. */
export async function nalatiTerrainSceneProgram(ctx: Pick<ProjectGenerationContext, 'cached'>): Promise<NamedBlob[]> {
  const files = await ctx.cached({ id: 'terrain-scene', inputs: [LATTICE] }, inputs => {
    const bytes = inputs.get(LATTICE);
    if (bytes === undefined || bytes.length === 0) throw new Error('Missing Nalati native lattice');
    return new Map([['lattice.bin', bytes]]);
  });
  const lattice = files.get('lattice.bin');
  if (lattice === undefined) throw new Error('Missing Nalati native lattice');
  return nalatiTerrainScene(lattice);
}
