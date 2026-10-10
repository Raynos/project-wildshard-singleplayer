import { clipAnimate } from '@wildshard/sdk/species/clips';
import { SkittererBrain } from '../runtime/species/skitterer';
import { SKITTERER_DATA, SKITTERER_CLIPS } from '../data/species/skitterer';
import type { SpeciesRow } from '@wildshard/engine/ai/species';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import type { SpeciesLook } from '@wildshard/engine/entities/species/look';
import { NO_FUR } from '@wildshard/engine/entities/species/rigs';
import type { BufferGeometry } from 'three';
import { undrawnRig } from '@wildshard/sdk/looks/modelLibrary';
import { duneRig } from '../world/meshes';

const brains = new WeakMap<Animal, SkittererBrain>();
const brain = (a: Animal): SkittererBrain => { let value = brains.get(a); if (!value) { value = new SkittererBrain(a); brains.set(a, value); } return value; };

export const SAND_SKITTERER: SpeciesRow = { ...SKITTERER_DATA, think: (a, ctx) => { brain(a).think(ctx); }, act: (a, ctx) => { brain(a).act(ctx); } };

/** The sand beetle's body, baked offline (SF72, `generators/species.ts` skittererGeometry); undrawn when its rig did not load. */
export const skittererBody = (): BufferGeometry => duneRig('skitterer') ?? undrawnRig();
const bones = (): { name: string; parent: string | null; pos: [number, number, number] }[] => [
  { name: 'body', parent: null, pos: [0, 0.22, 0] }, { name: 'head', parent: 'body', pos: [0, 0.22, 0.42] },
  { name: 'legsL', parent: 'body', pos: [-0.18, 0.14, 0] }, { name: 'legsR', parent: 'body', pos: [0.18, 0.14, 0] }, { name: 'tail', parent: 'body', pos: [0, 0.26, -0.45] },
];
export const SAND_SKITTERER_LOOK: SpeciesLook = { id: 'sunscar.look.sandSkitterer', species: SAND_SKITTERER.id, kind: 'sandSkitterer', rig: 'custom', fur: NO_FUR,
  rigContract: { skeleton: 'sunscar.sandSkitterer', sockets: ['body', 'head', 'legsL', 'legsR', 'tail'], clips: ['idle', 'walk', 'attack', 'hit', 'die'] },
  build: () => ({ bones: bones(), furParts: [], hardParts: [skittererBody()], eyeParts: [],
    dims: { bodyY: 0.22, bodyHalfLen: 0.45, bodyRadius: 0.3, headRadius: 0.17, legLen: 0.2, feet: [], halfWidth: 0.45 } }),
  animate: clipAnimate(SKITTERER_CLIPS),
};
