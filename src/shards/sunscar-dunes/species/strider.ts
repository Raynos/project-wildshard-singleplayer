import { STRIDER_CLIPS, STRIDER_LOOK } from '../data/species/strider';
import { bakedLook } from '../runtime/looks/fittedHull';
import { duneBody } from '../world/meshes';

/** The strider's look: its rows (data/species/strider.ts STRIDER_LOOK) on its baked body (generators/hulls.ts, G345), animated by its clips. */
export const DUNE_STRIDER_LOOK = bakedLook(STRIDER_LOOK, () => duneBody('strider'), STRIDER_CLIPS);
