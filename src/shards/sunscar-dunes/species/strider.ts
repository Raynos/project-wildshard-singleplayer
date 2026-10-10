import { STRIDER_CLIPS, STRIDER_LOOK } from '../data/species/strider';
import type { BufferGeometry } from 'three';
import { quadrupedHull, quadrupedLook, type FittedHull } from '@wildshard/sdk/looks/fittedHull';
import { STRIDER_HULL } from '../data/species/hulls';
import { duneMesh } from '../world/meshes';

/** The strider's body: the generated model fitted and skinned from its rows (data/species/hulls.ts); undrawn when it did not load (SF72). */
const striderBody = (): FittedHull => quadrupedHull(duneMesh('dune-strider'), STRIDER_HULL);
/** The strider as one skinned geometry for the Model Explorer. */
export const striderSpecimen = (): BufferGeometry => striderBody().geometry;
/** The strider's look: its rows (data/species/strider.ts STRIDER_LOOK) on its fitted hull, animated by its clips. */
export const DUNE_STRIDER_LOOK = quadrupedLook(STRIDER_LOOK, striderBody, STRIDER_CLIPS);
