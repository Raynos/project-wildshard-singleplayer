import { DRIFTWOOD_FAUNA_PLANS } from '../data/fauna';
import { WeightedTable } from '@wildshard/engine/ai/weighted';
import type { SpawnTableRow, SpawnContext } from '@wildshard/engine/ai/encounters';

/** Counts consume one draw per tidepool/grove, in the original placement order. */
export const DRIFTWOOD_ENEMIES: SpawnTableRow = {
  id: 'spawn.driftwood.enemies', table: { mode: 'each', rows: [
    { item: { kind: 'crab' }, weight: 1, count: [3, 5], when: (ctx) => ctx.tags.includes('tidepool') },
    { item: { kind: 'monkey' }, weight: 1, count: [3, 4], when: (ctx) => ctx.tags.includes('grove') },
    { item: { kind: 'sailor', variant: 'sailor' }, weight: 1, count: 1, when: (ctx) => ctx.tags.includes('hold') },
  ] },
};
export const DRIFTWOOD_PRACTICE: SpawnTableRow & { respawn: { delay: number; away: number } } = {
  id: 'spawn.driftwood.practice', table: { mode: 'each', rows: [{ item: { kind: 'crab', variant: 'small' }, weight: 1, count: 1 }] },
  respawn: { delay: 45, away: 30 },
};
const enemies = new WeightedTable(DRIFTWOOD_ENEMIES.table);
export function enemyCount(tag: SpawnContext['tags'][number], next: () => number): number {
  return enemies.roll({ tags: [tag] }, next).reduce((count, drop) => count + drop.count, 0);
}

export const DRIFTWOOD_FAUNA: SpawnTableRow = {
  id: 'spawn.driftwood.fauna', table: { mode: 'each', rows: DRIFTWOOD_FAUNA_PLANS.map((plan) => ({
    item: { kind: plan.kind }, weight: 1, count: plan.count,
  })) },
};
