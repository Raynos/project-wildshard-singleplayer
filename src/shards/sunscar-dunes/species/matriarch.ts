import { MATRIARCH_DATA, MATRIARCH_CLIPS, MATRIARCH_LOOK } from '../data/species/matriarch';
import type { SpeciesRow } from '@wildshard/engine/ai/species';
import { duneLook } from '../world/meshes';

/** Her species row: her gameplay data and her declared phased-flyer brain (data/brains.ts MATRIARCH_BRAIN, SF27). */
export const DUNE_MATRIARCH: SpeciesRow = MATRIARCH_DATA;

/** Her body: the generated manta untinted on the ray's skeleton, baked offline (generators/hulls.ts, G345), drawn at 3.6×; slower
 *  wingbeats; grounded, the wings drape on the sand, the head dips and the tail lifts to sweep. */
export const DUNE_MATRIARCH_LOOK = duneLook(MATRIARCH_LOOK, 'matriarch', MATRIARCH_CLIPS);
