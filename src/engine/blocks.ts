import { melee, aimRay, fovForAspect } from './combat/blocks/melee';
import { ads } from './combat/blocks/ads';
import { viewmodel } from './render/viewmodelFeel';

/** Existing engine blocks grouped for authored weapon composition. */
export const blocks = Object.freeze({ melee, aimRay, fovForAspect, ads, viewmodel });
