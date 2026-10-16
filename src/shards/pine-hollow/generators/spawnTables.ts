import type { SpawnTables } from '@wildshard/format/spawnTables';

/** Each-mode keeps the scheduler's existing species choice and consumes no extra random draw. */
export const PINE_SPAWNS: SpawnTables = [{ id: 'pine.spawn.thrall', table: { mode: 'each', rows: [
  { item: { kind: 'elk', variant: 'thrall' }, weight: 1, when: { kind: 'elk' } },
  { item: { kind: 'boar', variant: 'thrall' }, weight: 1, when: { kind: 'boar' } },
] } }];

