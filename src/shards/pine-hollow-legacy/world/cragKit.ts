/**
 * The Ridge's granite kit, as its models read it (E315 M2): PH-B2's Blender kit (scripts/blender/pine-hollow/crags/
 * build_crags.py → public/assets/models/pine-hollow-crags/crags.glb, each module a LOD0 `<id>` and a LOD1 `<id>-lod1`,
 * with Cycles vertex AO) and its one triplanar granite material. src/shards/pine-hollow/world/crags.ts loads it and hands it to the
 * shard's model context before it places the modules (../models/cragCliff.ts, cragBoulder.ts, scree.ts).
 */
import * as THREE from 'three';
import { TIER } from '@wildshard/engine/core/tier';
import { vertexHull } from '@wildshard/engine/models/glb';
import type { ModelContext, ModelPart } from '@wildshard/engine/models/model';

/** LOD / range per kind (m, camera to the module less half its radius): the cliffs' full model near, their LOD1 to the slab's edge */
export const CRAG_LOD = TIER === 'phone'
  ? { big: 95, bigFar: 900, small: 38, smallFar: 170, scree: 30, screeFar: 110, cave: 70 }
  : { big: 170, bigFar: 900, small: 70, smallFar: 320, scree: 55, screeFar: 200, cave: 110 };

export interface CragKit {
  /** node name (`cliff-a`, `cliff-a-lod1` …) → its geometry in the module's own frame (base centre at the origin) */
  readonly kit: ReadonlyMap<string, THREE.BufferGeometry>;
  /** the granite (null: a build without its textures — the navmesh bake) */
  readonly mat: THREE.Material | null;
}

const KEY = 'pine-hollow/crags:kit';

/** hand the loaded kit to this shard's models */
export function useCragKit(ctx: ModelContext, kit: CragKit): void { ctx.once(KEY, () => kit); }

const kitOf = (ctx: ModelContext): CragKit => ctx.once<CragKit>(KEY, () => { throw new Error('[crags] the kit is not loaded (PineCrags.build hands it over)'); });

/** a module's part at a level (the LOD1 falls back to LOD0); none when the kit has no such node */
export function cragPart(ctx: ModelContext, id: string, lod1: boolean): ModelPart[] {
  const { kit, mat } = kitOf(ctx);
  const g = (lod1 ? kit.get(`${id}-lod1`) : undefined) ?? kit.get(id);
  return g ? [{ geometry: g, material: mat ?? placeholder(ctx), castShadow: true, receiveShadow: true }] : [];
}

/** a module's collision hull: ≤ `maxPts` of its LOD1's vertices (LOD0's when it has none), own space */
export function cragHull(ctx: ModelContext, id: string, maxPts: number): Float32Array | null {
  return ctx.once(`${KEY}:hull:${id}`, () => {
    const { kit } = kitOf(ctx);
    const g = kit.get(`${id}-lod1`) ?? kit.get(id);
    return g ? vertexHull(g, maxPts) : null;
  });
}

/** without its textures (the bake) a module is never drawn, but a part needs a material */
function placeholder(ctx: ModelContext): THREE.Material {
  return ctx.once(`${KEY}:placeholder`, () => new THREE.MeshBasicMaterial());
}
