
/** Z2 rows compiled from the original crag kit, fixed skin slots and cave frame. */
import { parseWorldScenePlacement , type WorldScenePlacementRow as WorldScenePlacementRowType } from '@wildshard/format/worldScenePlacement';
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

export const CRAG_MODEL_ROWS: { key: string; id: string; name: string; file: string; category: string; pipeline: string; surface: string; assembly: string; defaults: { module: string; }; variants: { id: string; label: string; params: { module: string; }; }[]; choices: { id: string; params: { module: string; }; size: number[]; draws: { id: string; library: string; model: string; material: string; castShadow: boolean; receiveShadow: boolean; }[]; lods: { from: { phone: number; desktop: number; }; draws: { id: string; library: string; model: string; material: string; castShadow: boolean; receiveShadow: boolean; }[]; }[]; colliders: { kind: string; x: number; y: number; z: number; surface: string; points: number[]; }[]; }[]; }[] = crags.moduleModels;
export const CRAG_PLACEMENT_ROWS: WorldScenePlacementRowType[] = crags.placements.map(row => parseWorldScenePlacement(withMembership(row)));
export const CRAG_BATCH_ROWS: ({ id: string; material: string; name: string; geometry: { library: string; model: string; }[]; fixed: ({ lod0: number; lod1: number; near: number; far: number; sphere: number[]; matrix: number[]; merge: boolean; } | { lod0: number; lod1: number; near: number; far: number; sphere: number[]; matrix: number[]; merge?: never; })[]; capacity: { instances: number; vertices: number; indices: number; }; sortObjects: boolean; perObjectFrustumCulled: boolean; castShadow: boolean; receiveShadow: boolean; cull: { frustum: boolean; radiusBias: number; step: number; }; } & { readonly tier?: "phone" | "desktop"; })[] = crags.batches.map(withMembership);
export const CRAG_LIBRARY: { id: string; kind: "owned"; models: ({ id: string; file: string; attributes: NonNullable<unknown>; } & { readonly tier?: "phone" | "desktop"; })[]; } = { id: 'crags', kind: 'owned' as const, models: crags.models.map(withMembership) };
export const CRAG_MATERIAL: { id: string; kind: "look"; look: string; } = { id: 'crag', kind: 'look' as const, look: CRAG_LOOK };
export const CRAG_MODEL_BLOBS: { name: string; kind: string; source: string; }[] = crags.blobs;
export const CRAG_CAVE_ROWS: { meta: { version: number; holes: { lx: number; lz: number; hw: number; hd: number; y0: number; y1: number; }[]; cuts: { lx: number; lz: number; hw: number; hd: number; below: number; }[]; spots: { lx: number; lz: number; r: number; }[]; inside: number[][]; shaft: { top: number[]; foot: number[]; r0: number; r1: number; }; drips: number[][]; floor: number[][]; tris: { cave: number; far: number; col: number; }; }; shell: { kind: string; x: number; y: number; z: number; surface: string; vertices: number[]; indices: number[]; }; } = crags.cave;
