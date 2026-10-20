// oxlint-disable-next-line import/no-nodejs-modules -- Native prop ownership exercises the shipped physics binary.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { loadRapier } from '../src/engine/physics/rapier';
import { addPiece } from '../src/engine/physics/pieces';
import { createSimHost } from '../src/engine/sim';
import { snapshotSimHost, restoreSimHost } from '../src/engine/sim/snapshot';
import { BARREL_HALF } from '../src/engine/world/interact/barrel';
import { NativeQuestProps } from '../src/game/quest/nativeProps';
import { NativeQuestPropsSchema } from '../src/format/questInteractions';
import { NATIVE_QUEST_PROPS } from '../src/shards/driftwood-isle/generators/nativeQuestProps';
import * as v from 'valibot';
import { SIM_LEVEL } from './fixtures/sim-level/level';

test('salt-marsh physical quest props own independent handles, floor layers and same-tick latches', async () => {
  const rapier = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')));
  const host = createSimHost({ ...SIM_LEVEL, entities: [], quests: [] }, { rapier });
  const gate = addPiece(host.physics, { id: 'marsh.gate', name: 'Sluice', category: 'props', file: 'fixture', colliders: [
    { kind: 'box', x: 8, y: 1.5, z: 0, hx: .5, hy: 1.5, hz: .2 },
  ] }).colliders[0];
  const rows = { water: -5, floors: [{ x: 0, z: 0, step: 2, width: 3, height: 3, values: Array.from({ length: 9 }, () => 3) }],
    barrels: ['north', 'south'].map((id, i) => ({ id, home: { x: 2 + i * 3, y: 0, z: 2 }, yaw: .5, leash: 6, owner: { kind: 'barrel', id } })),
    plates: [{ at: { x: 4, y: .5, z: 2 }, size: 1, when: { all: ['marsh.plate'] } }],
    gates: [{ flag: 'open:marsh.gate', box: { x: 8, z: 0, hw: .5, hd: .2, yTop: 3, yBottom: 0 } }],
  };
  try {
    const props = new NativeQuestProps(host, rows, false), first = props.snapshot('north'), second = props.snapshot('south');
    if (first === null || second === null || gate === undefined) throw new Error('Missing native props');
    expect(first.handle).not.toBe(second.handle); expect(props.floorAt(2, 2)).toBe(3); expect(props.floorAt(-10, -10)).toBe(0);
    const body = host.physics.world.getRigidBody(first.handle), other = host.physics.world.getRigidBody(second.handle);
    body.setTranslation({ x: 20, y: 2, z: 2 }, true); props.step(.01, { x: 0, z: 0 });
    expect(body.translation().x).toBe(2); expect(body.translation().y).toBeCloseTo(BARREL_HALF + .01);
    expect(other.translation().x).toBe(5);
    body.setTranslation({ x: 4, y: .5, z: 2 }, true); host.flags.set('marsh.plate'); props.step(5, { x: 0, z: 0 });
    expect(body.translation().x).toBe(4); expect(props.snapshot('north')?.watch.lost).toBe(0);
    host.flags.clear('marsh.plate'); props.step(5, { x: 0, z: 0 }); expect(body.translation().x).toBe(2);
    expect(gate.isEnabled()).toBe(true); host.flags.set('open:marsh.gate'); props.syncGates(); expect(gate.isEnabled()).toBe(false);
    const state = props.snapshot('north'); props.restore('north', state); expect(props.snapshot('north')).toEqual(state);
    expect(() => props.restore('north', null)).toThrow(); expect(props.snapshot('north')).toEqual(state);
    expect(() => props.restore('missing', first)).toThrow();
    host.onStep('marsh.props', () => undefined, {
      snapshot: () => ({ north: props.snapshot('north'), south: props.snapshot('south') }),
      restore: value => {
        const envelope = v.parse(v.strictObject({ north: v.unknown(), south: v.unknown() }), value);
        props.restore('north', envelope.north); props.restore('south', envelope.south);
      }, physicsRestored: () => { props.physicsRestored(); },
    });
    const saved = snapshotSimHost(host);
    let continued: NativeQuestProps | undefined;
    const restored = restoreSimHost({ ...SIM_LEVEL, entities: [], quests: [] }, { rapier }, saved, fresh => {
      const owner = new NativeQuestProps(fresh, rows, true); continued = owner;
      fresh.onStep('marsh.props', () => undefined, {
        snapshot: () => ({ north: owner.snapshot('north'), south: owner.snapshot('south') }),
        restore: value => {
          const envelope = v.parse(v.strictObject({ north: v.unknown(), south: v.unknown() }), value);
          owner.restore('north', envelope.north); owner.restore('south', envelope.south);
        }, physicsRestored: () => { owner.physicsRestored(); },
      });
    });
    try {
      expect(continued?.snapshot('north')).toEqual(state); expect(continued?.snapshot('south')).toEqual(props.snapshot('south'));
      expect(restored.physics.world.bodies.len()).toBe(host.physics.world.bodies.len());
    } finally { restored.dispose(); }
    expect(() => new NativeQuestProps(host, { ...rows, floors: [{ ...rows.floors[0], values: [] }] }, false)).toThrow('rows');
  } finally { host.dispose(); }
});

test('Driftwood prop compilation retains one barrel, both plates and the captured hold grid', () => {
  expect(v.parse(NativeQuestPropsSchema, NATIVE_QUEST_PROPS)).toEqual(NATIVE_QUEST_PROPS);
  expect(NATIVE_QUEST_PROPS.barrels.map(row => row.id)).toEqual(['tide-barrel']);
  expect(NATIVE_QUEST_PROPS.plates).toHaveLength(2); expect(NATIVE_QUEST_PROPS.gates.map(row => row.flag)).toEqual(['open:sluice']);
});
