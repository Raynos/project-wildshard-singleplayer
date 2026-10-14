// Driftwood's fixed buildings on their sites (the castaway's hut, the lookout tower) over the same retained terrain
// binding as the native level (original WSTR samples plus its authored datum), their AO answered by the committed voxel
// table as on the page. Explicit function calls only; import selects no world, service or level.
import { readFileSync } from 'node:fs';
import { addVoxelAOBake } from '@wildshard/engine/world/voxelAO';
import { driftwoodGroundSampler } from './groundSampling.ts';
import { PLATEAU, HEADLAND } from '../data/landscapeRows.ts';
import { hutBake } from './hut.ts';
import { lookoutBake } from './lookout.ts';
import { islandCoveSpec } from '../world/coveLayout.ts';

const HUT = { x: PLATEAU.x + 2, z: PLATEAU.z - 2, rot: 0 };
const LOOKOUT = { x: HEADLAND.x - 4, z: HEADLAND.z - 2, rot: 0.6 };

/** @template T @param {(ground: (x: number, z: number) => number) => T} build @returns {T} */
function onNativeTerrain(build) {
  const ground = driftwoodGroundSampler();
  const ao = Uint8Array.from(readFileSync(new URL('../../../../public/assets/models/driftwood-blender/voxel-ao.bin', import.meta.url)));
  const release = addVoxelAOBake(ao.buffer);
  try {
    return build(ground);
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
