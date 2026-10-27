import type { BufferGeometry } from 'three';
import type { PineSources } from './pineSources';
import type { TimberWorld } from './timberWorldRows';

interface CragDraw { id: string; library: string; model: string; material: string; castShadow: boolean; receiveShadow: boolean }
/** One crag module's Explorer model row. */
export interface CragModelRow { key: string; id: string; name: string; file: string; category: string; pipeline: string; surface: string; assembly: string; defaults: { module: string; }; variants: { id: string; label: string; params: { module: string; }; }[]; choices: { id: string; params: { module: string; }; size: number[]; draws: CragDraw[]; lods: { from: { phone: number; desktop: number; }; draws: CragDraw[]; }[]; colliders: { kind: string; x: number; y: number; z: number; surface: string; points: number[]; }[]; }[] }
/** One tier's crag batch. */
export interface CragBatchRow { id: string; material: string; name: string; geometry: { library: string; model: string; }[]; fixed: ({ lod0: number; lod1: number; near: number; far: number; sphere: number[]; matrix: number[]; merge: boolean; } | { lod0: number; lod1: number; near: number; far: number; sphere: number[]; matrix: number[]; merge?: never; })[]; capacity: { instances: number; vertices: number; indices: number; }; sortObjects: boolean; perObjectFrustumCulled: boolean; castShadow: boolean; receiveShadow: boolean; cull: { frustum: boolean; radiusBias: number; step: number; } }
/** The bear cave's authored metadata and its collision shell. */
export interface CragCaveRows { meta: { version: number; holes: { lx: number; lz: number; hw: number; hd: number; y0: number; y1: number; }[]; cuts: { lx: number; lz: number; hw: number; hd: number; below: number; }[]; spots: { lx: number; lz: number; r: number; }[]; inside: number[][]; shaft: { top: number[]; foot: number[]; r0: number; r1: number; }; drips: number[][]; floor: number[][]; tris: { cave: number; far: number; col: number; }; }; shell: { kind: string; x: number; y: number; z: number; surface: string; vertices: number[]; indices: number[]; } }

export function bakeCragSceneSources(sources: PineSources): Promise<Map<string, BufferGeometry>>;
export function cragWorldRows(shapes: ReadonlyMap<string, BufferGeometry>, crags: TimberWorld['cragAssembly']): unknown;
export function caveShellRows(shapes: ReadonlyMap<string, BufferGeometry>): unknown;
/** The crag scenes' rows and each shape's GLB by product name, built once per sources. */
export function pineCragScenes(sources: PineSources): Promise<{
  rows: { models: { id: string; file: string; attributes: Record<string, never> }[]; moduleModels: CragModelRow[];
    placements: { readonly id: string }[]; batches: CragBatchRow[]; cave: CragCaveRows };
  glbs: [string, Uint8Array][];
}>;
