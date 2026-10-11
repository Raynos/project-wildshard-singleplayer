// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the committed native physics binary.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, it } from 'vitest';
import { createSimHost, type SimHost, type SimLevel } from '../../../src/engine/sim';
import { loadRapier, type Rapier } from '../../../src/engine/physics/rapier';
import { snapshotSimHost, restoreSimHost } from '../../../src/engine/sim/snapshot';
import { installPineLever, LEVER_STEP } from '../../../src/shards/pine-hollow/runtime/weapons/headlessLever';
import { LEVER_WEAPON_PROFILE } from '../../../src/shards/pine-hollow/data/leverProfile';
import { SIM_LEVEL } from '../../fixtures/sim-level/level';
import { expectSameSimSnapshot } from '../../fake/simSnapshot';

let rapier: Rapier;
beforeAll(async () => { rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); });
it('uses admitted magazine/reserve/hitscan/cycle values on real bodies and restores one mid-cycle native suffix exactly', () => {
  const target = SIM_LEVEL.entities[0]; if (target === undefined) throw new Error('Missing real target');
  const level: SimLevel = { ...SIM_LEVEL, quests: [], entities: [{ ...target, at: { x: 0, y: 0, z: -12 } }] };
  const profile = { ...LEVER_WEAPON_PROFILE, magazine: 3, reserve: 9, interval: 1.12, damageScale: 0.01,
    lever: { ...LEVER_WEAPON_PROFILE.lever, cycleTime: 1 } };
  let trigger = true;
  const install = (host: SimHost) => installPineLever(host, { profile, shots: () => trigger ? [target.id] : [], enabled: () => true,
    bodies: () => Array.from(host.entities.values()) });
  const original = createSimHost(level, { rapier }), rifle = install(original); let restored: SimHost | undefined;
  try {
    expect(rifle.act.rounds).toBe(3); expect(rifle.store.reserve).toBe(9);
    original.step(); trigger = false;
    const body = original.entities.get(target.id); if (body === undefined) throw new Error('Missing native body');
    expect(body.hp).toBeLessThan(body.maxHp); expect(body.hp).toBeGreaterThan(body.maxHp - 5);
    for (let tick = 0; tick < 45; tick++) original.step(); expect(rifle.act.phase).toBe('cycle');
    const snapshot = snapshotSimHost(original);
    restored = restoreSimHost(level, { rapier }, snapshot, fresh => { install(fresh); });
    expectSameSimSnapshot(snapshotSimHost(restored), snapshot);
    for (let tick = 0; tick < 90; tick++) { trigger = tick % 17 === 0; original.step(); restored.step(); }
    expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(original));
    expect(original.adapters.get(LEVER_STEP)?.snapshot()).toEqual(restored.adapters.get(LEVER_STEP)?.snapshot());
  } finally { restored?.dispose(); original.dispose(); }
});
