import { bakedLook } from '@wildshard/sdk/looks/modelLibrary';
import { RAY_CLIPS, RAY_LOOK } from '../data/species/duneRay';
import { duneBody } from '../world/meshes';

/** The ray's look: the generated manta in its tint, band-skinned and baked offline (generators/hulls.ts, G345), animated by its clips. */
export const DUNE_RAY_LOOK = bakedLook(RAY_LOOK, () => duneBody('ray'), RAY_CLIPS);
