// oxlint-disable-next-line import/no-nodejs-modules -- The fixture boots real Rapier WASM in Node.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, it } from 'vitest';
import { createSimHost, type SimHost } from '../../src/engine/sim';
import { restoreSimHost, snapshotSimHost } from '../../src/engine/sim/snapshot';
import { loadRapier, type Rapier } from '../../src/engine/physics/rapier';
import { DeclaredScriptWorld } from '../../src/engine/script/state';
import type { ScriptEvent } from '../../src/engine/script/effects';
import { createQuestScriptPorts, DeclaredQuests } from '../../src/game/quest/declared';
import { parseQuestData } from '../../src/game/shardfile/quests';
import { TEMPLATE_QUESTS } from '../../src/shards/_template/data/quests';
import { SIM_LEVEL, fightCommand } from '../fixtures/sim-level/level';
import { expectSameSimSnapshot } from '../fake/simSnapshot';

let rapier: Rapier;
beforeAll(async () => { rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); });
const data = parseQuestData({ flags: ['hut', 'boar', 'complete', 'talked', 'script.ready'], quests: [{
  id: 'data.quest', title: 'Fixture quest', completeFlag: 'complete', steps: [
    { id: 'hut', objective: 'Reach the hut', hint: 'Follow the path', done: { all: ['hut'] }, markers: [{ id: 'hut', label: 'HUT', at: { poi: 'world', x: 0, z: 0 } }] },
    { id: 'boar', objective: 'Beat the boar · {n}/{of}', chip: 'BEAT BOAR', count: ['boar'], done: { all: ['boar'] } },
  ], onComplete: { fact: 'fixture.quest', coins: 5, scene: 'victory' },
}], triggers: [
  { id: 'hut', kind: 'region', flag: 'hut', x: 0, z: 0, radius: 3 },
  { id: 'boar', kind: 'death', flag: 'boar', tag: 'creature.boar' },
  { id: 'ready', kind: 'script', flag: 'script.ready', condition: 'published.ready' },
], dialogue: [{ id: 'guide', name: 'Guide', start: 'hello', nodes: [
  { id: 'hello', lines: ['Take the path.'], sets: ['talked'], choices: [{ id: 'accept', label: 'Ready', next: 'bye', when: { all: ['script.ready'] }, scene: 'accept' }] },
  { id: 'bye', lines: ['Good luck.'], choices: [{ id: 'close', label: 'Go', next: null }] },
] }] });
const level = { ...SIM_LEVEL, quests: [] };

it('runs region, combat and script-published conditions from data through unchanged journal and markers', () => {
  const host = createSimHost(level, { rapier }), facts: string[] = [], coins: number[] = [], scenes: string[] = [];
  let published = false;
  try {
    const declared = new DeclaredQuests(host, data, { fact: (name) => { facts.push(name); }, coins: (n) => { coins.push(n); }, script: {
      condition: () => published, scene: (name, actor) => { scenes.push(`${name}:${actor}`); },
    } });
    const quest = declared.quests[0]; if (quest === undefined) throw new Error('Missing data quest');
    expect(quest.objective()).toBe('Reach the hut'); expect(quest.hint()).toBe('Follow the path');
    expect(quest.markers()).toEqual(data.quests[0]?.steps[0]?.markers);
    expect(declared.view('guide')?.choices).toEqual([]); expect(() => declared.choose('guide', 'accept')).toThrow();
    published = true; host.step();
    expect(quest.current?.id).toBe('boar'); expect(quest.chip()).toEqual({ label: 'BEAT BOAR', count: '0/1' }); expect(quest.markers()).toEqual([]);
    declared.choose('guide', 'accept'); expect(host.flags.has('talked')).toBe(true);
    expect(declared.npc('guide').dialogue[0]?.lines).toEqual(['Good luck.']); declared.choose('guide', 'close'); expect(declared.view('guide')).toBeNull();
    for (let tick = 0; tick < 600; tick++) host.step(fightCommand(tick));
    expect(quest.isComplete).toBe(true); expect(facts).toEqual(['fixture.quest']); expect(coins).toEqual([5]);
    expect(scenes).toEqual([`accept:${host.player.id}`, `victory:${host.player.id}`]);
    expect(quest.objective()).toBe('Fixture quest — complete');
  } finally { host.dispose(); }
});

it('restores dialogue and quest flags at a fight checkpoint and replays an exact suffix', () => {
  const install = (host: SimHost): DeclaredQuests => new DeclaredQuests(host, data, { fact: (name) => { host.slots.questState['fixture.fact'] = name; }, coins: (n) => { host.slots.questState['fixture.coins'] = n; }, script: { condition: () => true, scene: (name) => { host.slots.questState['fixture.scene'] = name; } } });
  const host = createSimHost(level, { rapier }); let restored: SimHost | undefined;
  try {
    const declared = install(host); host.step(); declared.choose('guide', 'accept');
    for (let tick = 0; tick < 20; tick++) host.step(fightCommand(tick));
    restored = restoreSimHost(level, { rapier }, snapshotSimHost(host), (fresh) => { install(fresh); });
    for (let tick = 20; tick < 600; tick++) { host.step(fightCommand(tick)); restored.step(fightCommand(tick)); }
    expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(host));
    expect(host.flags.has('complete')).toBe(true);
  } finally { restored?.dispose(); host.dispose(); }
});

it('rejects dangling flags, cycles and absent admitted hooks before adding quest state', () => {
  expect(parseQuestData(TEMPLATE_QUESTS).quests[0]?.onComplete).toEqual({ coins: 5, fact: 'template.quest' });
  expect(() => parseQuestData({ ...data, flags: [] })).toThrow();
  expect(() => parseQuestData({ ...data, dialogue: [{ id: 'loop', name: 'Loop', start: 'one', nodes: [{ id: 'one', lines: ['Loop'], choices: [{ id: 'again', label: 'Again', next: 'one' }] }] }] })).toThrow();
  expect(() => parseQuestData({ ...data, triggers: [...data.triggers, data.triggers[0]] })).toThrow();
  const host = createSimHost(level, { rapier });
  try { expect(() => new DeclaredQuests(host, data)).toThrow('Missing admitted'); expect(host.quests).toHaveLength(0); }
  finally { host.dispose(); }
});

it('reads admitted published fields by stable id and queues scene events with host actor provenance', () => {
  const world = new DeclaredScriptWorld({ fields: {}, archetypes: [], events: [7], maxEntities: 2 }, [
    { id: 1, name: 'Player', position: [0, 0, 0], fields: {}, frozen: false, interactive: true },
  ], { shared: [{ id: 101, name: 'ready', type: 'bool', privacy: 'public', default: 1, min: 0, max: 1 }],
    player: [{ id: 202, name: 'secret', type: 'bool', privacy: 'host', default: 1, min: 0, max: 1 }] }, new Map([[1, 'alice']]));
  const queued: ScriptEvent[] = [], lane = { world, enqueue: (event: ScriptEvent) => { queued.push(event); } }, actors = new Map([['alice', 1]]);
  const ports = createQuestScriptPorts(lane, { conditions: [{ id: 'published.ready', scope: 'shared', fieldId: 101, equals: 1 }], scenes: [{ id: 'victory', type: 7, value: 3 }] }, actors);
  expect(ports.condition('published.ready', 'alice')).toBe(true); ports.scene('victory', 'alice');
  expect(queued).toEqual([{ type: 7, target: 1, value: 3 }]);
  expect(() => ports.scene('victory', 'other')).toThrow('Unknown quest actor');
  expect(() => createQuestScriptPorts(lane, { conditions: [{ id: 'secret', scope: 'player', fieldId: 202, equals: 1 }], scenes: [] }, actors)).toThrow('Invalid published');
});
