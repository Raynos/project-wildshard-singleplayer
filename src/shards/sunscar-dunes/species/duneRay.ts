import { RAY_CLIPS, RAY_LOOK } from '../data/species/duneRay';
import { duneLook } from '../world/meshes';

/** The ray's look: the generated manta in its tint, band-skinned and baked offline (generators/hulls.ts, G345), animated by its clips. */
export const DUNE_RAY_LOOK = duneLook(RAY_LOOK, 'ray', RAY_CLIPS);
