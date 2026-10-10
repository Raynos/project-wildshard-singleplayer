// oxlint-disable-next-line import/no-nodejs-modules -- This fixture exercises the committed native physics binary.
import { readFileSync } from 'node:fs';
import { Vector3 } from 'three';
import { beforeAll, expect, it } from 'vitest';
import { createSimHost, type SimHost, type SimLevel } from '../../../src/engine/sim';
import { snapshotSimHost, restoreSimHost } from '../../../src/engine/sim/snapshot';
import { loadRapier, type Rapier } from '../../../src/engine/physics/rapier';
import { projectileFlightStep } from '../../../src/engine/combat/projectileFlight';
import { installPineAir } from '../../../src/shards/pine-hollow/runtime/air';
import { installPineRangedMotion } from '../../../src/shards/pine-hollow/runtime/weapons/motion';
import { installPineLongbow, LONGBOW_STEP } from '../../../src/shards/pine-hollow/runtime/weapons/headlessLongbow';
import { installPineCrossbow, CROSSBOW_STEP } from '../../../src/shards/pine-hollow/runtime/weapons/headlessCrossbow';
import { ARROW_FLIGHT } from '../../../src/shards/pine-hollow/weapons/longbowFlight';
import { boltFlight, type BoltKind } from '../../../src/shards/pine-hollow/loadout/ammo';
import { boltFlightStep } from '../../../src/shards/pine-hollow/weapons/crossbow/flight';
import { CROSSBOW_PROFILE } from '../../../src/shards/pine-hollow/weapons/crossbow/profiles';
import { SIM_LEVEL } from '../../fixtures/sim-level/level';
import { expectSameSimSnapshot } from '../../fake/simSnapshot';
import * as v from 'valibot';

let rapier: Rapier;
beforeAll(async () => { rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); });
const level: SimLevel = { ...SIM_LEVEL, seed: 1337, ground: { size: 500, height: 0 }, entities: [], quests: [] };
const vec = v.tuple([v.number(), v.number(), v.number()]);
const flying = v.object({ flying: v.array(v.object({ active: v.boolean(), pos: vec, vel: vec })) });
const bolts = v.object({ bolts: v.array(v.object({ active: v.boolean(), pos: vec, vel: vec })) });
const savedArrow = (host: SimHost): v.InferOutput<typeof flying>['flying'][number] => {
  const row = v.parse(flying, host.adapters.get(LONGBOW_STEP)?.snapshot()).flying.find(arrow => arrow.active);
  if (row === undefined) throw new Error('No live native arrow'); return row;
};

it('uses one native air owner for real moving arrows and restores the same weather/flight/pickup suffix', () => {
  let held = true;
  const install = (host: SimHost): ReturnType<typeof installPineAir> => {
    const speedFactor = installPineRangedMotion(host), air = installPineAir(host, () => 0.02, 'rain');
    installPineLongbow(host, { heavy: () => held ? {} : null, enabled: () => true, bodies: () => [], speedFactor, wind: air.wind });
    return air;
  };
  const original = createSimHost(level, { rapier }), air = install(original);
  let restored: SimHost | undefined;
  try {
    for (let tick = 0; tick < 50; tick++) original.step({ moveX: 1, moveZ: 0, yaw: 0 });
    held = false; original.step({ moveX: 1, moveZ: 0, yaw: 0 });
    const before = savedArrow(original), pos = new Vector3(...before.pos), vel = new Vector3(...before.vel), wind = new Vector3();
    const previousAir = air.snapshot();
    // Independent page-law substeps at the actual next wind clock, including rain's previous published boost.
    air.step(1 / 60, 0.02);
    for (let step = 0; step < 4; step++) projectileFlightStep(pos, vel, 1 / 240, ARROW_FLIGHT, air.wind.vecAt(pos.x, pos.z, wind));
    // The oracle advanced the owner once: restore its whole previous continuation before the actual step.
    air.restore(previousAir);
    original.step({ moveX: 1, moveZ: 0, yaw: 0 });
    const after = savedArrow(original);
    expect(after.pos).toEqual(pos.toArray()); expect(after.vel).toEqual(vel.toArray());
    const snapshot = snapshotSimHost(original);
    restored = restoreSimHost(level, { rapier }, snapshot, fresh => { install(fresh); });
    expectSameSimSnapshot(snapshotSimHost(restored), snapshot);
    for (let tick = 0; tick < 800; tick++) {
      const command = { moveX: tick < 40 ? 1 : 0, moveZ: 0, yaw: 0 };
      original.step(command); restored.step(command);
    }
    expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(original));
  } finally { restored?.dispose(); original.dispose(); }
});

it('reads rainy iron-bolt multipliers on each native substep and leaves dry fallback unchanged', () => {
  const target = SIM_LEVEL.entities[0];
  if (target === undefined) throw new Error('Missing real target');
  const ranged: SimLevel = { ...level, entities: [{ ...target, at: { x: 0, y: 0, z: -80 } }] };
  const dry = createSimHost(ranged, { rapier }), wet = createSimHost(ranged, { rapier });
  try {
    const air = installPineAir(wet, () => 0.2, 'rain');
    installPineCrossbow(dry, { shots: () => [target.id], enabled: () => true, bodies: () => [] });
    installPineCrossbow(wet, { shots: () => [target.id], enabled: () => true, bodies: () => [], flight: () => boltFlight('iron', air.weather.rain) });
    dry.step(); wet.step();
    const live = (host: SimHost): v.InferOutput<typeof bolts>['bolts'][number] => {
      const bolt = v.parse(bolts, host.adapters.get(CROSSBOW_STEP)?.snapshot()).bolts.find(row => row.active);
      if (bolt === undefined) throw new Error('No actual bolt'); return bolt;
    };
    expect(live(wet).vel[1]).toBeLessThan(live(dry).vel[1]);
    expect(Math.abs(live(wet).vel[2])).toBeLessThan(Math.abs(live(dry).vel[2]));
    expect(wet.rng.stream('gameplay').snapshot()).toEqual(dry.rng.stream('gameplay').snapshot());
  } finally { wet.dispose(); dry.dispose(); }
});

it('keeps the launched special bolt kind after selection changes and restores its exact wet-flight suffix', () => {
  const target = SIM_LEVEL.entities[0]; if (target === undefined) throw new Error('Missing real target');
  const ranged: SimLevel = { ...level, entities: [{ ...target, at: { x: 0, y: 0, z: -80 } }] };
  const savedBolts = v.object({ bolts: v.array(v.object({ active: v.boolean(), pos: vec, vel: vec, ammo: v.optional(v.picklist(['iron', 'pitch', 'broadhead']), 'iron') })) });
  for (const kind of ['pitch', 'broadhead'] as const) {
    let selected: BoltKind = kind, fire = true;
    const install = (host: SimHost): void => { installPineCrossbow(host, { shots: () => fire ? [target.id] : [], enabled: () => true,
      bodies: () => [], ammunition: () => selected, flight: ammo => boltFlight(ammo, 1) }); };
    const original = createSimHost(ranged, { rapier }); install(original); let restored: SimHost | undefined;
    try {
      original.step(); fire = false; selected = 'iron';
      const read = (host: SimHost) => {
        const row = v.parse(savedBolts, host.adapters.get(CROSSBOW_STEP)?.snapshot()).bolts.find(bolt => bolt.active);
        if (row === undefined) throw new Error('No special bolt'); return row;
      };
      const before = read(original); expect(before.ammo).toBe(kind);
      const pos = new Vector3(...before.pos), vel = new Vector3(...before.vel);
      for (let i = 0; i < 4; i++) boltFlightStep(pos, vel, 1 / 240, boltFlight(kind, 1), CROSSBOW_PROFILE);
      original.step(); expect(read(original).pos).toEqual(pos.toArray()); expect(read(original).vel).toEqual(vel.toArray());
      const saved = snapshotSimHost(original);
      restored = restoreSimHost(ranged, { rapier }, saved, install); expectSameSimSnapshot(snapshotSimHost(restored), saved);
      for (let i = 0; i < 100; i++) { original.step(); restored.step(); }
      expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(original));
    } finally { restored?.dispose(); original.dispose(); }
  }
});

it('applies the captured broadhead multiplier to a real boar even after switching the rail back to iron', () => {
  const target = SIM_LEVEL.entities[0]; if (target === undefined) throw new Error('Missing authored boar');
  const ranged: SimLevel = { ...level, entities: [{ ...target, at: { x: 0, y: 0, z: -12 } }] };
  const amounts: number[] = [];
  for (const kind of ['iron', 'broadhead'] as const) {
    const host = createSimHost(ranged, { rapier }); let fire = true, selected: BoltKind = kind;
    try {
      const body = host.entities.get(target.id); if (body === undefined) throw new Error('Missing real native boar'); body.scripted = true;
      host.events.on('damage.dealt', ({ req }) => { if (req.target === body.combatActor()) amounts.push(req.amount); }, host.scope);
      installPineCrossbow(host, { shots: () => fire ? [target.id] : [], enabled: () => true, bodies: () => [body], ammunition: () => selected });
      host.step(); fire = false; selected = 'iron';
      for (let i = 0; i < 60 && amounts.length < (kind === 'iron' ? 1 : 2); i++) host.step();
    } finally { host.dispose(); }
  }
  expect(amounts).toHaveLength(2); const plain = amounts[0]; if (plain === undefined) throw new Error('No plain bolt hit');
  expect(amounts[1]).toBe(plain * 1.4);
});
