/**
 * The waystone lantern (E315 M2): a TRELLIS.2 generation (PINE-HOLLOW-REMASTER PH-B3 / PH-C1,
 * public/assets/models/pine-hollow-hero/waystone/ + its LOD1): a carved post with an iron bracket and a lantern. Three
 * stand where the ranger's lanterns are relit (src/shards/pine-hollow/world/landmarks.ts `waystoneSites`); their flames and glow are
 * the landmarks' (lamp sites on `sky.lamps`). LOD0 (with shadow) until the nearest is 45 m off, LOD1 past it; a copy
 * collides as the hull of ≤ 180 of its LOD1's vertices.
 */
import { defineModel } from '@wildshard/engine/models/model';
import { heroFar, heroHull, heroNear } from '../world/hero';

export const waystone = defineModel<Record<string, never>>({
  id: 'pine-hollow/waystone', name: 'Waystone lantern', category: 'props', pipeline: 'trellis',
  file: 'src/shards/pine-hollow/models/waystone.ts', surface: 'stone',
  defaults: {},
  build: (ctx) => heroNear(ctx, 'waystone'),
  lods: [{ from: 45, build: (ctx) => heroFar(ctx, 'waystone') }],
  colliders: (_p, ctx) => { const h = heroHull(ctx, 'waystone'); return h ? [{ kind: 'hull', x: 0, y: 0, z: 0, points: h }] : []; },
});
