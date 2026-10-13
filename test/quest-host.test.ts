// oxlint-disable-next-line import/no-nodejs-modules -- Native physics loads the shipped immutable Rapier module.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, it } from 'vitest';
import { createSimHost, SIM_API_VERSION, type SimHost, type SimLevel } from '../src/engine/sim';
import { loadRapier, type Rapier } from '../src/engine/physics/rapier';
import { snapshotSimHost } from '../src/engine/sim/snapshot';
import { Rng } from '../src/engine/core/rng';
import { installSkyQuest as shippingQuest, type SkyQuestPorts } from './fixtures/quest-oracle/sky-bridge';
import { installQuestGraph } from '../src/game/plugin/quests';
import { installQuestHost } from '../src/game/plugin/simulation';
import { parseQuestHost, questHostRules } from '../src/format/questHost';
import { SKY_QUEST_STAGES, SKY_QUEST_STAGE_INITIAL } from '../src/shards/far-reach/data/questStages';
import { ROOST_IDS, SKY_ACT, SKY_INTERACT, SKY_SPOTS, QUEST_STEP } from '../src/shards/far-reach/data/questPrompts';
import { skySpecs } from '../src/shards/far-reach/runtime/headless';
import { SKY_QUESTS, KEEPER_AT } from '../src/shards/far-reach/data/quests';
import { DECK, NOTES, VANES, WINCH } from '../src/shards/far-reach/data/layout';
import { SKY_ACTIONS, SKY_GRAPH } from '../src/shards/far-reach/data/questGraph';
import { FLAGS, vaneFlag } from '../src/shards/far-reach/quest/flags';
import { SIGNAL_INTERACTIONS } from '../src/shards/sunscar-dunes/data/signalInteractions';
import { SIGNAL_GRAPH } from '../src/shards/sunscar-dunes/data/signalGraph';
import { SIGNAL_QUESTS } from '../src/shards/sunscar-dunes/data/signalQuest';
import { FLAG } from '../src/shards/sunscar-dunes/data/flags';
import signalStages from '../src/shards/sunscar-dunes/data/signalStages.json';
import { SignalDirector } from './fixtures/boss-owner/signalDirector';
import { emptyShardfile } from '@wildshard/sdk/author';
import { parseShardfile } from '@wildshard/format/shardSchema';
import { withoutRuntimeRows } from '@wildshard/game/plugin/headless';


let rapier: Rapier;
const sky = parseQuestHost({
  version: 1, graph: SKY_GRAPH, interactions: SKY_ACTIONS, npcs: [], drive: 'external',
  actors: { ids: ROOST_IDS, error: 'Sky Reach installs its quest after the roost rays' },
  observations: [
    { binding: 'event:quest.roost-down', kind: 'all-dead', actors: ROOST_IDS },
    { binding: 'event:quest.winch-up', kind: 'owner', owner: 'winch-up' },
  ],
  stages: (['roost', 'vanes', 'raised'] as const).map(id => ({ row: SKY_QUEST_STAGES[id], initial: SKY_QUEST_STAGE_INITIAL[id], tick: true })),
  summons: [], commands: { step: QUEST_STEP, inputs: { roost: `flag:${FLAGS.roost}`, vanes: `flag:${FLAGS.vanes}`, up: 'event:quest.winch-up' }, routes: [
    { value: SKY_ACT.talk, spot: 'keeper', when: 'true', action: { kind: 'row', id: 'talk' } },
    { value: SKY_ACT.notes, spot: 'notes', when: 'true', action: { kind: 'row', id: 'notes' } },
    { value: SKY_ACT.winch, spot: 'winch', when: '!up && roost && vanes', action: { kind: 'owner', id: 'winch' } },
  ] },
});

const signal = parseQuestHost({
  version: 1, graph: SIGNAL_GRAPH, interactions: SIGNAL_INTERACTIONS, npcs: [], drive: 'commands',
  actors: { ids: [], error: 'Missing Signal quest body' }, observations: [],
  stages: [{ row: signalStages, initial: [{ lit: false }], seed: { flag: FLAG.lit, initial: [{ lit: false }, { lit: true }] }, tick: false,
    continuation: { step: 'sunscar.signal-fire', error: 'Invalid Signal fire continuation' } }],
  summons: [{ target: 'sunscar.matriarch', director: signalStages.id }], commands: { step: null, inputs: {}, routes: [] },
});
function signalHost(): SimHost {
  return createSimHost({ version: SIM_API_VERSION, id: 'signal-quest-host', seed: 721, ground: { size: 500, height: 0 },
    player: { at: { x: 0, y: 0, z: 0 }, yaw: 0, speed: 5 }, quests: [], entities: [],
    weapon: { id: 'host.probe', shape: { kind: 'point', radius: 1 }, windup: 0.1, active: 0.1, recover: 0.2, cooldown: 0.3, range: 1, damage: 0, tags: [] },
  }, { rapier, ground: false });
}

it('keeps Signal accepted, denied, repeated and loaded fire requests and saved cursors exact', () => {
  for (const loaded of [false, true]) {
    const hosts = [signalHost(), signalHost()], effects: string[][] = [[], []];
    try {
      const oldHost = hosts[0], newHost = hosts[1], oldEvents = effects[0], newEvents = effects[1];
      if (oldHost === undefined || newHost === undefined || oldEvents === undefined || newEvents === undefined) throw new Error('Missing Signal oracle lane');
      for (const host of hosts) if (loaded) host.flags.set(FLAG.lit);
      const old = new SignalDirector({ lit: () => oldHost.flags.has(FLAG.lit), summon: () => { oldEvents.push('summon'); } });
      oldHost.onStep('sunscar.signal-fire', () => undefined, {
        snapshot: () => old.snapshot(), restore: value => { if (typeof value !== 'string') throw new Error('Invalid Signal fire continuation'); old.restore(value); },
      });
      const ports = { spots: { interact: SIGNAL_INTERACTIONS.rows.filter(row => row.crack === undefined).map(row => ({ id: row.at, x: 0, y: 0, z: 0, radius: 1 })),
          crack: SIGNAL_INTERACTIONS.rows.filter(row => row.crack !== undefined).map(row => ({ id: row.at.slice(6), x: 0, y: 0, z: 0, radius: 1 })) },
        crack: { reach: { light: 1, heavy: 1 }, cracked: () => null }, commands: () => [], fact: (name: string, id: string) => { oldEvents.push(`fact:${name}:${id}`); },
        coins: (amount: number, id: string) => { oldEvents.push(`coins:${String(amount)}:${id}`); } };
      const original = installQuestGraph(oldHost, { quests: SIGNAL_QUESTS, graph: SIGNAL_GRAPH, interactions: SIGNAL_INTERACTIONS, npcs: [] }, {
        ...ports, summon: () => { old.light(); },
      });
      const actual = installQuestHost(newHost, SIGNAL_QUESTS, signal, {
        ...ports, fact: (name, id) => { newEvents.push(`fact:${name}:${id}`); }, coins: (amount, id) => { newEvents.push(`coins:${String(amount)}:${id}`); },
        observations: new Map(), actions: new Map(), directorActions: new Map([[signalStages.id, [{ action: { spawn: 'sunscar.matriarch' }, run: () => { newEvents.push('summon'); } }]]]),
      });
      const rows = ['fire', 'crank', 'well', 'pour.0', 'light.0', 'pour.1', 'light.1', 'pour.2', 'light.2', 'fire', 'fire'];
      for (const id of rows) {
        expect(actual.run(id)).toEqual(original.run(id));
        hosts.forEach(host => { host.step(); });
        expect(snapshotSimHost(newHost)).toEqual(snapshotSimHost(oldHost));
        expect(newEvents).toEqual(oldEvents);
      }
      const before = snapshotSimHost(newHost);
      expect(() => actual.rules.restore('{"version":1,"marks":{}}')).toThrow('Incompatible');
      expect(snapshotSimHost(newHost)).toEqual(before);
    } finally { hosts.forEach(host => { host.dispose(); }); }
  }
});

it('refuses missing native owners and malformed bounded rows before installing effects or adapters', () => {
  const host = signalHost();
  try {
    const before = snapshotSimHost(host), ports = { spots: { interact: [], crack: [] }, commands: () => [], fact: () => undefined, coins: () => undefined,
      observations: new Map<string, () => boolean>(), actions: new Map<string, () => void>(), directorActions: new Map() };
    expect(() => installQuestHost(host, SIGNAL_QUESTS, signal, ports)).toThrow('Unbound native director action');
    expect(snapshotSimHost(host)).toEqual(before);
    expect(() => installQuestHost(host, SKY_QUESTS, sky, ports)).toThrow('after the roost rays');
    expect(snapshotSimHost(host)).toEqual(before);
    for (const bad of [
      { ...sky, observations: [] },
      { ...sky, commands: { ...sky.commands, step: null } },
      { ...sky, commands: { ...sky.commands, routes: [...sky.commands.routes, ...sky.commands.routes] } },
      { ...sky, commands: { ...sky.commands, routes: [{ value: 0, spot: 'keeper', when: 'unknown', action: { kind: 'row', id: 'talk' } }] } },
      { ...signal, summons: [{ target: 'sunscar.matriarch', director: 'missing' }] },
      { ...signal, stages: [{ ...signal.stages[0], initial: [{ other: true }] }] },
      { ...sky, npcs: Array.from({ length: 65 }, () => ({})) },
    ]) expect(() => parseQuestHost(bad)).toThrow();
    expect(questHostRules(sky)).toEqual([]); expect(questHostRules(signal)).toEqual([]);
    // oxlint-disable-next-line unicorn/prefer-structured-clone -- Persisted JSON bytes, not an object clone, are the admission boundary.
    expect(parseQuestHost(JSON.parse(JSON.stringify(sky)))).toEqual(sky);
  } finally { host.dispose(); }
});

it('admits a bounded native root only with declared flags and preserves absent and presentation bytes', () => {
  const empty = emptyShardfile({ slug: 'native-quest-root', name: 'Native quest', author: 'Fixture', revision: 1, seed: 1 });
  expect(JSON.stringify(parseShardfile(empty))).toBe(JSON.stringify(empty));
  expect(Object.hasOwn(parseShardfile(empty), 'questHost')).toBe(false);
  for (const [row, quests] of [[sky, SKY_QUESTS], [signal, SIGNAL_QUESTS]] as const) {
    const root = parseShardfile({ ...empty, quests, questHost: row, runtime: { entry: 'runtime/index.ts', binds: ['quests'] } });
    expect(root.questHost).toEqual(row);
    expect(() => parseShardfile({ ...root, runtime: null })).toThrow('shardfile semantic rules');
    expect(() => parseShardfile({ ...root, quests: { flags: [], quests: [], triggers: [], dialogue: [] } })).toThrow('shardfile semantic rules');
    const presentation = withoutRuntimeRows(root);
    expect(presentation.questHost).toBe(null);
    expect(parseShardfile(presentation)).toEqual(presentation);
    const { questHost: _host, ...absent } = root;
    expect(Object.hasOwn(withoutRuntimeRows(absent), 'questHost')).toBe(false);
  }
});
function installSkyQuest(host: SimHost, ports: SkyQuestPorts) {
  return installQuestHost(host, ports.quests, sky, { ...ports, spots: { interact: SKY_SPOTS, crack: [] },
    observations: new Map([['winch-up', ports.winch.raised]]), actions: new Map([['winch', ports.winch.command]]), directorActions: new Map() }).quests;
}
beforeAll(async () => { rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); });
it('matches the native flag/effect order over 1,024 reachable and refused command observations with no added continuation', () => {
  const spec = skySpecs().get('driftRay'); if (spec === undefined) throw new Error('Missing native ray spec');
  const level: SimLevel = { version: SIM_API_VERSION, id: 'sky-quest-oracle', seed: 6417,
    ground: { size: 500, height: -1000 }, player: { at: { x: 0, y: DECK, z: -18 }, yaw: 0, speed: 5 }, quests: [],
    entities: ROOST_IDS.map(id => ({ id, spec, seed: 0.2, scale: 1, at: { x: 0, y: DECK, z: 0 }, yaw: 0 })),
    weapon: { id: 'host.probe', shape: { kind: 'point', radius: 1 }, windup: 0.1, active: 0.1, recover: 0.2, cooldown: 0.3, range: 1, damage: 0, tags: [] } };
  const hosts = [createSimHost(level, { rapier, ground: false }), createSimHost(level, { rapier, ground: false })];
  let commands: { actorId: string; value: number }[] = [], raised = false;
  const changes: string[][] = [[], []], effects: unknown[][] = [[], []], raises = [0, 0];
  const install = [shippingQuest, installSkyQuest];
  try {
    hosts.forEach((host, i) => {
      const events = changes[i], emitted = effects[i], bind = install[i];
      if (events === undefined || emitted === undefined || bind === undefined) throw new Error('Missing oracle lane');
      host.flags.onChange((flag, on) => { events.push(`${flag}:${String(on)}`); });
      bind(host, { quests: SKY_QUESTS, commands: () => commands, fact: (name, entity) => { emitted.push(['fact', name, entity]); },
        coins: (amount, entity) => { emitted.push(['coins', amount, entity]); },
        winch: { raised: () => raised, command: () => { raises[i] = (raises[i] ?? 0) + 1; } } });
    });
    const points = [[KEEPER_AT.x, DECK, KEEPER_AT.z], [NOTES.x, NOTES.y, NOTES.z], [WINCH.x, WINCH.y, WINCH.z], [0, DECK, -200]] as const;
    const allFlags = [FLAGS.notes, FLAGS.roost, FLAGS.vanes, FLAGS.raised, ...VANES.map(vane => vaneFlag(vane.id))];
    const random = new Rng(551);
    for (let tick = 0; tick < 1024; tick++) {
      const bits = Math.floor(random.next() * 128), dead = Math.floor(random.next() * 8), point = points[tick % points.length];
      if (point === undefined) throw new Error('Missing oracle prompt');
      commands = [{ actorId: SKY_INTERACT, value: tick % 5 }, { actorId: SKY_INTERACT, value: SKY_ACT.notes }, { actorId: 'other.prompt', value: SKY_ACT.talk }];
      raised = tick % 3 === 0;
      hosts.forEach(host => {
        host.flags.restore(allFlags.filter((_flag, i) => (bits & (1 << i)) !== 0));
        host.player.position.set(point[0], point[1], point[2]);
        ROOST_IDS.forEach((id, i) => { const body = host.entities.get(id); if (body === undefined) throw new Error('Missing oracle body'); body.alive = (dead & (1 << i)) === 0; });
        host.step();
      });
      expect(hosts[1]?.flags.all, `flags at ${String(tick)}`).toEqual(hosts[0]?.flags.all);
    }
    expect(changes[1]).toEqual(changes[0]); expect(effects[1]).toEqual(effects[0]); expect(raises[1]).toBe(raises[0]);
    const snapshots = hosts.map((host: SimHost) => snapshotSimHost(host));
    expect(snapshots[1]).toEqual(snapshots[0]);
    expect(snapshots[1]?.adapters.some(adapter => adapter.id === 'far.quest.graph')).toBe(false);
  } finally { hosts.forEach(host => { host.dispose(); }); }
});
