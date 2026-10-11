// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the committed native physics binary.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, it } from 'vitest';
import { createSimHost, type SimHost, type SimLevel } from '../../../src/engine/sim';
import { loadRapier, type Rapier } from '../../../src/engine/physics/rapier';
import { snapshotSimHost, restoreSimHost } from '../../../src/engine/sim/snapshot';
import { installPineCrossbow, CROSSBOW_STEP } from '../../../src/shards/pine-hollow/runtime/weapons/headlessCrossbow';
import { installPineCrossbow as shippingCrossbow } from '../../fixtures/weapon-oracle/headlessCrossbow';
import { CROSSBOW_WEAPON_PROFILE } from '../../../src/shards/pine-hollow/data/crossbowProfile';
import type { BoltKind } from '../../../src/shards/pine-hollow/loadout/ammo';
import { SIM_LEVEL } from '../../fixtures/sim-level/level';
import { expectSameSimSnapshot } from '../../fake/simSnapshot';

let rapier: Rapier;
beforeAll(async () => { rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); });
it('retains 10k actual native shot, flight, ammunition, body/contact and RNG steps against the frozen shipping owner', () => {
  const target = SIM_LEVEL.entities[0]; if (target === undefined) throw new Error('Missing actual target');
  const level: SimLevel = { ...SIM_LEVEL, quests: [], entities: [{ ...target, at: { x: 0, y: 0, z: -18 } }] };
  let trigger = false, enabled = true, ammo: BoltKind = 'iron';
  const ports = (host: SimHost) => ({ shots: () => trigger ? [target.id] : [], enabled: () => enabled,
    bodies: () => Array.from(host.entities.values()), ammunition: () => ammo, flight: () => ({ gravity: 0.83, drag: 1.21 }) });
  const original = createSimHost(level, { rapier }), expected = createSimHost(level, { rapier });
  const actual = installPineCrossbow(original, ports(original)), shipping = shippingCrossbow(expected, ports(expected));
  try {
    for (let tick = 0; tick < 10000; tick++) {
      trigger = tick % 19 === 0; enabled = tick % 13 !== 0; ammo = tick % 3 === 0 ? 'pitch' : tick % 3 === 1 ? 'broadhead' : 'iron';
      if (tick % 751 === 0) { actual.addBolts(4); shipping.addBolts(4); }
      original.step(); expected.step();
      expect(original.adapters.get(CROSSBOW_STEP)?.snapshot()).toEqual(expected.adapters.get(CROSSBOW_STEP)?.snapshot());
      expect(original.rng.snapshot()).toEqual(expected.rng.snapshot());
    }
    expectSameSimSnapshot(snapshotSimHost(original), snapshotSimHost(expected));
  } finally { expected.dispose(); original.dispose(); }
});
it('uses changed real quiver, pool, launch, flight and reload clocks and restores one mid-reload suffix exactly', () => {
  const target = SIM_LEVEL.entities[0]; if (target === undefined) throw new Error('Missing actual target');
  const level: SimLevel = { ...SIM_LEVEL, quests: [], entities: [{ ...target, at: { x: 0, y: 0, z: -12 } }] };
  const profile = { ...CROSSBOW_WEAPON_PROFILE, reserve: 4, reload: 0.4, autoReload: 0.2, interval: 0.1, damageScale: 0.01,
    spreadAds: 0, spreadHip: 0, projectile: { ...CROSSBOW_WEAPON_PROFILE.projectile, speed: 31, pool: 2, substeps: 2, lifetime: 4, flight: { ...CROSSBOW_WEAPON_PROFILE.projectile.flight, gravity: 0 } } };
  let trigger = false;
  const install = (host: SimHost) => installPineCrossbow(host, { profile, shots: () => trigger ? [target.id] : [], enabled: () => true,
    bodies: () => Array.from(host.entities.values()) });
  const original = createSimHost(level, { rapier }), crossbow = install(original); let restored: SimHost | undefined;
  try {
    expect(crossbow.state.quiver).toBe(5);
    for (let tick = 0; tick < 120; tick++) original.step();
    trigger = true; original.step(); trigger = false;
    expect(crossbow.state.quiver).toBe(4); expect(crossbow.flying()).toBe(1);
    for (let tick = 0; tick < 24; tick++) original.step();
    expect(crossbow.state.reloading).toBe(true);
    const body = original.entities.get(target.id); if (body === undefined) throw new Error('Missing actual body');
    expect(body.hp).toBeLessThan(body.maxHp); expect(body.hp).toBeGreaterThan(body.maxHp - 5);
    const snapshot = snapshotSimHost(original);
    restored = restoreSimHost(level, { rapier }, snapshot, fresh => { install(fresh); });
    expectSameSimSnapshot(snapshotSimHost(restored), snapshot);
    for (let tick = 0; tick < 90; tick++) { trigger = tick % 37 === 0; original.step(); restored.step(); }
    expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(original));
    crossbow.addBolts(99); expect(crossbow.state.quiver).toBe(5);
  } finally { restored?.dispose(); original.dispose(); }
});
