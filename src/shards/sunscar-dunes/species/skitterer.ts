import { clipAnimate } from '@wildshard/sdk/species/clips';
import { SKITTERER_DATA, SKITTERER_CLIPS } from '../data/species/skitterer';
import type { SpeciesLook } from '@wildshard/engine/entities/species/look';
import { NO_FUR } from '@wildshard/engine/entities/species/rigs';
import type { BufferGeometry } from 'three';
import { undrawnRig } from '@wildshard/sdk/looks/modelLibrary';
import { duneRig } from '../world/meshes';

/** The sand beetle's body, baked offline (SF72, `generators/species.ts` skittererGeometry); undrawn when its rig did not load. */
export const skittererBody = (): BufferGeometry => duneRig('skitterer') ?? undrawnRig();
const bones = (): { name: string; parent: string | null; pos: [number, number, number] }[] => [
  { name: 'body', parent: null, pos: [0, 0.22, 0] }, { name: 'head', parent: 'body', pos: [0, 0.22, 0.42] },
  { name: 'legsL', parent: 'body', pos: [-0.18, 0.14, 0] }, { name: 'legsR', parent: 'body', pos: [0.18, 0.14, 0] }, { name: 'tail', parent: 'body', pos: [0, 0.26, -0.45] },
];
export const SAND_SKITTERER_LOOK: SpeciesLook = { id: 'sunscar.look.sandSkitterer', species: SKITTERER_DATA.id, kind: 'sandSkitterer', rig: 'custom', fur: NO_FUR,
  rigContract: { skeleton: 'sunscar.sandSkitterer', sockets: ['body', 'head', 'legsL', 'legsR', 'tail'], clips: ['idle', 'walk', 'attack', 'hit', 'die'] },
  build: () => ({ bones: bones(), furParts: [], hardParts: [skittererBody()], eyeParts: [],
    dims: { bodyY: 0.22, bodyHalfLen: 0.45, bodyRadius: 0.3, headRadius: 0.17, legLen: 0.2, feet: [], halfWidth: 0.45 } }),
  animate: clipAnimate(SKITTERER_CLIPS),
};
