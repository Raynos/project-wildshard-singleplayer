// Driftwood's fixed buildings on their sites (the castaway's hut, the lookout tower) over the same retained terrain
// binding as the native level (original WSTR samples plus its authored datum), their AO answered by the committed voxel
// table as on the page. Explicit function calls only; import selects no world, service or level.
import { readFileSync } from 'node:fs';
import { HeightfieldBinding } from '../../src/engine/world/Heightfield.ts';
import { bakedSamplers, parseBakedTerrain } from '../../src/engine/world/BakedTerrain.ts';
import { addVoxelAOBake } from '../../src/engine/world/voxelAO.ts';
import { toLevelSpec } from '../../src/game/shard/spec.ts';
import { DRIFTWOOD_ISLE, HUT, LOOKOUT } from '../../src/shards/driftwood-isle/manifest.ts';
import { hutBake } from '../../src/shards/driftwood-isle/generators/hut.ts';
import { lookoutBake } from '../../src/shards/driftwood-isle/generators/lookout.ts';
import { islandCoveSpec } from '../../src/shards/driftwood-isle/world/coveLayout.ts';

function onNativeTerrain(build) {
  const bytes = Uint8Array.from(readFileSync(new URL('../../public/assets/baked/driftwood-isle/terrain.bin', import.meta.url)));
  const grid = parseBakedTerrain(bytes.buffer);
  if (grid === null || grid.seed !== DRIFTWOOD_ISLE.seed) throw new Error('Original Driftwood native terrain missing');
  const binding = new HeightfieldBinding(toLevelSpec(DRIFTWOOD_ISLE));
  binding.install(bakedSamplers(grid));
  const ao = Uint8Array.from(readFileSync(new URL('../../public/assets/models/driftwood-blender/voxel-ao.bin', import.meta.url)));
  const release = addVoxelAOBake(ao.buffer);
  try {
    return build(binding.field.heightAt);
  } finally {
    release();
  }
}

/** Bake the hut where the island stands it, against the native height binding. */
export function originalHut() {
  return onNativeTerrain((ground) => hutBake({ x: HUT.x, z: HUT.z, rot: HUT.rot }, ground));
}

/** Bake the lookout on the headland, its zipline pulley facing the sea cave's mouth. */
export function originalLookout() {
  const cave = islandCoveSpec().cave;
  return onNativeTerrain((ground) => lookoutBake({ x: LOOKOUT.x, z: LOOKOUT.z, rot: LOOKOUT.rot }, ground, { x: cave.x, z: cave.z }));
}
