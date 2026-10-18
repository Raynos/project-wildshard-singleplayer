/** Z2 rows compiled from the original crag kit, fixed skin slots and cave frame. */
import { parseWorldScenePlacement } from '@wildshard/format/worldScenePlacement';
import crags from '../data/cragScenes.generated.json' with { type: 'json' };
import { CRAG_LOOK } from './cragLook';

export const CRAG_MODEL_ROWS = crags.moduleModels;
export const CRAG_PLACEMENT_ROWS = crags.placements.map(parseWorldScenePlacement);
export const CRAG_BATCH_ROWS = crags.batches;
export const CRAG_LIBRARY = { id: 'crags', kind: 'owned' as const, models: crags.models };
export const CRAG_MATERIAL = { id: 'crag', kind: 'look' as const, look: CRAG_LOOK };
export const CRAG_MODEL_BLOBS = crags.blobs;
export const CRAG_CAVE_ROWS = crags.cave;
