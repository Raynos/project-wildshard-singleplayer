// The same retained terrain binding as the native level: original WSTR samples plus its authored datum.
// Explicit function call only; import selects no world, service or level.
import { readFileSync } from 'node:fs';
import { Vector3 } from 'three';
import { addVoxelAOBake } from '@wildshard/engine/world/voxelAO';
import { driftwoodGroundSampler } from './groundSampling.ts';
import { coveGeometry } from './cove.ts';
import { coveNative } from './coveNative.ts';
import { coveSpecKey, islandCoveSpec } from '../world/coveLayout.ts';

export function originalCove() {
  const ground = driftwoodGroundSampler();
  const ao = Uint8Array.from(readFileSync(new URL('../../../../public/assets/models/driftwood-blender/voxel-ao.bin', import.meta.url)));
  const release = addVoxelAOBake(ao.buffer);
  try {
    const spec = islandCoveSpec(), built = coveGeometry(spec, ground);
    return {
      geometry: built.geometry,
      metadata: { specKey: coveSpecKey(spec), native:coveNative(spec,ground), catalogue: {
        placements: built.placements.map(row => {
          const at = new Vector3().setFromMatrixPosition(row.m);
          return { x:at.x,y:at.y,z:at.z,params:{r:row.r,squash:row.squash,moss:row.moss} };
        }),
        boxes: built.placements.flatMap(row => [row.box.min.x,row.box.min.y,row.box.min.z,row.box.max.x,row.box.max.y,row.box.max.z]),
      } },
    };
  } finally { release(); }
}
