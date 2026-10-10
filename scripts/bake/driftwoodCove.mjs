// The same retained terrain binding as the native level: original WSTR samples plus its authored datum.
// Explicit function call only; import selects no world, service or level.
import { readFileSync } from 'node:fs';
import { HeightfieldBinding } from '../../src/engine/world/Heightfield.ts';
import { bakedSamplers, parseBakedTerrain } from '../../src/engine/world/BakedTerrain.ts';
import { addVoxelAOBake } from '../../src/engine/world/voxelAO.ts';
import { toLevelSpec } from '../../src/game/shard/spec.ts';
import { DRIFTWOOD_ISLE } from '../../src/shards/driftwood-isle/manifest.ts';
import { coveGeometry } from '../../src/shards/driftwood-isle/generators/cove.ts';
import { coveSpecKey, islandCoveSpec } from '../../src/shards/driftwood-isle/world/coveLayout.ts';

export function originalCove() {
  const bytes = Uint8Array.from(readFileSync(new URL('../../public/assets/baked/driftwood-isle/terrain.bin', import.meta.url)));
  const grid = parseBakedTerrain(bytes.buffer);
  if (grid === null || grid.seed !== DRIFTWOOD_ISLE.seed) throw new Error('Original Driftwood native terrain missing');
  const binding = new HeightfieldBinding(toLevelSpec(DRIFTWOOD_ISLE));
  binding.install(bakedSamplers(grid));
  const ao = Uint8Array.from(readFileSync(new URL('../../public/assets/models/driftwood-blender/voxel-ao.bin', import.meta.url)));
  const release = addVoxelAOBake(ao.buffer);
  try {
    const spec = islandCoveSpec(), built = coveGeometry(spec, binding.field.heightAt);
    return {
      geometry: built.geometry,
      metadata: { specKey: coveSpecKey(spec), placements: built.placements.map(row => ({
        matrix: row.m.toArray(), matrixNegativeZero: row.m.elements.flatMap((value, index) => Object.is(value, -0) ? [index] : []),
        r: row.r, squash: row.squash, moss: row.moss, min: row.box.min.toArray(), max: row.box.max.toArray(),
      })) },
    };
  } finally { release(); }
}
