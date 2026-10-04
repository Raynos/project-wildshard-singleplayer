/**
 * The Ridge crag (E315 M2): PH-B2's jointed granite, built in Blender (scripts/blender/pine-hollow/crags/build_crags.py →
 * public/assets/models/pine-hollow-crags/crags.glb) — seven big modules as variants: three cliff bands, a buttress, an
 * exfoliation slab and two tors, each a LOD0 and a LOD1 with Cycles vertex AO, in the triplanar granite (Poly Haven CC0
 * `mossy_rock`, ledge grit from the terrain's `rock_ground`). src/shards/pine-hollow/world/crags.ts places them on every steep face of
 * the Ridge, the pass and the Den's walls (`placeCrags`), fronts down the slope, into ONE BatchedMesh with the boulders,
 * the scree, the face skin and the cave (one draw + one per shadow cascade). LOD0 near, LOD1 to the slab's edge; a copy
 * collides as the hull of ≤ 110 of its LOD1's vertices. E322 F-L2 (Jake picked B): the cliff bands, the buttress and
 * the slab are crags-b.glb's fused, weathered masses (build_crags_b.py, overlaid on crags.glb's), and `hero` is the
 * lookout's ~26 m granite prow.
 */
import { defineModel } from '@wildshard/engine/models/model';
import { cragHull, cragPart, CRAG_LOD } from '../world/cragKit';

export const CLIFF_MODULES = ['cliff-a', 'cliff-b', 'cliff-c', 'buttress', 'slab', 'tor-a', 'tor-b', 'hero'] as const;

export interface CragCliffParams { readonly module: (typeof CLIFF_MODULES)[number] }

const LABEL: Record<CragCliffParams['module'], string> = { 'cliff-a': 'Cliff band A', 'cliff-b': 'Cliff band B', 'cliff-c': 'Cliff band C', buttress: 'Buttress', slab: 'Slab', 'tor-a': 'Tor A', 'tor-b': 'Tor B', hero: 'Hero crag' };

export const cragCliff = defineModel<CragCliffParams>({
  id: 'pine-hollow/crag-cliff', name: 'Ridge crag', category: 'nature', pipeline: 'blender',
  file: 'src/shards/pine-hollow/models/cragCliff.ts', surface: 'rock',
  defaults: { module: 'cliff-a' },
  variants: CLIFF_MODULES.map((module) => ({ id: module, label: LABEL[module], params: { module } })),
  build: (ctx, p) => cragPart(ctx, p.module, false),
  lods: [{ from: CRAG_LOD.big, build: (ctx, p) => cragPart(ctx, p.module, true) }],
  colliders: (p, ctx) => { const h = cragHull(ctx, p.module, 110); return h ? [{ kind: 'hull', x: 0, y: 0, z: 0, points: h, surface: 'rock' }] : []; },
});
