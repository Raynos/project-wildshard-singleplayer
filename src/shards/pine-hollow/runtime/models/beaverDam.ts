/**
 * The beaver dam (E315 M2): a TRELLIS.2 generation (PINE-HOLLOW-REMASTER PH-B3,
 * public/assets/models/pine-hollow-hero/beaver-dam/ + its LOD1): a woven dam of gnawed sticks and mud, its length along
 * its local X. Placed across the creek on the pond's sill (src/shards/pine-hollow/world/landmarks.ts). LOD0 (with shadow) within 50 m,
 * LOD1 past it; collides as the hull of ≤ 180 of its LOD1's vertices (wood).
 */
import { defineModel } from '@wildshard/engine/models/model';
import { heroFar, heroHull, heroNear } from '../world/hero';

export const beaverDam = defineModel<Record<string, never>>({
  id: 'pine-hollow/beaver-dam', name: 'Beaver dam', category: 'nature', pipeline: 'trellis',
  file: 'src/shards/pine-hollow/models/beaverDam.ts', surface: 'wood',
  defaults: {},
  build: (ctx) => heroNear(ctx, 'beaver-dam'),
  lods: [{ from: 50, build: (ctx) => heroFar(ctx, 'beaver-dam') }],
  colliders: (_p, ctx) => { const h = heroHull(ctx, 'beaver-dam'); return h ? [{ kind: 'hull', x: 0, y: 0, z: 0, surface: 'wood', points: h }] : []; },
});
