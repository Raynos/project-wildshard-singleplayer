import { clipAnimate } from '@wildshard/sdk/species/clips';
import { SKY_GOAT_CLIPS } from '../data/creatureClips';
import type { SpeciesRow } from '@wildshard/engine/ai/species';
import type { SpeciesLook } from '@wildshard/engine/entities/species/look';
import type { AnimalSpecies } from '@wildshard/engine/entities/species/registry';
import { NO_FUR } from '@wildshard/engine/entities/species/rigs';
import { SKY_GOAT_DATA } from '../data/species';
import { skyBodyOrStandIn } from './bodies';

export const SKY_GOAT: SpeciesRow = SKY_GOAT_DATA;

/**
 * The body: the generated goat (C6, Hunyuan3D-2), its coat warmed to cream and its legs rigged, baked offline by
 * `generators/creatures.ts`; undrawn on its stand-in skeleton when the bake is not loaded.
 */
export const goatBody = (): AnimalSpecies => skyBodyOrStandIn('sky-goat');
export const SKY_GOAT_LOOK: SpeciesLook = { id: 'far.look.skyGoat', species: SKY_GOAT.id, kind: 'skyGoat', rig: 'custom', fur: NO_FUR,
  rigContract: { skeleton: 'far.skyGoat', sockets: ['body', 'head', 'legFL', 'legFR', 'legBL', 'legBR'], clips: ['idle', 'walk', 'attack', 'hit', 'die'] },
  build: () => goatBody(),
  animate: clipAnimate(SKY_GOAT_CLIPS),
};
