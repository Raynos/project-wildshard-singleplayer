/** Z2 rows compiled from the original crag kit, fixed skin slots and cave frame. */
import { parseWorldScenePlacement } from '@wildshard/format/worldScenePlacement';
import crags from '../data/cragScenes.generated.json' with { type: 'json' };
import { CRAG_LOOK } from './cragLook';

/** Only fixed skin templates and their batch/placement wrappers are tier-exclusive. */
function membership(id: string): { readonly tier?: 'phone' | 'desktop' } {
  if (id.startsWith('phone-skin-') || id.startsWith('crags.phone')) return { tier: 'phone' };
  if (id.startsWith('desktop-skin-') || id.startsWith('crags.desktop')) return { tier: 'desktop' };
  return {};
}

function withMembership<T extends { readonly id: string }>(row: T): T & { readonly tier?: 'phone' | 'desktop' } {
  return { ...row, ...membership(row.id) };
}

export const CRAG_MODEL_ROWS = crags.moduleModels;
export const CRAG_PLACEMENT_ROWS = crags.placements.map(row => parseWorldScenePlacement(withMembership(row)));
export const CRAG_BATCH_ROWS = crags.batches.map(withMembership);
export const CRAG_LIBRARY = { id: 'crags', kind: 'owned' as const, models: crags.models.map(withMembership) };
export const CRAG_MATERIAL = { id: 'crag', kind: 'look' as const, look: CRAG_LOOK };
export const CRAG_MODEL_BLOBS = crags.blobs;
export const CRAG_CAVE_ROWS = crags.cave;
