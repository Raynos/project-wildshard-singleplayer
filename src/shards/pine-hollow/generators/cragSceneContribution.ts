
/** Z2 rows compiled from the original crag kit, fixed skin slots and cave frame. */
import { worldScenePlacement as parseWorldScenePlacement } from '@wildshard/sdk/worldScenes';
import { pineCragScenes, type CragBatchRow, type CragCaveRows, type CragModelRow } from './bake-crag-scenes.mjs';
import { perSources, type PineSources } from './pineSources';
import { nameBlob, type NamedBlob as NamedBlobType } from '@wildshard/sdk/blobs';
import { nameCompactBlobs } from '@wildshard/sdk/bake/compactGlb';
import { CRAG_LOOK } from './cragLook';

type WorldScenePlacementRowType = ReturnType<typeof parseWorldScenePlacement>;

/** Only fixed skin templates and their batch/placement wrappers are tier-exclusive. */
function membership(id: string): { readonly tier?: 'phone' | 'desktop' } {
  if (id.startsWith('phone-skin-') || id.startsWith('crags.phone')) return { tier: 'phone' };
  if (id.startsWith('desktop-skin-') || id.startsWith('crags.desktop')) return { tier: 'desktop' };
  return {};
}

function withMembership<T extends { readonly id: string }>(row: T): T & { readonly tier?: 'phone' | 'desktop' } {
  return { ...row, ...membership(row.id) };
}

/** The rows `cragScene` makes. */
export interface CragScene {
  readonly CRAG_MODEL_ROWS: CragModelRow[];
  readonly CRAG_PLACEMENT_ROWS: WorldScenePlacementRowType[];
  readonly CRAG_BATCH_ROWS: (CragBatchRow & { readonly tier?: 'phone' | 'desktop' })[];
  readonly CRAG_LIBRARY: { id: string; kind: "owned"; models: ({ id: string; file: string; attributes: NonNullable<unknown>; } & { readonly tier?: "phone" | "desktop"; })[]; };
  readonly CRAG_MATERIAL: { id: string; kind: "look"; look: string; };
  readonly CRAG_RAW_MODELS: NamedBlobType[];
  readonly CRAG_PACKED_MODELS: NamedBlobType[];
  readonly CRAG_CAVE_ROWS: CragCaveRows;
}
/** D65: the crag scene rows over the program's sources (the crag scenes bake), made once per sources. */
export const cragScene: (sources: PineSources) => Promise<CragScene> = perSources(async (sources: PineSources): Promise<CragScene> => {
  const { rows: crags, glbs } = await pineCragScenes(sources);

  const CRAG_MODEL_ROWS: CragModelRow[] = crags.moduleModels;
  const CRAG_PLACEMENT_ROWS: WorldScenePlacementRowType[] = crags.placements.map(row => parseWorldScenePlacement(withMembership(row)));
  const CRAG_BATCH_ROWS: (CragBatchRow & { readonly tier?: 'phone' | 'desktop' })[] = crags.batches.map(withMembership);
  const CRAG_LIBRARY: { id: string; kind: "owned"; models: ({ id: string; file: string; attributes: NonNullable<unknown>; } & { readonly tier?: "phone" | "desktop"; })[]; } = { id: 'crags', kind: 'owned' as const, models: crags.models.map(withMembership) };
  const CRAG_MATERIAL: { id: string; kind: "look"; look: string; } = { id: 'crag', kind: 'look' as const, look: CRAG_LOOK };
  // GR8 G30: the crag shapes' GLBs, built in memory: raw for the map assembly, meshopt-named for the output.
  /** The crag shapes' raw GLBs. */
  const CRAG_RAW_MODELS: NamedBlobType[] = glbs.map(([name, bytes]) => nameBlob(name, 'glb', bytes));
  /** The crag shapes' GLBs, meshopt-named as their `meshopt: true` sources were. */
  // iPhone downloads I3: shipped in phone geometry when that serves fewer bytes (nameCompactBlob), else the meshopt pick
  const CRAG_PACKED_MODELS: NamedBlobType[] = await nameCompactBlobs(glbs);
  const CRAG_CAVE_ROWS: CragCaveRows = crags.cave;
  return { CRAG_MODEL_ROWS, CRAG_PLACEMENT_ROWS, CRAG_BATCH_ROWS, CRAG_LIBRARY, CRAG_MATERIAL, CRAG_RAW_MODELS, CRAG_PACKED_MODELS, CRAG_CAVE_ROWS };
});
