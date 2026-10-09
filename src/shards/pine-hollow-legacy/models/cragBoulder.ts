/**
 * The crag boulder (E315 M2): three fallen granite blocks of PH-B2's Blender kit (scripts/blender/pine-hollow/crags/ →
 * crags.glb: `boulder-a` … `boulder-c`, each a LOD0 and a LOD1), the talus under the Ridge's cliffs
 * (src/shards/pine-hollow/world/crags.ts `placeCrags`), drawn in the crags' one BatchedMesh. LOD0 near, LOD1 further, gone past the
 * talus range; a copy collides as the hull of ≤ 60 of its LOD1's vertices.
 */
import { defineModel } from '@wildshard/engine/models/model';
import { cragHull, cragPart, CRAG_LOD } from '../world/cragKit';

export const BOULDER_MODULES = ['boulder-a', 'boulder-b', 'boulder-c'] as const;

export interface CragBoulderParams { readonly module: (typeof BOULDER_MODULES)[number] }

export const cragBoulder = defineModel<CragBoulderParams>({
  id: 'pine-hollow/crag-boulder', name: 'Crag boulder', category: 'nature', pipeline: 'blender',
  file: 'src/shards/pine-hollow/models/cragBoulder.ts', surface: 'rock',
  defaults: { module: 'boulder-a' },
  variants: BOULDER_MODULES.map((module) => ({ id: module, label: `Boulder ${module.slice(-1).toUpperCase()}`, params: { module } })),
  build: (ctx, p) => cragPart(ctx, p.module, false),
  lods: [{ from: CRAG_LOD.small, build: (ctx, p) => cragPart(ctx, p.module, true) }],
  colliders: (p, ctx) => { const h = cragHull(ctx, p.module, 60); return h ? [{ kind: 'hull', x: 0, y: 0, z: 0, points: h, surface: 'rock' }] : []; },
});
