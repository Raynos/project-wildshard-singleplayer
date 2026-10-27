// Driftwood's fixed buildings on their sites (the castaway's hut, the lookout tower) over the same retained terrain
// binding as the native level (original WSTR samples plus its authored datum), their AO answered by the committed voxel
// table as on the page. Explicit function calls only; import selects no world, service or level.
import { addVoxelAOBake } from '@wildshard/engine/world/voxelAO';
import { driftwoodGroundSampler } from './groundSampling.ts';
import { PLATEAU, HEADLAND } from './landscapeRows.ts';
import { hutBake } from './hut.ts';
import { lookoutBake } from './lookout.ts';
import { islandCoveSpec } from './coveLayout.ts';

const HUT = { x: PLATEAU.x + 2, z: PLATEAU.z - 2, rot: 0 };
const LOOKOUT = { x: HEADLAND.x - 4, z: HEADLAND.z - 2, rot: 0.6 };

/** @template T @param {Uint8Array} aoBytes @param {(ground: (x: number, z: number) => number) => T} build @returns {T} */
function onNativeTerrain(aoBytes, build) {
  const ground = driftwoodGroundSampler();
  const ao = Uint8Array.from(aoBytes);
  const release = addVoxelAOBake(ao.buffer);
  try {
    return build(ground);
  } finally {
    release();
  }
}

/** Bake the hut where the island stands it, against the native height binding. */
/** @param {Uint8Array} aoBytes caller-owned committed native AO table */
export function originalHut(aoBytes) {
  return onNativeTerrain(aoBytes, (ground) => hutBake({ x: HUT.x, z: HUT.z, rot: HUT.rot }, ground));
}

/** Bake the lookout on the headland, its zipline pulley facing the sea cave's mouth. */
/** @param {Uint8Array} aoBytes caller-owned committed native AO table */
export function originalLookout(aoBytes) {
  const cave = islandCoveSpec().cave;
  return onNativeTerrain(aoBytes, (ground) => lookoutBake({ x: LOOKOUT.x, z: LOOKOUT.z, rot: LOOKOUT.rot }, ground, { x: cave.x, z: cave.z }));
}
