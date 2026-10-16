import { DRIFTWOOD_FAUNA_PLANS, ENEMY_COUNTS } from './fauna';
import type { SpawnTables } from '@wildshard/format/spawnTables';

/** Counts consume one draw per tidepool/grove, in the original placement order. */
export const DRIFTWOOD_ENEMIES: SpawnTables[number] = {
  id: 'spawn.driftwood.enemies', table: { mode: 'each', rows: [
    { item: { kind: 'crab' }, weight: 1, count: [...ENEMY_COUNTS.tidepool], when: { tags: ['tidepool'] } },
    { item: { kind: 'monkey' }, weight: 1, count: [...ENEMY_COUNTS.grove], when: { tags: ['grove'] } },
    { item: { kind: 'sailor', variant: 'sailor' }, weight: 1, count: 1, when: { tags: ['hold'] } },
  ] },
};
export const DRIFTWOOD_PRACTICE: SpawnTables[number] = {
  id: 'spawn.driftwood.practice', table: { mode: 'each', rows: [{ item: { kind: 'crab', variant: 'small' }, weight: 1, count: 1 }] },
  respawn: { delay: 45, away: 30 },
};
export const DRIFTWOOD_FAUNA: SpawnTables[number] = {
  id: 'spawn.driftwood.fauna', table: { mode: 'each', rows: DRIFTWOOD_FAUNA_PLANS.map((plan) => ({
    item: { kind: plan.kind }, weight: 1, count: plan.count,
  })) },
};

export const DRIFTWOOD_SPAWNS = [DRIFTWOOD_FAUNA, DRIFTWOOD_ENEMIES, DRIFTWOOD_PRACTICE];
