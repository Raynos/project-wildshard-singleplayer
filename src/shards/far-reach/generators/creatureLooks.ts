import { DRIFT_RAY_LOOK_ROW, SKY_GOAT_LOOK_ROW, GALE_WISP_LOOK_ROW, STORM_ROC_LOOK_ROW } from '../data/species';
import { DRIFT_RAY_CLIPS, SKY_GOAT_CLIPS, GALE_WISP_CLIPS } from './creatureClips';
import { ROC_CLIPS } from './rocClips';

/** The Roc's plumage to mockup D's slate / white split (E399, E410): its browns slate grey in the paint and in the emission fed back from it; the white head and belly and the gold beak and talons kept. */
const ROC_SLATE_EDITS = [
  { stage: 'fragment', find: '#include <map_fragment>', put: '#include <map_fragment>\n  diffuseColor.rgb = farSlate(diffuseColor.rgb);' },
  { stage: 'fragment', find: '#include <emissivemap_fragment>', put: '#include <emissivemap_fragment>\n  totalEmissiveRadiance = farSlate(totalEmissiveRadiance);' },
  { stage: 'fragment', find: '', put: 'vec3 farSlate(vec3 c){ float l = dot(c, vec3(0.2126, 0.7152, 0.0722)); float gold = (1.0 - smoothstep(0.06, 0.12, c.b / max(c.r, 1e-3))) * smoothstep(0.2, 0.3, c.r); float brown = clamp((c.r - c.b) / max(c.r, 1e-3) * 1.6 - 0.3, 0.0, 1.0) * (1.0 - smoothstep(0.55, 0.75, c.g / max(c.r, 1e-3))) * (1.0 - gold); return mix(c, vec3(0.085, 0.09, 0.11) + vec3(l) * vec3(0.82, 0.9, 1.05) * 1.1, brown * 0.95); }\n' },
] as const;

/** The page's original look installation order, bodies and clip rows. */
export const SKY_CREATURE_LOOK_ROWS = [
  { body: 'drift-ray', look: DRIFT_RAY_LOOK_ROW, clips: DRIFT_RAY_CLIPS },
  { body: 'sky-goat', look: SKY_GOAT_LOOK_ROW, clips: SKY_GOAT_CLIPS },
  { body: 'gale-wisp', look: GALE_WISP_LOOK_ROW, clips: GALE_WISP_CLIPS },
  { body: 'storm-roc', look: { ...STORM_ROC_LOOK_ROW, materialEdits: [{ id: 'far.roc-slate', edits: ROC_SLATE_EDITS }] }, clips: ROC_CLIPS },
] as const;
