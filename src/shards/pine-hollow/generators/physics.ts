import { nativeColliderRecordSchema, nativeBodySchema } from '@wildshard/format/nativePhysics';
import * as v from 'valibot';
import { PinePhysicsSchema } from './sections';
import PINE_TERRAIN from '../data/terrainBindings.json' with { type: 'json' };
import rows from '../data/physicsRows.json' with { type: 'json' };

/** G350-PH: Pine Hollow's physics product from authoring inputs only: the authored rows no recipe computes yet (the floor,
 * actors, the King's prewarm and rest hit volumes, herds, forest trunks with their shelter cover, pieces and fixed solids),
 * with the hunting brain's trunk circles (x, z, r) taken from the trunk rows. No world, model, registry, engine or runtime
 * code runs. */
export function pinePhysics(): Record<string, unknown> {
  const trees = rows.shelterTrees.map(([x, z, r]) => {
    if (x === undefined || z === undefined || r === undefined) throw new Error('Pine physics: a trunk row is not x, z, r, height, cover');
    return [x, z, r];
  });
  const payload = { version: 1, profile: 'authored rows', notice: 'DO NOT EDIT: regenerate with generators/physics.ts (pine-physics).',
    ground: rows.ground, actors: rows.actors, parked: rows.parked, kingHit: rows.kingHit, herds: rows.herds, trees,
    shelterTrees: rows.shelterTrees, pieces: rows.pieces, solids: rows.solids };
  v.parse(PinePhysicsSchema, payload);
  for (const actor of [...rows.actors, ...rows.parked]) v.parse(nativeBodySchema('segments'), actor.spec);
  const solid = nativeColliderRecordSchema([1, 2, 6, 9], 'piece');
  for (const row of rows.solids) v.parse(solid, row);
  if (rows.ground.rows !== PINE_TERRAIN.res - 1 || rows.ground.cols !== PINE_TERRAIN.res - 1) throw new Error('Pine physics: divergent native lattice');
  return payload;
}
