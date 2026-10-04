/**
 * The contract board (E315 M2): a TRELLIS.2 generation (PINE-HOLLOW-REMASTER PH-B3 / PH-C6,
 * public/assets/models/pine-hollow-hero/contract-board/ + its LOD1): a roofed notice board with its hunting contracts
 * pinned up. Stands by the hunting lodge's porch steps (src/shards/pine-hollow/world/landmarks.ts `contractBoardSite`). LOD0 (with
 * shadow) within 40 m, LOD1 past it; collides as the hull of ≤ 180 of its LOD1's vertices (wood).
 */
import { defineModel } from '@wildshard/engine/models/model';
import { heroFar, heroHull, heroNear } from '../world/hero';

export const contractBoard = defineModel<Record<string, never>>({
  id: 'pine-hollow/contract-board', name: 'Contract board', category: 'props', pipeline: 'trellis',
  file: 'src/shards/pine-hollow/models/contractBoard.ts', surface: 'wood',
  defaults: {},
  build: (ctx) => heroNear(ctx, 'contract-board'),
  lods: [{ from: 40, build: (ctx) => heroFar(ctx, 'contract-board') }],
  colliders: (_p, ctx) => { const h = heroHull(ctx, 'contract-board'); return h ? [{ kind: 'hull', x: 0, y: 0, z: 0, surface: 'wood', points: h }] : []; },
});
