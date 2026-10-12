import { clipAnimate } from '@wildshard/sdk/species/clips';
import { DRIFT_RAY_CLIPS } from '../data/creatureClips';
import type { SpeciesRow } from '@wildshard/engine/ai/species';
import type { SpeciesLook } from '@wildshard/engine/entities/species/look';
import type { AnimalSpecies } from '@wildshard/engine/entities/species/registry';
import { NO_FUR } from '@wildshard/engine/entities/species/rigs';
import { DRIFT_RAY_DATA } from '../data/species';
import { skyBodyOrStandIn } from './bodies';

export const DRIFT_RAY: SpeciesRow = DRIFT_RAY_DATA;

/**
 * The body: the generated manta (C6, Hunyuan3D-2) in the mockup's pale blues, its fins and whip rigged, baked offline by
 * `generators/creatures.ts`; undrawn on its stand-in skeleton when the bake is not loaded.
 */
export const rayBody = (): AnimalSpecies => skyBodyOrStandIn('drift-ray');
export const DRIFT_RAY_LOOK: SpeciesLook = { id: 'far.look.driftRay', species: DRIFT_RAY.id, kind: 'driftRay', rig: 'custom', fur: NO_FUR,
  rigContract: { skeleton: 'far.driftRay', sockets: ['body', 'head', 'wingL', 'wingR', 'tail'], clips: ['idle', 'fly', 'attack', 'hit', 'die'] },
  build: () => rayBody(),
  animate: clipAnimate(DRIFT_RAY_CLIPS),
};
