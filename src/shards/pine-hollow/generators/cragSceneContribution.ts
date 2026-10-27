
/** Z2 rows compiled from the original crag kit, fixed skin slots and cave frame. */
import { parseWorldScenePlacement , type WorldScenePlacementRow as WorldScenePlacementRowType } from '@wildshard/format/worldScenePlacement';
import { pineCragScenes } from './bake-crag-scenes.mjs';
import { nameBlob, nameMeshoptBlob, type NamedBlob as NamedBlobType } from '@wildshard/sdk/blobs';
import { CRAG_LOOK } from './cragLook';

const { rows: crags, glbs } = await pineCragScenes();

/** Only fixed skin templates and their batch/placement wrappers are tier-exclusive. */
function membership(id: string): { readonly tier?: 'phone' | 'desktop' } {
  if (id.startsWith('phone-skin-') || id.startsWith('crags.phone')) return { tier: 'phone' };
  if (id.startsWith('desktop-skin-') || id.startsWith('crags.desktop')) return { tier: 'desktop' };
  return {};
}

function withMembership<T extends { readonly id: string }>(row: T): T & { readonly tier?: 'phone' | 'desktop' } {
  return { ...row, ...membership(row.id) };
}

export const CRAG_MODEL_ROWS: { key: string; id: string; name: string; file: string; category: string; pipeline: string; surface: string; assembly: string; defaults: { module: string; }; variants: { id: string; label: string; params: { module: string; }; }[]; choices: { id: string; params: { module: string; }; size: number[]; draws: { id: string; library: string; model: string; material: string; castShadow: boolean; receiveShadow: boolean; }[]; lods: { from: { phone: number; desktop: number; }; draws: { id: string; library: string; model: string; material: string; castShadow: boolean; receiveShadow: boolean; }[]; }[]; colliders: { kind: string; x: number; y: number; z: number; surface: string; points: number[]; }[]; }[]; }[] = crags.moduleModels;
export const CRAG_PLACEMENT_ROWS: WorldScenePlacementRowType[] = crags.placements.map(row => parseWorldScenePlacement(withMembership(row)));
export const CRAG_BATCH_ROWS: ({ id: string; material: string; name: string; geometry: { library: string; model: string; }[]; fixed: ({ lod0: number; lod1: number; near: number; far: number; sphere: number[]; matrix: number[]; merge: boolean; } | { lod0: number; lod1: number; near: number; far: number; sphere: number[]; matrix: number[]; merge?: never; })[]; capacity: { instances: number; vertices: number; indices: number; }; sortObjects: boolean; perObjectFrustumCulled: boolean; castShadow: boolean; receiveShadow: boolean; cull: { frustum: boolean; radiusBias: number; step: number; }; } & { readonly tier?: "phone" | "desktop"; })[] = crags.batches.map(withMembership);
export const CRAG_LIBRARY: { id: string; kind: "owned"; models: ({ id: string; file: string; attributes: NonNullable<unknown>; } & { readonly tier?: "phone" | "desktop"; })[]; } = { id: 'crags', kind: 'owned' as const, models: crags.models.map(withMembership) };
export const CRAG_MATERIAL: { id: string; kind: "look"; look: string; } = { id: 'crag', kind: 'look' as const, look: CRAG_LOOK };
// GR8 G30: the crag shapes' GLBs, built in memory: raw for the map assembly, meshopt-named for the output.
/** The crag shapes' raw GLBs. */
export const CRAG_RAW_MODELS: NamedBlobType[] = glbs.map(([name, bytes]) => nameBlob(name, 'glb', bytes));
/** The crag shapes' GLBs, meshopt-named as their `meshopt: true` sources were. */
export const CRAG_PACKED_MODELS: NamedBlobType[] = await Promise.all(glbs.map(([name, bytes]) => nameMeshoptBlob(name, bytes)));
export const CRAG_CAVE_ROWS: { meta: { version: number; holes: { lx: number; lz: number; hw: number; hd: number; y0: number; y1: number; }[]; cuts: { lx: number; lz: number; hw: number; hd: number; below: number; }[]; spots: { lx: number; lz: number; r: number; }[]; inside: number[][]; shaft: { top: number[]; foot: number[]; r0: number; r1: number; }; drips: number[][]; floor: number[][]; tris: { cave: number; far: number; col: number; }; }; shell: { kind: string; x: number; y: number; z: number; surface: string; vertices: number[]; indices: number[]; }; } = crags.cave;
