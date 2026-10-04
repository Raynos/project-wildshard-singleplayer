/**
 * The scree fan (E315 M2): two patches of granite rubble from PH-B2's Blender kit (scripts/blender/pine-hollow/crags/ →
 * crags.glb: `scree-a`, `scree-b`, each a LOD0 and a LOD1), lying with the slope below the Ridge's cliffs
 * (src/shards/pine-hollow/world/crags.ts `placeCrags`), drawn in the crags' one BatchedMesh. Ankle-high: walked over, no collider.
 */
import { defineModel } from '@wildshard/engine/models/model';
import { cragPart, CRAG_LOD } from '../world/cragKit';

export const SCREE_MODULES = ['scree-a', 'scree-b'] as const;

export interface ScreeParams { readonly module: (typeof SCREE_MODULES)[number] }

export const scree = defineModel<ScreeParams>({
  id: 'pine-hollow/scree', name: 'Scree fan', category: 'nature', pipeline: 'blender',
  file: 'src/shards/pine-hollow/models/scree.ts', surface: 'rock',
  defaults: { module: 'scree-a' },
  variants: SCREE_MODULES.map((module) => ({ id: module, label: `Scree ${module.slice(-1).toUpperCase()}`, params: { module } })),
  build: (ctx, p) => cragPart(ctx, p.module, false),
  lods: [{ from: CRAG_LOD.scree, build: (ctx, p) => cragPart(ctx, p.module, true) }],
});
