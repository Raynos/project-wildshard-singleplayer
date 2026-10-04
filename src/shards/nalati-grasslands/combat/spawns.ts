import type { SpawnTableRow, Spawner } from '@wildshard/engine/ai/encounters';
import { app } from '@wildshard/engine/app/runtime';
import type { Scope } from '@wildshard/engine/app/scope';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import type { AnimalManager } from '@wildshard/engine/entities/AnimalManager';

const allowed = (tags: readonly string[], phase: readonly string[]): boolean => tags.some(tag => phase.includes(tag)) || tags.includes('force');
export const NIGHT_SPAWNS: readonly SpawnTableRow[] = [
  { id: 'spawn.nalati.balbals', table: { mode: 'each', rows: ['warrior', 'capped'].map(variant => ({
    item: { kind: 'balbal', variant }, weight: 1, count: 1,
    when: ctx => allowed(ctx.tags, ['dusk', 'night']) && ctx.tags.includes(variant),
  })) } },
  { id: 'spawn.nalati.ghost-riders', table: { mode: 'each', rows: ['rider', 'captain'].map(variant => ({
    item: { kind: 'ghost-rider', variant }, weight: 1, count: 1,
    when: ctx => allowed(ctx.tags, ['night']) && ctx.tags.includes(variant),
  })) } },
];
export function nightSpawner(id: string, scope: Scope, animals: AnimalManager): Spawner<Animal> {
  const row = NIGHT_SPAWNS.find(value => value.id === id);
  if (row === undefined) throw new Error(`Unknown Nalati night table: ${id}`);
  app.encounters.registerSpawn(row, scope);
  return app.encounters.spawn(id, scope, {
    create: (entry, point) => animals.spawn(entry.kind, point.x, point.z, point.yaw, entry.variant),
    retire: actor => { animals.retire(actor); },
  });
}
