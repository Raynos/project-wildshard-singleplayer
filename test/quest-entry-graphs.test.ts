// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the shipped native physics binary.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { createSimHost } from '../src/engine/sim';
import { loadRapier } from '../src/engine/physics/rapier';
import { installQuestGraph } from '../src/game/plugin/quests';
import { installDeclaredQuestHost } from '../src/game/plugin/simulation';
import { questHostBindingRules } from '../src/format/questHost';
import pine from '../src/shards/pine-hollow/generators/product';
import driftwood from '../src/shards/driftwood-isle/generators/product';
import people from '../src/shards/pine-hollow/data/questNpcs.generated.json' with { type: 'json' };
import { PINE_QUEST_RUNTIME, PINE_QUEST_PAYLOAD } from '../src/shards/pine-hollow/generators/questRuntime';
import { parsePineQuestRows } from '../src/shards/pine-hollow/generators/sections';
import { SIM_LEVEL } from './fixtures/sim-level/level';

test('both quest entries use an admitted host and Pine preserves the existing flag prefix', () => {
  for (const source of [pine, driftwood]) {
    expect(source.questHost).toBeDefined();
    expect(questHostBindingRules(source.questHost, source.quests.flags, true)).toEqual([]);
  }
  expect(pine.quests.flags.slice(0, people.quests.flags.length)).toEqual(people.quests.flags);
  expect(pine.questHost?.graph).toEqual(PINE_QUEST_RUNTIME.graph);
  expect(pine.questHost?.interactions).toEqual(PINE_QUEST_RUNTIME.interactions);
  expect(pine.questHost?.commands.step).toBeNull();
  expect(parsePineQuestRows(PINE_QUEST_PAYLOAD)).not.toHaveProperty('graph');
  expect(parsePineQuestRows(PINE_QUEST_PAYLOAD)).not.toHaveProperty('interactions');
  expect(() => parsePineQuestRows(PINE_QUEST_RUNTIME)).toThrow();
});

test('Pine declared entry preserves external action results, continuation and quiet restore', async () => {
  const rapier = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')));
  const level = { ...SIM_LEVEL, entities: [], quests: [] }, before = createSimHost(level, { rapier }), after = createSimHost(level, { rapier });
  const beforeFacts: string[] = [], afterFacts: string[] = [];
  const ports = (facts: string[]) => ({ spots: { interact: [], crack: [] }, commands: () => [],
    fact: (fact: string, entity: string) => { facts.push(`${fact}:${entity}`); }, coins: (coins: number) => { facts.push(`coins:${coins}`); } });
  try {
    const original = installQuestGraph(before, { quests: pine.quests, graph: PINE_QUEST_RUNTIME.graph,
      interactions: PINE_QUEST_RUNTIME.interactions, npcs: [] }, { ...ports(beforeFacts), drive: 'external' });
    const current = installDeclaredQuestHost(after, pine, ports(afterFacts));
    const saved = (host: typeof before) => [...host.adapters].map(([id, adapter]) => [id, adapter.snapshot()]);
    expect(saved(after)).toEqual(saved(before));
    for (const row of PINE_QUEST_RUNTIME.interactions.rows) {
      for (const need of row.needs ?? []) {
        for (const flag of need.none ?? []) { before.flags.clear(flag); after.flags.clear(flag); }
        for (const flag of [...need.all ?? [], ...need.any?.slice(0, 1) ?? []]) { before.flags.set(flag); after.flags.set(flag); }
      }
      expect(current.run(row.id)).toEqual(original.run(row.id));
      expect(current.run(row.id)).toEqual(original.run(row.id));
      expect(after.flags.all).toEqual(before.flags.all); expect(afterFacts).toEqual(beforeFacts);
      expect(saved(after)).toEqual(saved(before));
    }
    afterFacts.length = 0;
    for (const [id, adapter] of before.adapters) {
      const target = after.adapters.get(id);
      if (target === undefined) throw new Error(`Missing continuation ${id}`);
      const value = adapter.snapshot(); target.restore(value); expect(target.snapshot()).toEqual(value);
    }
    expect(afterFacts).toEqual([]);
  } finally { before.dispose(); after.dispose(); }
});
