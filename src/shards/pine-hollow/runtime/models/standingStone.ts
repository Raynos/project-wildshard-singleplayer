/**
 * The standing stone (E315 M2): three TRELLIS.2 generations of a carved granite menhir (PINE-HOLLOW-REMASTER PH-B3,
 * scripts/img2mesh/props/pine-hollow-hero.json → public/assets/models/pine-hollow-hero/stone-{a,b,c}/), one variant each,
 * with their LOD1 files. The King's clearing rings its arena with seven of them (src/shards/pine-hollow/world/landmarks.ts): each shape
 * placed as its own set, LOD0 (with shadow) until the nearest stone of that shape is 60 m off, LOD1 past it. A copy
 * collides as the hull of ≤ 180 of its LOD1's vertices.
 */
import { defineModel } from '@wildshard/engine/models/model';
import { heroFar, heroHull, heroNear } from '../world/hero';
import type { PineHeroId } from '../world/heroFiles';

export const STONE_KINDS = ['stone-a', 'stone-b', 'stone-c'] as const satisfies readonly PineHeroId[];

export interface StandingStoneParams { readonly kind: (typeof STONE_KINDS)[number] }

export const standingStone = defineModel<StandingStoneParams>({
  id: 'pine-hollow/standing-stone', name: 'Standing stone', category: 'nature', pipeline: 'trellis',
  file: 'src/shards/pine-hollow/models/standingStone.ts', surface: 'stone',
  defaults: { kind: 'stone-a' },
  variants: STONE_KINDS.map((kind) => ({ id: kind, label: `Stone ${kind.slice(-1).toUpperCase()}`, params: { kind } })),
  build: (ctx, p) => heroNear(ctx, p.kind),
  lods: [{ from: 60, build: (ctx, p) => heroFar(ctx, p.kind) }],
  colliders: (p, ctx) => { const h = heroHull(ctx, p.kind); return h ? [{ kind: 'hull', x: 0, y: 0, z: 0, points: h }] : []; },
});
