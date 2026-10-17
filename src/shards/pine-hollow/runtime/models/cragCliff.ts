/**
 * The Ridge's granite as rows (E315 M2, G465): PH-B2's jointed granite, built in Blender (src/shards/pine-hollow/blender/crags/
 * build_crags.py → public/assets/models/pine-hollow-crags/crags.glb, and E322 F-L2's fused, weathered cliff masses from
 * build_crags_b.py overlaid on it), each module a LOD0 `<id>` and a LOD1 `<id>-lod1` with Cycles vertex AO in the triplanar
 * granite (Poly Haven CC0 `mossy_rock`, ledge grit from the terrain's `rock_ground`). A row is one model: its modules as
 * variants (`hero` is the lookout's ~26 m granite prow), its LOD band (`lod[near]` near, `lod[far]` gone) and its copies'
 * collider: the generated hull of the module (≤ 110 / 60 of its LOD1's vertices, `cragAssembly.hulls`; scree has none, walked
 * over). ../world/crags.ts loads the kit, hands it here and places the cliffs, the talus boulders and the scree fans in this
 * order on every steep face of the Ridge, the pass and the Den's walls, fronts down the slope, into ONE BatchedMesh with the
 * face skin and the cave (one draw + one per shadow cascade).
 */
import type * as THREE from 'three';
import { defineModel, type ModelDef } from '@wildshard/engine/models/model';

const ROWS = [
  { id: 'crag-cliff', name: 'Ridge crag', lod: 'big', far: 'bigFar', modules: { 'cliff-a': 'Cliff band A', 'cliff-b': 'Cliff band B', 'cliff-c': 'Cliff band C', buttress: 'Buttress', slab: 'Slab', 'tor-a': 'Tor A', 'tor-b': 'Tor B', hero: 'Hero crag' } },
  { id: 'crag-boulder', name: 'Crag boulder', lod: 'small', far: 'smallFar', modules: { 'boulder-a': 'Boulder A', 'boulder-b': 'Boulder B', 'boulder-c': 'Boulder C' } },
  { id: 'scree', name: 'Scree fan', lod: 'scree', far: 'screeFar', modules: { 'scree-a': 'Scree A', 'scree-b': 'Scree B' } },
] as const;

export interface CragParams { readonly module: string }
/** what the crag models draw from: the kit's nodes, the granite, this tier's LOD ranges and the generated hulls */
export interface CragKit {
  readonly kit: ReadonlyMap<string, THREE.BufferGeometry>;
  readonly mat: THREE.Material;
  readonly lod: Readonly<Record<(typeof ROWS)[number]['lod' | 'far'], number>>;
  readonly hulls: Readonly<Record<string, { readonly points: readonly number[] } | undefined>>;
}

/** The crag models in placing order: each with its module ids and its cull range (m). */
export function cragModels({ kit, mat, lod, hulls }: CragKit): readonly { readonly model: ModelDef<CragParams>; readonly modules: readonly string[]; readonly far: number }[] {
  const part = (id: string, lod1: boolean) => { const g = (lod1 ? kit.get(`${id}-lod1`) : undefined) ?? kit.get(id); return g ? [{ geometry: g, material: mat, castShadow: true, receiveShadow: true }] : []; };
  const points = new Map(Object.entries(hulls).map(([id, row]) => [id, new Float32Array(row?.points ?? [])]));
  return ROWS.map((r) => {
    const modules = Object.keys(r.modules), labels: Readonly<Record<string, string>> = r.modules;
    return { modules, far: lod[r.far], model: defineModel<CragParams>({
      id: `pine-hollow/${r.id}`, name: r.name, category: 'nature', pipeline: 'blender', file: 'src/shards/pine-hollow/runtime/models/cragCliff.ts', surface: 'rock',
      defaults: { module: modules[0] ?? '' }, variants: modules.map((module) => ({ id: module, label: labels[module] ?? module, params: { module } })),
      build: (_ctx, p) => part(p.module, false), lods: [{ from: lod[r.lod], build: (_ctx, p) => part(p.module, true) }],
      ...(modules.some((m) => points.has(m)) ? { colliders: (p: CragParams) => { const h = points.get(p.module); return h ? [{ kind: 'hull' as const, x: 0, y: 0, z: 0, points: h, surface: 'rock' as const }] : []; } } : {}),
    }) };
  });
}
