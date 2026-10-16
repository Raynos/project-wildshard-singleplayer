/**
 * The canoe (E315 M2): a TRELLIS.2 generation (PINE-HOLLOW-REMASTER PH-B3 / PH-C8,
 * public/assets/models/pine-hollow-hero/canoe/ + its LOD1): a birch-bark canoe, its bow toward local +Z. Drawn up on the
 * pond's W shore (src/shards/pine-hollow/world/landmarks.ts `CANOE_SITE`); the canoe secret hides it while you paddle the ride's own.
 * LOD0 (with shadow) within 40 m, LOD1 past it; collides as the hull of ≤ 180 of its LOD1's vertices (wood).
 */
import { defineModel } from '@wildshard/engine/models/model';
import { heroFar, heroHull, heroNear } from '../world/hero';

export const canoe = defineModel<Record<string, never>>({
  id: 'pine-hollow/canoe', name: 'Canoe', category: 'props', pipeline: 'trellis',
  file: 'src/shards/pine-hollow/models/canoe.ts', surface: 'wood',
  defaults: {},
  build: (ctx) => heroNear(ctx, 'canoe'),
  lods: [{ from: 40, build: (ctx) => heroFar(ctx, 'canoe') }],
  colliders: (_p, ctx) => { const h = heroHull(ctx, 'canoe'); return h ? [{ kind: 'hull', x: 0, y: 0, z: 0, surface: 'wood', points: h }] : []; },
});
