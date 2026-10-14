import { ROC_SLATE_EDITS } from './paintLook';
import { DRIFT_RAY_LOOK_ROW, SKY_GOAT_LOOK_ROW, GALE_WISP_LOOK_ROW, STORM_ROC_LOOK_ROW } from './species';
import { DRIFT_RAY_CLIPS, SKY_GOAT_CLIPS, GALE_WISP_CLIPS } from './creatureClips';
import { ROC_CLIPS } from './rocClips';

/** The page's original look installation order, bodies and clip rows. */
export const SKY_CREATURE_LOOK_ROWS = [
  { body: 'drift-ray', look: DRIFT_RAY_LOOK_ROW, clips: DRIFT_RAY_CLIPS },
  { body: 'sky-goat', look: SKY_GOAT_LOOK_ROW, clips: SKY_GOAT_CLIPS },
  { body: 'gale-wisp', look: GALE_WISP_LOOK_ROW, clips: GALE_WISP_CLIPS },
  { body: 'storm-roc', look: { ...STORM_ROC_LOOK_ROW, materialEdits: [{ id: 'far.roc-slate', edits: ROC_SLATE_EDITS }] }, clips: ROC_CLIPS },
] as const;
