import { bakedLook } from '@wildshard/sdk/looks/modelLibrary';
import { SKY_GOAT_CLIPS } from '../data/creatureClips';
import type { SpeciesRow } from '@wildshard/engine/ai/species';
import type { AnimalSpecies } from '@wildshard/engine/entities/species/registry';
import { SKY_GOAT_DATA, SKY_GOAT_LOOK_ROW } from '../data/species';
import { skyBodyOrStandIn } from './bodies';

export const SKY_GOAT: SpeciesRow = SKY_GOAT_DATA;

/**
 * The body: the generated goat (C6, Hunyuan3D-2), its coat warmed to cream and its legs rigged, baked offline by
 * `generators/creatures.ts`; undrawn on its stand-in skeleton when the bake is not loaded.
 */
export const goatBody = (): AnimalSpecies => skyBodyOrStandIn('sky-goat');
export const SKY_GOAT_LOOK = bakedLook(SKY_GOAT_LOOK_ROW, goatBody, SKY_GOAT_CLIPS);
