import { clipAnimate } from '@wildshard/sdk/species/clips';
import { DUNE_RAY, RAY_CLIPS } from '../data/species/duneRay';
import type { SpeciesLook } from '@wildshard/engine/entities/species/look';
import { NO_FUR } from '@wildshard/engine/entities/species/rigs';
import type { BufferGeometry } from 'three';
import { bandSkin, loftedBandHull } from '@wildshard/sdk/looks/fittedHull';
import { MANTA_HULL, RAY_CODE_HULL, RAY_TINT } from '../data/species/hulls';
import { duneMesh } from '../world/meshes';

/** Bones (absolute bind space, +Z forward): body first, then head, the two wings and the tail. */
const rayBones = (): { name: string; parent: string | null; pos: [number, number, number] }[] => [
  { name: 'body', parent: null, pos: [0, 0.3, 0] as [number, number, number] },
  { name: 'head', parent: 'body', pos: [0, 0.3, 1.2] as [number, number, number] },
  { name: 'wingL', parent: 'body', pos: [-0.9, 0.3, 0] as [number, number, number] },
  { name: 'wingR', parent: 'body', pos: [0.9, 0.3, 0] as [number, number, number] },
  { name: 'tail', parent: 'body', pos: [0, 0.3, -1.0] as [number, number, number] },
];
/** A flat manta with a raised back, cephalic lobes and a long whip tail, skinned to the five bones (data/species/hulls.ts RAY_CODE_HULL). */
export const rayGeometry = (): BufferGeometry => loftedBandHull(RAY_CODE_HULL);

/** The generated manta (data/species/hulls.ts MANTA_HULL), tinted when `tint` is given; null when its file did not load. */
export function mantaBody(tint: typeof RAY_TINT | null = null): BufferGeometry | null {
  const source = duneMesh('dune-matriarch');
  return source === null ? null : bandSkin(source, MANTA_HULL, tint);
}

export const DUNE_RAY_LOOK: SpeciesLook = { id: 'sunscar.look.duneRay', species: DUNE_RAY.id, kind: 'duneRay', rig: 'custom', fur: NO_FUR,
  rigContract: { skeleton: 'sunscar.duneRay', sockets: ['body', 'head', 'wingL', 'wingR', 'tail'], clips: ['idle', 'fly', 'attack', 'hit', 'die'] },
  build: () => ({ bones: rayBones(), furParts: [], hardParts: [mantaBody(RAY_TINT) ?? rayGeometry()], eyeParts: [],
    dims: { bodyY: 0.3, bodyHalfLen: 1.1, bodyRadius: 0.8, headRadius: 0.4, legLen: 0, feet: [], halfWidth: 2.6 } }),
  animate: clipAnimate(RAY_CLIPS),
};
