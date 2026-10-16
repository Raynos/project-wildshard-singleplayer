// The same retained terrain binding as the native level: original WSTR samples plus its authored datum.
// Explicit function call only; import selects no world, service or level.
import { readFileSync } from 'node:fs';
import { Vector3 } from 'three';
import { addVoxelAOBake } from '@wildshard/engine/world/voxelAO';
import { driftwoodGroundSampler } from './groundSampling.ts';
import { coveGeometry } from './cove.ts';
import { coveNative } from './coveNative.ts';
import { cascadeGeometry } from './cascade.ts';
import { coveSpecKey, islandCoveSpec, RAMP, ANTE, PASS, ALC, ANTE_FLOOR, ALC_FLOOR } from './coveLayout.ts';

export function originalCove() {
  const ground = driftwoodGroundSampler();
  const ao = Uint8Array.from(readFileSync(new URL('../../../../public/assets/models/driftwood-blender/voxel-ao.bin', import.meta.url)));
  const release = addVoxelAOBake(ao.buffer);
  try {
    const spec = islandCoveSpec(), built = coveGeometry(spec, ground);
    // E150: the toon cascade in three terraces over the crag; its foam rings stay inside the 2.4 m pool
    const [tx, tz] = spec.fall.top, [fx, fz] = spec.fall.foot, dx = fx - tx, dz = fz - tz, len = Math.hypot(dx, dz);
    const fall = cascadeGeometry({ lip: new Vector3(tx, ground(tx, tz) + 0.3, tz), foot: new Vector3(fx + (dx / len) * 1.2, ground(fx, fz) + 0.06, fz + (dz / len) * 1.2),
      width: 2.2, ground, poolRadius: 2.3, steps: 3 });
    return {
      geometry: built.geometry, fall,
      metadata: { spec, floor: { ramp0: RAMP.z0, ramp1: RAMP.z1, ante: ANTE_FLOOR, alc: ALC_FLOOR, pass0: PASS.z0, pass1: PASS.z1, anteWidth: ANTE.hw, passWidth: PASS.hw, alcWidth: ALC.hw }, specKey: coveSpecKey(spec), native:coveNative(spec,ground), catalogue: {
        placements: built.placements.map(row => {
          const at = new Vector3().setFromMatrixPosition(row.m);
          return { x:at.x,y:at.y,z:at.z,params:{r:row.r,squash:row.squash,moss:row.moss} };
        }),
        boxes: built.placements.flatMap(row => [row.box.min.x,row.box.min.y,row.box.min.z,row.box.max.x,row.box.max.y,row.box.max.z]),
      } },
    };
  } finally { release(); }
}
