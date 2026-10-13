import { STRIDER_CLIPS, STRIDER_LOOK } from '../data/species/strider';
import { duneLook } from '../world/meshes';

/** The strider's look: its rows (data/species/strider.ts STRIDER_LOOK) on its baked body (generators/hulls.ts, G345), animated by its clips. */
export const DUNE_STRIDER_LOOK = duneLook(STRIDER_LOOK, 'strider', STRIDER_CLIPS);
