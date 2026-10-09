import { clipAnimate } from '@wildshard/sdk/species/clips';
import { SKY_GOAT_CLIPS } from '../data/creatureClips';
import type { SpeciesRow } from '@wildshard/engine/ai/species';
import type { SpeciesLook } from '@wildshard/engine/entities/species/look';
import type { AnimalSpecies } from '@wildshard/engine/entities/species/registry';
import { NO_FUR } from '@wildshard/engine/entities/species/rigs';
import { BoxGeometry, ConeGeometry } from 'three';
import { STRINGS } from '../data/strings';
import { SKY_GOAT_VARIANTS } from '../runtime/variants';
import { hull } from './rig';
import { skyBody } from './bodies';

/** `drop`: how far below its deck a goat counts as falling (metres). */
export const GOAT = { graze: 1.2, ram: 7.5, notice: 9, rimMargin: 2.5, drop: 1.5 } as const;
export const SKY_GOAT: SpeciesRow = { id: 'far.creature.skyGoat', kind: 'skyGoat', label: STRINGS.goat, aggressive: true, blood: false, lockable: true,
  variants: SKY_GOAT_VARIANTS };

const BODY = 0, LEG_FL = 2, LEG_FR = 3, LEG_BL = 4, LEG_BR = 5;
/** The code goat: primitive parts (the stand-in while the generated model is missing). */
function goatCode(): AnimalSpecies {
  return {
    bones: [{ name: 'body', parent: null, pos: [0, 0.85, 0] }, { name: 'head', parent: 'body', pos: [0, 1.15, 0.6] },
      { name: 'legFL', parent: 'body', pos: [0.22, 0.7, 0.4] }, { name: 'legFR', parent: 'body', pos: [-0.22, 0.7, 0.4] },
      { name: 'legBL', parent: 'body', pos: [0.22, 0.7, -0.4] }, { name: 'legBR', parent: 'body', pos: [-0.22, 0.7, -0.4] }],
    furParts: [], eyeParts: [],
    hardParts: [hull([
      { geometry: new BoxGeometry(0.62, 0.5, 1.15), bone: BODY, color: 0xece4da, at: [0, 0.88, 0] },
      { geometry: new BoxGeometry(0.66, 0.2, 1.05), bone: BODY, color: 0xd9cfc4, at: [0, 1.15, -0.02] },
      { geometry: new BoxGeometry(0.3, 0.34, 0.42), bone: 1, color: 0xe4dbd1, at: [0, 1.18, 0.74] },
      { geometry: new ConeGeometry(0.06, 0.4, 4), bone: 1, color: 0x4a3d48, at: [0.1, 1.42, 0.62], rot: [-0.7, 0, 0.3] },
      { geometry: new ConeGeometry(0.06, 0.4, 4), bone: 1, color: 0x4a3d48, at: [-0.1, 1.42, 0.62], rot: [-0.7, 0, -0.3] },
      { geometry: new BoxGeometry(0.12, 0.22, 0.12), bone: 1, color: 0xc9bdb0, at: [0, 0.96, 0.86] },
      ...[[LEG_FL, 0.22, 0.4], [LEG_FR, -0.22, 0.4], [LEG_BL, 0.22, -0.4], [LEG_BR, -0.22, -0.4]].map(([bone, x, z]) => ({
        geometry: new BoxGeometry(0.13, 0.66, 0.13), bone: bone ?? BODY, color: 0x584a40, at: [x ?? 0, 0.36, z ?? 0] as const })),
    ])],
    dims: { bodyY: 0.85, bodyHalfLen: 0.6, bodyRadius: 0.35, headRadius: 0.22, legLen: 0.7, feet: [], halfWidth: 0.35 } };
}
/**
 * The body: the generated goat (C6, Hunyuan3D-2), its coat warmed to cream and its legs rigged, baked offline by
 * `generators/creatures.ts`; the code goat when the bake is not loaded (headless, a failed load).
 */
export const goatBody = (): AnimalSpecies => skyBody('sky-goat') ?? goatCode();
export const SKY_GOAT_LOOK: SpeciesLook = { id: 'far.look.skyGoat', species: SKY_GOAT.id, kind: 'skyGoat', rig: 'custom', fur: NO_FUR,
  rigContract: { skeleton: 'far.skyGoat', sockets: ['body', 'head', 'legFL', 'legFR', 'legBL', 'legBR'], clips: ['idle', 'walk', 'attack', 'hit', 'die'] },
  build: () => goatBody(),
  animate: clipAnimate(SKY_GOAT_CLIPS),
};
