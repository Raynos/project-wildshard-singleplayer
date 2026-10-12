import { STRIDER_CLIPS, STRIDER_LOOK } from '../data/species/strider';
import type { BufferGeometry } from 'three';
import { undrawnRig } from '@wildshard/sdk/looks/modelLibrary';
import { quadrupedLook, type FittedHull } from '../runtime/looks/fittedHull';
import { STRIDER_RIG } from '../data/striderRig.baked';
import { duneRig } from '../world/meshes';

/** The strider's body: its baked rig (generators/hulls.ts, G345) on its baked skeleton; undrawn when the rig did not load (SF72). */
const striderBody = (): FittedHull => ({ h: STRIDER_RIG.h, geometry: duneRig('strider') ?? undrawnRig(), bones: STRIDER_RIG.bones.map(b => ({ name: b.name, parent: b.parent, pos: [b.pos[0], b.pos[1], b.pos[2]] })) });
/** The strider as one skinned geometry for the Model Explorer. */
export const striderSpecimen = (): BufferGeometry => striderBody().geometry;
/** The strider's look: its rows (data/species/strider.ts STRIDER_LOOK) on its baked hull, animated by its clips. */
export const DUNE_STRIDER_LOOK = quadrupedLook(STRIDER_LOOK, striderBody, STRIDER_CLIPS);
