// oxlint-disable-next-line import/no-nodejs-modules -- This fixture installs the quest graph on a real native host.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, it } from 'vitest';
import { Flags } from '../../src/engine/world/interact/flags';
import { createSimHost } from '../../src/engine/sim';
import { loadRapier, type Rapier } from '../../src/engine/physics/rapier';
import { DeclaredQuests } from '../../src/game/quest/declared';
import { compileQuestTable, installQuestGraph, parseQuestGraph } from '../../src/game/quest/questGraph';
import { InteractionRules, parseInteractionRows } from '../../src/game/quest/interactionRows';
import { parseNpcDialogueRow } from '../../src/sdk/questGraph';
import { SIM_LEVEL } from '../fixtures/sim-level/level';
import { PINE_QUESTS } from '../../src/shards/pine-hollow/data/quests';
import { RANGER, MILLER, TRADER } from '../../src/shards/pine-hollow/quest/wardensHollow';
import { pineTable } from '../../src/shards/pine-hollow/quest/table';

const table = pineTable({ resin: [], tokens: [{ x: 0, z: 0 }], dam: { x: 0, z: 0, fx: 0, fz: 1, ax: 1, az: 0 }, finder: { x: 0, y: 0, z: 0 }, bench: { x: 0, y: 0, z: 0, yaw: 0 } });
const bindings = [{ id: 'dam-log-a', act: 1 }, { id: 'dam-log-b', act: 2 }, { id: 'pond-glass', act: 3 }, { id: 'ridge-flint', act: 4 }, { id: 'token-1', act: 10 }, { id: 'lookout-bench', act: 18 }];
let rapier: Rapier;
beforeAll(async () => { rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); });

it('compiles the shipping table flag order, visibility, latch and repeatable bench effects', () => {
  const flags = new Flags('quest.table.graph', false), events: string[] = [];
  const off = flags.onChange((id, on) => { events.push(`${id}:${String(on)}`); });
  try {
    const rules = new InteractionRules(flags, compileQuestTable(table, bindings));
    expect(rules.run('dam-log-a').ok).toBe(false);
    flags.set('talked:ranger');
    expect(rules.run('dam-log-a').ok).toBe(true); expect(rules.run('dam-log-a').ok).toBe(false);
    expect(rules.run('pond-glass').ok).toBe(false); flags.set('open:dam-sluice');
    expect(rules.run('pond-glass').ok).toBe(true); expect(rules.run('pond-glass').ok).toBe(false);
    expect(rules.run('token-1').ok).toBe(true);
    let sits = 0; rules.run('lookout-bench', () => { sits++; }); rules.run('lookout-bench', () => { sits++; });
    expect(sits).toBe(2);
    expect(events).toEqual(['talked:ranger:true', 'lever:dam-log-a:true', 'open:dam-sluice:true', 'taken:pond-glass:true',
      'taken:token-1:true', 'token:1:true', 'used:lookout-bench:true', 'secret:vista:true']);
    expect(() => compileQuestTable(table, [{ id: 'dam-sluice', act: 2 }])).toThrow('Unsupported');
    expect(() => compileQuestTable(table, [bindings[0] ?? { id: 'none', act: 0 }, bindings[0] ?? { id: 'none', act: 0 }])).toThrow();
  } finally { off(); }
});

it('leaves the existing host adapter order and exact quest outcomes unchanged for an external modal owner', () => {
  const level = { ...SIM_LEVEL, quests: [] }, before = createSimHost(level, { rapier }), after = createSimHost(level, { rapier });
  const factsA: string[] = [], factsB: string[] = [];
  try {
    const declared = new DeclaredQuests(before, PINE_QUESTS, { fact: (name, entity) => { factsA.push(`${name}:${entity}`); } });
    const graph = installQuestGraph(after, { quests: PINE_QUESTS, interactions: compileQuestTable(table, bindings), npcs: [],
      graph: parseQuestGraph({ actor: 'pine.interact', step: 'pine.quest.graph', actions: [] }) },
    { spots: { interact: [], crack: [] }, commands: () => [], fact: (name, entity) => { factsB.push(`${name}:${entity}`); }, coins: () => undefined, drive: 'external' });
    expect([...after.adapters.keys()]).toEqual([...before.adapters.keys()]);
    expect(graph.quests.snapshot()).toEqual(declared.snapshot());
    for (const flag of ['talked:ranger', 'lit:pond', 'lit:ridge', 'used:ph-zip', 'lit:den', 'followed:stag', 'dead:king', 'seen:dawn']) {
      before.flags.set(flag); after.flags.set(flag); before.step(); after.step();
      expect(graph.quests.quests.map(q => [q.current?.id, q.isComplete])).toEqual(declared.quests.map(q => [q.current?.id, q.isComplete]));
    }
    expect(factsB).toEqual(factsA); expect(factsA).toEqual(['pine.feat.quest:wardens-hollow']);
    const invalid = createSimHost(level, { rapier });
    try { expect(() => installQuestGraph(invalid, { quests: PINE_QUESTS, interactions: parseInteractionRows({ marks: [{ id: 'open' }], rows: [] }), npcs: [],
      graph: parseQuestGraph({ actor: 'fixture', step: 'fixture', actions: [] }) },
    { spots: { interact: [], crack: [] }, commands: () => [], fact: () => undefined, coins: () => undefined, drive: 'external' })).toThrow('continuation');
    expect(invalid.quests).toEqual([]); } finally { invalid.dispose(); }
  } finally { before.dispose(); after.dispose(); }
});

it('validates each shipping skinned NPC dialogue without changing selection order or inventing a pivot body', () => {
  for (const npc of [RANGER, MILLER, TRADER]) {
    expect(parseNpcDialogueRow(npc)).toEqual(npc);
    expect(() => parseNpcDialogueRow({ ...npc, figure: {} })).toThrow();
    expect(() => parseNpcDialogueRow({ ...npc, dialogue: [] })).toThrow();
  }
});

it('keeps command-driven rows and their exact mark continuation as the default', () => {
  const host = createSimHost({ ...SIM_LEVEL, quests: [] }, { rapier });
  let commands: { actorId: string; value: number }[] = [];
  try {
    const graph = installQuestGraph(host, { quests: { flags: [], quests: [], dialogue: [], triggers: [] },
      interactions: parseInteractionRows({ marks: [{ id: 'visited' }], rows: [{ id: 'visit', act: 1, at: 'door', sets: ['visited', 'door.open'] }] }), npcs: [],
      graph: parseQuestGraph({ actor: 'fixture', step: 'fixture.graph', actions: [] }) },
    { spots: { interact: [{ id: 'door', x: host.player.position.x, y: host.player.position.y, z: host.player.position.z, radius: 4 }], crack: [] }, commands: () => commands,
      fact: () => undefined, coins: () => undefined });
    expect(host.adapters.has('fixture.graph')).toBe(true);
    commands = [{ actorId: 'fixture', value: 1 }]; host.step();
    expect(graph.rules.has('visited')).toBe(true); expect(host.flags.has('door.open')).toBe(true);
    const saved = host.adapters.get('fixture.graph')?.snapshot(); graph.rules.mark('visited', false);
    if (saved === undefined) throw new Error('Missing quest graph continuation');
    host.adapters.get('fixture.graph')?.restore(saved); expect(graph.rules.has('visited')).toBe(true);
  } finally { host.dispose(); }
});
