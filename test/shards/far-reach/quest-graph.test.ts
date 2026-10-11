// oxlint-disable-next-line import/no-nodejs-modules -- Native physics loads the shipped immutable Rapier module.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, it } from 'vitest';
import { createSimHost, SIM_API_VERSION, type SimHost, type SimLevel } from '../../../src/engine/sim';
import { loadRapier, type Rapier } from '../../../src/engine/physics/rapier';
import { snapshotSimHost } from '../../../src/engine/sim/snapshot';
import { Rng } from '../../../src/engine/core/rng';
import { installSkyQuest as shippingQuest } from '../../fixtures/quest-oracle/sky-bridge';
import { installSkyQuest, ROOST_IDS, SKY_ACT, SKY_INTERACT } from '../../../src/shards/far-reach/runtime/quest';
import { skySpecs } from '../../../src/shards/far-reach/runtime/headless';
import { SKY_QUESTS, KEEPER_AT } from '../../../src/shards/far-reach/data/quests';
import { DECK, NOTES, VANES, WINCH } from '../../../src/shards/far-reach/data/layout';
import { SKY_ACTIONS } from '../../../src/shards/far-reach/data/questGraph';
import { KEEPER_NPC } from '../../../src/shards/far-reach/data/keeperDialogue';
import { STRINGS } from '../../../src/shards/far-reach/data/strings';
import { FLAGS, vaneFlag } from '../../../src/shards/far-reach/quest/flags';

let rapier: Rapier;
beforeAll(async () => { rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); });

it('retains the ordered keeper branches as JSON data and declares no transient marks or extra native owner', () => {
  expect(KEEPER_NPC).toEqual({ id: 'far.keeper', name: STRINGS.keeperName, dialogue: [
    { when: { all: [FLAGS.raised] }, lines: [STRINGS.keeperDone] },
    { when: { all: [FLAGS.notes] }, lines: [STRINGS.keeperLater] },
    { lines: [STRINGS.keeperHello, STRINGS.keeperAsk, STRINGS.keeperHow], sets: [FLAGS.notes] },
  ] });
  // oxlint-disable-next-line unicorn/prefer-structured-clone -- JSON persistence is the authoring contract under test.
  expect(JSON.parse(JSON.stringify(KEEPER_NPC))).toStrictEqual(KEEPER_NPC);
  expect(SKY_ACTIONS.marks).toEqual([]);
});

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
