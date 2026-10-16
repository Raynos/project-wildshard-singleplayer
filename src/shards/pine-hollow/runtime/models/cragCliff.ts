/**
 * The Ridge's granite as rows (E315 M2, G465): PH-B2's jointed granite, built in Blender (src/shards/pine-hollow/blender/crags/
 * build_crags.py → public/assets/models/pine-hollow-crags/crags.glb, and E322 F-L2's fused, weathered cliff masses from
 * build_crags_b.py overlaid on it), each module a LOD0 and a LOD1 with Cycles vertex AO in the triplanar granite (Poly Haven
 * CC0 `mossy_rock`, ledge grit from the terrain's `rock_ground`). A row is one model: its modules as variants (`hero` is the
 * lookout's ~26 m granite prow), its LOD band (`CRAG_LOD[lod]` near, `CRAG_LOD[far]` gone) and the hull cap of a copy's
 * collider (≤ that many of its LOD1's vertices; 0: ankle-high scree, walked over). ../world/crags.ts places the cliffs, the
 * talus boulders and the scree fans in this order on every steep face of the Ridge, the pass and the Den's walls, fronts
 * down the slope, into ONE BatchedMesh with the face skin and the cave (one draw + one per shadow cascade).
 */
import { defineModel, type ModelDef } from '@wildshard/engine/models/model';
import { cragHull, cragPart, CRAG_LOD } from '../world/cragKit';

const ROWS = [
  { id: 'crag-cliff', name: 'Ridge crag', lod: 'big', far: 'bigFar', hull: 110, modules: { 'cliff-a': 'Cliff band A', 'cliff-b': 'Cliff band B', 'cliff-c': 'Cliff band C', buttress: 'Buttress', slab: 'Slab', 'tor-a': 'Tor A', 'tor-b': 'Tor B', hero: 'Hero crag' } },
  { id: 'crag-boulder', name: 'Crag boulder', lod: 'small', far: 'smallFar', hull: 60, modules: { 'boulder-a': 'Boulder A', 'boulder-b': 'Boulder B', 'boulder-c': 'Boulder C' } },
  { id: 'scree', name: 'Scree fan', lod: 'scree', far: 'screeFar', hull: 0, modules: { 'scree-a': 'Scree A', 'scree-b': 'Scree B' } },
] as const;

export interface CragParams { readonly module: string }

/** The crag models in placing order: each with its module ids and its cull range (m). */
export const CRAG_MODELS: readonly { readonly model: ModelDef<CragParams>; readonly modules: readonly string[]; readonly far: number }[] = ROWS.map((r) => {
  const modules = Object.keys(r.modules), labels: Readonly<Record<string, string>> = r.modules;
  return { modules, far: CRAG_LOD[r.far], model: defineModel<CragParams>({
    id: `pine-hollow/${r.id}`, name: r.name, category: 'nature', pipeline: 'blender', file: 'src/shards/pine-hollow/runtime/models/cragCliff.ts', surface: 'rock',
    defaults: { module: modules[0] ?? '' }, variants: modules.map((module) => ({ id: module, label: labels[module] ?? module, params: { module } })),
    build: (ctx, p) => cragPart(ctx, p.module, false), lods: [{ from: CRAG_LOD[r.lod], build: (ctx, p) => cragPart(ctx, p.module, true) }],
    ...(r.hull > 0 ? { colliders: (p, ctx) => { const h = cragHull(ctx, p.module, r.hull); return h ? [{ kind: 'hull', x: 0, y: 0, z: 0, points: h, surface: 'rock' }] : []; } } : {}),
  }) };
});
