import { SKITTERER_CLIPS, SKITTERER_LOOK } from '../data/species/skitterer';
import { duneLook } from '../world/meshes';

/** The sand beetle's look: its rows on its body baked offline (SF72, `generators/species.ts`), animated by its clips. */
export const SAND_SKITTERER_LOOK = duneLook(SKITTERER_LOOK, 'skitterer', SKITTERER_CLIPS);
