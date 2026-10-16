// G466 C2: the graphs are authored graph JSON (data/lookGraphs.json).
import type { SmokeColumnRow } from './lookRows';

/**
 * Driftwood's smoke column (the castaway's campfire breadcrumb, generators/castawayLook.ts) as an SF59 material graph
 * (SHARD-PLATFORM W2 C2; the shardfile's `look.materials`, compiled by the hybrid runtime and drawn on
 * runtime/looks/smokeColumn.ts's quads): unlit, alpha-blended, fogged, no depth write. Each puff is one camera-facing
 * quad posed in the vertex stage from its `aPuff` (start age, life speed, start seed) on the frame clock, the way the CPU
 * column stepped it: it rises (slowing as it cools), leans downwind more the higher it climbs, wanders on its own slow
 * turbulence and grows; its seed steps by `reseed` each time it restarts, so the column stays broken. It fades in over the
 * fire and out toward the top, and the whole column thins with the camera's distance (thin up close, a breadcrumb far off).
 * The puff is the soft round sprite the stock points program drew (a white radial gradient), a point's world size: its
 * pixel size `size × (height / 2) / depth` is `size × tan(fov / 2)` metres on the game camera's 72° fov.
 */

/** the look.materials id the castaway's smoke wears */
export const SMOKE_LOOK = 'driftwood-castaway-smoke';

/**
 * 42 puffs climbing 21 m over 13 s each (life speeds 0.85–1.15: uneven spacing, a broken column), from 1.2 m over the
 * fire, leaning 5 m downwind by the top along the trade wind off the sea (0.8, 0.55, NPC-local); 0.9–5.3 m puffs, in over
 * the first 8 % of a life, out over the last 45 %; 0.12 opacity close, 0.58 from 30 m (posed on the GPU: data/smokeLook.ts).
 */
export const CASTAWAY_SMOKE: SmokeColumnRow = {
  count: 42,
  rise: 21,
  life: 13,
  rate: [0.85, 0.3],
  seedSpread: 10,
  reseed: 1.37,
  seed: 0x5e0c,
  ease: 0.9,
  linear: 0.1,
  base: 1.2,
  lean: 5,
  wind: [0.8, 0.55],
  wanderX: [8, 5, 0.2, 1.1],
  wanderZ: [6.3, 3, 0.2, 0.9],
  size: [0.9, 4.4],
  fadeIn: 0.08,
  fadeOut: 0.45,
  fadePow: 1.3,
  thin: [0.45, 0.55, 7.7],
  color: [0.8, 0.79, 0.77],
  opacity: [0.12, 0.46],
  opacityFrom: 8,
  opacityTo: 30,
  bounds: { offset: [2, 9, 1.5], radius: 14 },
  renderOrder: 4,
  name: 'castaway-smoke',
};
