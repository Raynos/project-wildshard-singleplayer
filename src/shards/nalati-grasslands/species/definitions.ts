import type { SpeciesDef } from '@wildshard/engine/entities/species/registry';
import { BALBAL_SPECIES } from './balbal';
import { GOLDENKING_SPECIES } from './goldenKing';
import { animateEagle } from './eagle';

/** Existing per-species controls; shared look resources and the elites' controls are admitted as data. */
export const NALATI_DEFINITIONS:readonly Pick<SpeciesDef,'kind'|'think'|'act'|'postPose'|'animate'|'damageMul'>[]=[BALBAL_SPECIES,GOLDENKING_SPECIES,{kind:'eagle',animate:animateEagle}];
