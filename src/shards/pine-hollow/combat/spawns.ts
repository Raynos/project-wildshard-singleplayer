import type { SpawnTableRow, Spawner } from '@wildshard/engine/ai/encounters';
import { app } from '@wildshard/engine/app/runtime';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import type { AnimalManager } from '@wildshard/engine/entities/AnimalManager';
import { retire } from './ctx';

/** Each-mode keeps the scheduler's existing species choice and consumes no extra random draw. */
export const PINE_SPAWNS: readonly SpawnTableRow[] = [{ id: 'pine.spawn.thrall', table: { mode: 'each', rows: [
  { item: { kind: 'elk', variant: 'thrall' }, weight: 1, when: (ctx) => ctx.kind === 'elk' },
  { item: { kind: 'boar', variant: 'thrall' }, weight: 1, when: (ctx) => ctx.kind === 'boar' },
] } }];

export function thrallSpawner(animals: AnimalManager, create: (kind: 'elk' | 'boar', x: number, z: number, yaw: number) => Animal): Spawner<Animal> | null {
  const scope = app.levelScope;
  return scope === null ? null : app.encounters.spawn('pine.spawn.thrall', scope, {
    create: (entry, point) => create(entry.kind === 'elk' ? 'elk' : 'boar', point.x, point.z, point.yaw),
    retire: (actor) => { retire(animals, actor); },
  });
}
export function spawnThrallFrom(spawner: Spawner<Animal> | null, kind: 'elk' | 'boar', x: number, z: number, yaw: number,
  fallback: () => Animal): Animal {
  if (spawner === null) return fallback();
  const actor = spawner.spawn({ kind, tags: ['night'] }, { x, z, yaw }, () => { throw new Error('Fixed thrall table must not consume a random draw'); })[0];
  if (actor === undefined) throw new Error(`Thrall table returned no ${kind}`);
  return actor;
}
