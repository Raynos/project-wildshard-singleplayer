import { expect, test } from 'vitest';
import { Vector3 } from 'three';
import { Scope } from '../src/engine/app/scope';
import { EncounterRegistry, declaredSpawnTables } from '../src/engine/ai/encounters';
import type { Animal } from '../src/engine/entities/AnimalView';
import type { AnimalManager } from '../src/engine/entities/AnimalManager';
import { FixedPageSpawnTable } from '../src/game/population/pageGroups';
import { legacyDouble } from './fake/FakeGame';

test('another encounter uses real table identities and retires only its own bodies', () => {
  const scope = new Scope('marsh.fixed'), registry = new EncounterRegistry(() => scope), made: Animal[] = [], retired: Animal[] = [];
  const animals = legacyDouble<AnimalManager>({ spawn: (kind, x, z, yaw, variant) => {
    const actor = legacyDouble<Animal>({ kind, variant: typeof variant === 'string' ? variant : 'plain', position: new Vector3(x, 0, z), yaw });
    made.push(actor); return actor;
  }, retire: actor => { retired.push(actor); } });
  for (const row of declaredSpawnTables([{ id: 'marsh.guard', table: { mode: 'each', rows: [
    { item: { kind: 'heron', variant: 'sentinel' }, weight: 1, when: { tags: ['reeds'], kind: 'heron' } },
  ] } }])) registry.registerSpawn(row, scope);
  const owner = new FixedPageSpawnTable(animals, registry, scope, 'marsh.guard'), at = { x: 3, z: 4, yaw: 0.5 };
  try {
    const actor = owner.spawn({ kind: 'heron', tags: ['reeds'] }, at, { kind: 'gull', variant: 'preview' });
    expect([actor.kind, actor.variant, actor.yaw]).toEqual(['heron', 'sentinel', 0.5]); expect(actor.position).toEqual(new Vector3(3, 0, 4));
    expect(() => owner.spawn({ kind: 'heron', tags: [] }, at, { kind: 'gull' })).toThrow('no actor'); expect(made).toHaveLength(1);
    owner.retire(actor); owner.retire(actor); expect(retired).toHaveLength(1); expect(retired[0] === actor).toBe(true);
    const next = owner.spawn({ kind: 'heron', tags: ['reeds'] }, at, { kind: 'gull' });
    scope.dispose(); expect(retired).toHaveLength(2); expect(retired[1] === next).toBe(true);
  } finally { scope.dispose(); }
  const preview = new FixedPageSpawnTable(animals, registry, null, 'unregistered');
  const actor = preview.spawn({ tags: [] }, at, { kind: 'gull', variant: 'preview' });
  expect([actor.kind, actor.variant]).toEqual(['gull', 'preview']);
});
