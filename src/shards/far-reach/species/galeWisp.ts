import { clipAnimate } from '@wildshard/sdk/species/clips';
import { GALE_WISP_CLIPS } from '../data/creatureClips';
import type { SpeciesRow } from '@wildshard/engine/ai/species';
import type { SpeciesLook } from '@wildshard/engine/entities/species/look';
import { NO_FUR } from '@wildshard/engine/entities/species/rigs';
import { IcosahedronGeometry, OctahedronGeometry, TorusGeometry } from 'three';
import { GALE_WISP_DATA } from '../data/species';
import { hull } from './rig';

export const GALE_WISP: SpeciesRow = GALE_WISP_DATA;

export const GALE_WISP_LOOK: SpeciesLook = { id: 'far.look.galeWisp', species: GALE_WISP.id, kind: 'galeWisp', rig: 'custom', fur: NO_FUR,
  rigContract: { skeleton: 'far.galeWisp', sockets: ['body', 'head', 'swirl'], clips: ['idle', 'fly', 'attack', 'hit', 'die'] },
  build: () => ({
    bones: [{ name: 'body', parent: null, pos: [0, 0, 0] }, { name: 'head', parent: 'body', pos: [0, 0.1, 0.2] }, { name: 'swirl', parent: 'body', pos: [0, 0, 0] }],
    furParts: [], eyeParts: [],
    hardParts: [hull([
      { geometry: new IcosahedronGeometry(0.45, 0), bone: 0, color: 0xeaf8ff },
      { geometry: new OctahedronGeometry(0.2, 0), bone: 1, color: 0x9fe6f2, at: [0, 0.1, 0.32] },
      { geometry: new TorusGeometry(0.75, 0.05, 3, 10), bone: 2, color: 0xcdeff8, rot: [Math.PI / 2, 0, 0] },
      { geometry: new TorusGeometry(0.55, 0.04, 3, 8), bone: 2, color: 0xffffff, rot: [Math.PI / 2.6, 0.4, 0] },
    ])],
    dims: { bodyY: 0, bodyHalfLen: 0.4, bodyRadius: 0.45, headRadius: 0.2, legLen: 0.1, feet: [], halfWidth: 0.75 } }),
  animate: clipAnimate(GALE_WISP_CLIPS),
};
