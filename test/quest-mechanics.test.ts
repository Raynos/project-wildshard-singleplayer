// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the shipped native physics binary.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { createSimHost } from '../src/engine/sim';
import { loadRapier } from '../src/engine/physics/rapier';
import { parseMovers } from '../src/format/movers';
import { lowerMoverMotion } from '../src/format/moverMotion';
import { compileMoverDriver } from '../src/sdk/compileMovers';
import { installMoverFixture } from './fixtures/mover-installation';
import { parseQuestHost } from '../src/format/questHost';
import { installQuestHost, type QuestCableOwner } from '../src/game/plugin/simulation';
import { SIM_LEVEL } from './fixtures/sim-level/level';
import { QUEST_HOST as signal } from '../src/shards/sunscar-dunes/generators/questHost';
import { FLAG } from '../src/shards/sunscar-dunes/data/flags';

class Cable implements QuestCableOwner {
  riding = false; atEnd = false; starts = 0;
  state(id: string) { if (id !== 'cable') throw new Error('Unknown cable'); return { riding: this.riding, atEnd: this.atEnd }; }
  start(id: string) { this.state(id); this.riding = true; this.starts++; }
}
const base = { version: 1, drive: 'external', actors: { ids: [], error: 'Missing body' },
  graph: { actor: 'interact', step: 'graph', actions: [] }, interactions: { marks: [], rows: [] }, npcs: [],
  observations: [], stages: [], summons: [], commands: { step: 'commands', inputs: {}, routes: [] } };
const quests = { flags: ['ready', 'done'], quests: [], triggers: [], dialogue: [] };
async function fixture() {
  const rapier = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')));
  return createSimHost({ ...SIM_LEVEL, entities: [], quests: [] }, { rapier });
}
const ports = { spots: { interact: [{ id: 'control', x: 0, y: 1.68, z: 1, radius: 4 }], crack: [] },
  fact: () => undefined, coins: () => undefined };

test('data bindings read live cable, flags and the existing timer without another scheduler', async () => {
  const host = await fixture(), cable = new Cable(); let command = 1;
  host.state.timers['wait'] = 1;
  const row = parseQuestHost({ ...base, observations: [
    { binding: 'event:wait', kind: 'timer', timer: 'wait' },
    { binding: 'event:riding', kind: 'cable', cable: 'cable', state: 'riding' },
  ], commands: { ...base.commands, inputs: { ready: 'flag:ready', wait: 'event:wait', riding: 'event:riding' }, routes: [
    { value: 1, spot: 'control', when: 'ready && wait && !riding', action: { kind: 'cable', cable: 'cable', command: 'start' } },
    { value: 2, spot: 'control', when: 'riding', action: { kind: 'flag', flag: 'done', value: true } },
  ] } });
  try {
    installQuestHost(host, quests, row, { ...ports, mechanics: { cables: cable }, commands: () => [{ actorId: 'interact', value: command }] });
    host.step(); expect(cable.starts).toBe(0);
    host.flags.set('ready'); host.step(); expect(cable.starts).toBe(0);
    host.state.timers['wait'] = 0; host.step(); expect(cable.starts).toBe(1);
    host.step(); expect(cable.starts).toBe(1);
    command = 2; host.step(); expect(host.flags.has('done')).toBe(true);
  } finally { host.dispose(); }
});

test('unknown mechanic identities refuse before callbacks or saved steps are installed', async () => {
  const host = await fixture();
  try {
    const before = host.adapters.size;
    for (const observation of [
      { binding: 'event:test', kind: 'cable', cable: 'missing', state: 'riding' },
      { binding: 'event:test', kind: 'mover', mover: 'missing', state: 'at-end' },
      { binding: 'event:test', kind: 'timer', timer: 'missing' },
    ]) {
      const row = parseQuestHost({ ...base, observations: [observation] });
      expect(() => installQuestHost(host, quests, row, { ...ports, mechanics: { cables: new Cable() }, commands: () => [] })).toThrow();
      expect(host.adapters.size).toBe(before);
    }
    const row = parseQuestHost({ ...base, commands: { ...base.commands, routes: [
      { value: 1, spot: 'control', when: 'true', action: { kind: 'cable', cable: 'missing', command: 'start' } },
    ] } });
    expect(() => installQuestHost(host, quests, row, { ...ports, mechanics: { cables: new Cable() }, commands: () => [] })).toThrow('Unknown cable');
    expect(host.adapters.size).toBe(before);
  } finally { host.dispose(); }
});

test('Signal data stages use the existing encounter and keep loaded lit saves quiet', async () => {
  for (const loaded of [false, true]) {
    const host = await fixture(); let summons = 0;
    try {
      if (loaded) host.flags.set(FLAG.lit);
      const source = parseQuestHost({ ...base, stages: signal.stages, summons: signal.summons,
        graph: { ...base.graph, actions: [{ row: 'fire', summon: 'sunscar.matriarch' }] },
        interactions: { marks: [], rows: [{ id: 'fire', act: 1, at: 'control', sets: [FLAG.lit] }] } });
      const graph = installQuestHost(host, quests, source, { ...ports, commands: () => [], mechanics: { encounters: new Map([
        ['sunscar.matriarch', { summon() { summons++; } }],
      ]) } });
      expect(summons).toBe(0);
      graph.run('fire'); expect(summons).toBe(loaded ? 0 : 1);
      graph.run('fire'); host.step(); expect(summons).toBe(loaded ? 0 : 1);
    } finally { host.dispose(); }
  }
});


test('mover rows queue on the existing driver and observe its committed endpoint', async () => {
  const host = await fixture();
  const rest = { at: { x: 0, y: 0, z: 0 }, euler: { x: 0, y: 0, z: 0 } };
  const motion = { driver: { kind: 'track' }, trigger: { kind: 'interact', permission: 0 },
    track: { clip: 'raise', duration: 0.1, loop: 'once', speed: 1, times: [0, 0.1], position: [[0, 0, 0], [0, 1, 0]] } };
  const rows = parseMovers([{ id: 'bridge', entity: 1, kind: 'channel', ...rest, boxes: [], enabled: true,
    ...lowerMoverMotion(motion, rest), ...motion, atEnd: { field: 5, equals: 1 } }]);
  const row = rows[0]; if (row === undefined) throw new Error('Missing mover fixture');
  try {
    const { runtime } = installMoverFixture(host, rows, new Map([[row.module, await compileMoverDriver('clip')]]), { systemId: 'move', restoring: false });
    let command = 1;
    const declaration = parseQuestHost({ ...base, observations: [{ binding: 'event:end', kind: 'mover', mover: 'bridge', state: 'at-end' }],
      commands: { ...base.commands, inputs: { end: 'event:end' }, routes: [
        { value: 1, spot: 'control', when: '!end', action: { kind: 'mover', mover: 'bridge', command: 1 } },
        { value: 2, spot: 'control', when: 'end', action: { kind: 'flag', flag: 'done', value: true } },
      ] } });
    installQuestHost(host, quests, declaration, { ...ports, mechanics: { motion: runtime }, commands: () => [{ actorId: 'interact', value: command }] });
    host.step(); expect(runtime.atEnd('bridge')).toBe(false);
    command = 2;
    for (let frame = 0; frame < 12; frame++) host.step();
    expect(runtime.atEnd('bridge')).toBe(true); expect(host.flags.has('done')).toBe(true);
    expect(runtime.pose('bridge').position.y).toBeCloseTo(1, 12);
  } finally { host.dispose(); }
}, 30000);
