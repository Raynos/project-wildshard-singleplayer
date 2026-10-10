import { clipAnimate } from '@wildshard/sdk/species/clips';
import { DUNE_STRIDER, STRIDER_CLIPS } from '../data/species/strider';
import type { SpeciesLook } from '@wildshard/engine/entities/species/look';
import { NO_FUR } from '@wildshard/engine/entities/species/rigs';
import type { BufferGeometry } from 'three';
import { quadrupedHull, type FittedHull } from '@wildshard/sdk/looks/fittedHull';
import { STRIDER_HULL } from '../data/species/hulls';
import { duneMesh } from '../world/meshes';

/** The strider's body: the generated model fitted and skinned from its rows (data/species/hulls.ts); undrawn when it did not load (SF72). */
const striderBody = (): FittedHull => quadrupedHull(duneMesh('dune-strider'), STRIDER_HULL);
/** The strider as one skinned geometry for the Model Explorer. */
export const striderSpecimen = (): BufferGeometry => striderBody().geometry;
export const DUNE_STRIDER_LOOK: SpeciesLook = { id: 'sunscar.look.duneStrider', species: DUNE_STRIDER.id, kind: 'duneStrider', rig: 'custom', fur: NO_FUR,
  rigContract: { skeleton: 'sunscar.duneStrider', sockets: ['body', 'head', 'legFL', 'legFR', 'legBL', 'legBR', 'tail'], clips: ['idle', 'walk', 'attack', 'hit', 'die'] },
  build: () => {
    const body = striderBody();
    return { bones: body.bones, furParts: [], hardParts: [body.geometry], eyeParts: [],
      dims: { bodyY: body.h * 0.7, bodyHalfLen: 1.3, bodyRadius: 0.75, headRadius: 0.4, legLen: body.h * 0.5, feet: [], halfWidth: 0.7 } };
  },
  animate: clipAnimate(STRIDER_CLIPS),
};
