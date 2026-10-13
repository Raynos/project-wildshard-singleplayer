import { expect, it } from 'vitest';
import * as v from 'valibot';
import { Group, Vector3 } from 'three';
import { emptyShardfile } from '@wildshard/sdk/author';
import { parseShardfile, shardfileRules } from '@wildshard/format/shardSchema';
import { parseQuestNpcBinding, QuestNpcBindingsSchema } from '@wildshard/format/npcs';
import { installDeclaredQuestNpc } from '@wildshard/game/plugin/ui';
import { withoutRuntimeRows } from '@wildshard/game/plugin/headless';
import { QUEST_NPC as KEEPER } from '../src/shards/far-reach/data/questNpc';
import { QUEST_NPC as SCOUT } from '../src/shards/sunscar-dunes/data/questNpc';

const empty = () => emptyShardfile({ slug: 'npc-root', name: 'NPC root', author: 'Fixture', revision: 1, seed: 1 });
function root(data: unknown) {
  const binding = parseQuestNpcBinding(data), flags = new Set(binding.met === 'flag' ? [binding.npc.metFlag] : []);
  for (const entry of binding.npc.dialogue) for (const flag of [...entry.when?.all ?? [], ...entry.when?.any ?? [], ...entry.when?.none ?? [], ...entry.sets ?? []]) flags.add(flag);
  return parseShardfile({ ...empty(), questNpcs: [binding], quests: { flags: [...flags], quests: [], triggers: [], dialogue: [] },
    runtime: { entry: 'runtime/index.ts', binds: ['quests'] } });
}

it('leaves absent declarations and their persisted bytes unchanged', () => {
  const source = empty(), bytes = JSON.stringify(source), admitted = parseShardfile(source);
  expect(Object.hasOwn(admitted, 'questNpcs')).toBe(false);
  expect(JSON.stringify(admitted)).toBe(bytes);
  for (const data of [KEEPER, SCOUT]) {
    const declared = root(data);
    expect(JSON.stringify(declared.questNpcs)).toBe(JSON.stringify([data]));
    const { questNpcs: _bindings, ...without } = declared;
    expect(JSON.stringify(parseShardfile(without))).toBe(JSON.stringify(without));
  }
});

it('refuses missing native ownership and every undeclared dialogue/met flag', () => {
  for (const data of [KEEPER, SCOUT]) {
    const declared = root(data);
    expect(() => parseShardfile({ ...declared, runtime: null })).toThrow('shardfile semantic rules');
    expect(() => parseShardfile({ ...declared, runtime: { entry: 'runtime/index.ts', binds: [] } })).toThrow('shardfile semantic rules');
    for (const flag of declared.quests.flags) {
      const input = { ...declared, quests: { ...declared.quests, flags: declared.quests.flags.filter(value => value !== flag) } };
      expect(shardfileRules(input)).toContain(`undeclared quest NPC flag ${flag}`);
      expect(() => parseShardfile(input)).toThrow('shardfile semantic rules');
    }
  }
});

it('refuses duplicate identities, talk spots, systems and row overflow', () => {
  const binding = parseQuestNpcBinding(KEEPER), second = { ...binding, system: 'second', npc: { ...binding.npc, id: 'second', spot: 'second' } };
  expect(v.safeParse(QuestNpcBindingsSchema, [binding, second]).success).toBe(true);
  for (const duplicate of [
    { ...second, system: binding.system },
    { ...second, npc: { ...second.npc, id: binding.npc.id } },
    { ...second, npc: { ...second.npc, spot: binding.npc.spot } },
  ]) expect(v.safeParse(QuestNpcBindingsSchema, [binding, duplicate]).success).toBe(false);
  expect(v.safeParse(QuestNpcBindingsSchema, Array.from({ length: 65 }, (_, index) => ({ ...binding, system: String(index), npc: { ...binding.npc, id: String(index), spot: String(index) } }))).success).toBe(false);
});

it('looks up only the declared identity before borrowing any resource', () => {
  const declared = root(KEEPER), systems: string[] = [], ctx = { root: new Group(), piece: () => undefined,
    system: (spec: { id: string }) => { systems.push(spec.id); } };
  let reads = 0;
  const ports = { player: new Vector3(), flags: { has: () => false }, model: () => { reads++; return null; } };
  expect(() => installDeclaredQuestNpc(ctx, declared, 'missing', ports)).toThrow('Undeclared quest NPC missing');
  expect(reads).toBe(0); expect(systems).toEqual([]);
  const bound = installDeclaredQuestNpc(ctx, declared, KEEPER.npc.id, ports);
  expect(reads).toBe(1); expect(systems).toEqual([KEEPER.system]);
  expect(bound?.label).toBe(KEEPER.label);
  expect(JSON.stringify(declared.questNpcs)).toBe(JSON.stringify([KEEPER]));
});

it('empties only native-owned NPC rows without inventing an absent declaration', () => {
  for (const row of [KEEPER, SCOUT]) {
    const declared = root(row), projected = withoutRuntimeRows(declared);
    expect(projected.questNpcs).toEqual([]);
    expect(projected.quests).toEqual({ flags: [], quests: [], triggers: [], dialogue: [] });
    expect(parseShardfile(projected)).toStrictEqual(projected);
    expect(JSON.stringify(declared.questNpcs)).toBe(JSON.stringify([row]));
  }
  const declared = root(KEEPER), { questNpcs: _rows, ...absent } = declared;
  const projected = withoutRuntimeRows(absent);
  expect(Object.hasOwn(projected, 'questNpcs')).toBe(false);
  expect(JSON.stringify(projected)).toBe(JSON.stringify({ ...absent, quests: { flags: [], quests: [], triggers: [], dialogue: [] } }));
  const runtime = declared.runtime;
  if (runtime === null) throw new Error('Fixture requires native ownership');
  const unbound = { ...declared, runtime: { ...runtime, binds: [] } };
  expect(withoutRuntimeRows(unbound)).toBe(unbound);
  expect(() => parseShardfile(unbound)).toThrow('shardfile semantic rules');
});
