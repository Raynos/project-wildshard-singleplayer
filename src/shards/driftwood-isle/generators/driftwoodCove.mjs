// The same retained terrain binding as the native level: original WSTR samples plus its authored datum.
// Explicit function call only; import selects no world, service or level.
import { readFileSync } from 'node:fs';
import { addVoxelAOBake } from '@wildshard/engine/world/voxelAO';
import { driftwoodGroundSampler } from './groundSampling.ts';
import { coveGeometry } from './cove.ts';
import { coveSpecKey, islandCoveSpec } from '../world/coveLayout.ts';

export function originalCove() {
  const ground = driftwoodGroundSampler();
  const ao = Uint8Array.from(readFileSync(new URL('../../../../public/assets/models/driftwood-blender/voxel-ao.bin', import.meta.url)));
  const release = addVoxelAOBake(ao.buffer);
  try {
    const spec = islandCoveSpec(), built = coveGeometry(spec, ground);
    return {
      geometry: built.geometry,
      metadata: { specKey: coveSpecKey(spec), placements: built.placements.map(row => ({
        matrix: row.m.toArray(), matrixNegativeZero: row.m.elements.flatMap((value, index) => Object.is(value, -0) ? [index] : []),
        r: row.r, squash: row.squash, moss: row.moss, min: row.box.min.toArray(), max: row.box.max.toArray(),
      })) },
    };
  } finally { release(); }
}
