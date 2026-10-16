import { DRIFTWOOD_FAUNA_PLANS, ENEMY_COUNTS } from '../data/fauna';
import type { SpawnTableRow } from '@wildshard/engine/ai/encounters';

/** Counts consume one draw per tidepool/grove, in the original placement order. */
export const DRIFTWOOD_ENEMIES: SpawnTableRow = {
  id: 'spawn.driftwood.enemies', table: { mode: 'each', rows: [
    { item: { kind: 'crab' }, weight: 1, count: ENEMY_COUNTS.tidepool, when: (ctx) => ctx.tags.includes('tidepool') },
    { item: { kind: 'monkey' }, weight: 1, count: ENEMY_COUNTS.grove, when: (ctx) => ctx.tags.includes('grove') },
    { item: { kind: 'sailor', variant: 'sailor' }, weight: 1, count: 1, when: (ctx) => ctx.tags.includes('hold') },
  ] },
};
export const DRIFTWOOD_PRACTICE: SpawnTableRow & { respawn: { delay: number; away: number } } = {
  id: 'spawn.driftwood.practice', table: { mode: 'each', rows: [{ item: { kind: 'crab', variant: 'small' }, weight: 1, count: 1 }] },
  respawn: { delay: 45, away: 30 },
};
export const DRIFTWOOD_FAUNA: SpawnTableRow = {
  id: 'spawn.driftwood.fauna', table: { mode: 'each', rows: DRIFTWOOD_FAUNA_PLANS.map((plan) => ({
    item: { kind: plan.kind }, weight: 1, count: plan.count,
  })) },
};
