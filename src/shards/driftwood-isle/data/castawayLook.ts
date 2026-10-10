// SHARD-PLATFORM M3 (look-family rows): the smoke over Wendell's campfire (npc/Castaway.ts builds it through
// @wildshard/sdk/looks/smokeColumn): the breadcrumb the intro objective points at, seen from the pier.
import type { SmokeColumnRow } from '@wildshard/sdk/looks/smokeColumn';

/**
 * 42 puffs climbing 21 m over 13 s each (life speeds 0.85–1.15: uneven spacing, a broken column), from 1.2 m over the
 * fire, leaning 5 m downwind by the top along the trade wind off the sea (0.8, 0.55, NPC-local); 0.9–5.3 m puffs, in over
 * the first 8 % of a life, out over the last 45 %; 0.12 opacity close, 0.58 from 30 m; still past 260 m (the whole island).
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
  startOpacity: 0.42,
  opacity: [0.12, 0.46],
  opacityFrom: 8,
  opacityTo: 30,
  far: 260,
  bounds: { offset: [2, 9, 1.5], radius: 14 },
  renderOrder: 4,
  name: 'castaway-smoke',
  patch: { id: 'driftwood.castaway-smoke', key: 'castaway-smoke-v2' },
};
