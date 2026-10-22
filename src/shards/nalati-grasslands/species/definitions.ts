import type { SpeciesDef } from '@wildshard/engine/entities/species/registry';
import { BALBAL_SPECIES } from './balbal';
import { GOLDENKING_SPECIES } from './goldenKing';
import { poseNalatiCreature } from './presentation';

/** Existing per-species controls; shared look resources and the elites' controls are admitted as data. The golden
 *  eagle's flight height (its brain's `altY`, smoothed) is the creature view module's (behaviour/creatureViews.as). */
export const NALATI_DEFINITIONS:readonly Pick<SpeciesDef,'kind'|'think'|'act'|'postPose'|'animate'|'damageMul'>[]=[BALBAL_SPECIES,GOLDENKING_SPECIES,{kind:'eagle',animate:c=>{poseNalatiCreature('eagle',c);}}];
