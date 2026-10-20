import type { SpeciesDef } from '@wildshard/engine/entities/species/registry';
import { SHEEPDOG_SPECIES } from './sheepdog';
import { BALBAL_SPECIES } from './balbal';
import { GOLDENKING_SPECIES } from './goldenKing';
import { LEOPARD_SPECIES } from './leopard';
import { EAGLE_SPECIES } from './eagle';
import { KOKBORI_SPECIES } from './kokbori';

/** Existing per-species controls; shared look resources are admitted as data. */
export const NALATI_DEFINITIONS:readonly SpeciesDef[]=[SHEEPDOG_SPECIES,BALBAL_SPECIES,GOLDENKING_SPECIES,LEOPARD_SPECIES,EAGLE_SPECIES,KOKBORI_SPECIES];
