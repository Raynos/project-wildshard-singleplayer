import { beforeAll, expect, it } from 'vitest';
import { createSimHost, type SimHost } from '../../src/engine/sim';
import { snapshotSimHost, restoreSimHost } from '../../src/engine/sim/snapshot';
import { loadRapier } from '../../src/engine/physics/rapier';
import { SIM_LEVEL } from '../fixtures/sim-level/level';
import { expectSameSimSnapshot } from '../fake/simSnapshot';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';

let rapier: Awaited<ReturnType<typeof loadRapier>>;
beforeAll(async () => { rapier = await loadRapier(await (await fetch(wasmInline)).arrayBuffer()); });

function install(host: SimHost): { setPresent: (on: boolean) => void } {
  let present = true;
  host.useBodyBands({ rate: () => 'always', present: () => present });
  host.onStep('test.presence', () => {
    for (const body of host.entities.values()) {
      if (host.brainDt(body.entityId) > 0) body.setMotion(0, 2, 4);
    }
  }, { snapshot: () => present, restore: value => {
    if (typeof value !== 'boolean') throw new Error('Invalid roster presence'); present = value;
  } });
  return { setPresent: on => { present = on; } };
}

it('freezes absent roster bodies and their clocks, releases native motors, then resumes without catch-up', () => {
  const host = createSimHost(SIM_LEVEL, { rapier }), presence = install(host);
  try {
    const body = host.entities.get('boar:1'); if (body === undefined) throw new Error('Missing actual body');
    host.step(); expect(body.motor).not.toBeNull();
    body.startAttack(1.1); presence.setPresent(false); host.step();
    expect(body.motor).toBeNull(); const frozen = body.snapshot(), point = body.position.clone();
    const raw = host.physics.world.colliders.len();
    for (let tick = 0; tick < 300; tick++) host.step();
    expect(body.snapshot()).toEqual(frozen); expect(host.physics.world.colliders.len()).toBe(raw);
    expect(host.bodyDt(body.entityId)).toBe(0); expect(host.brainDt(body.entityId, true)).toBe(0);
    presence.setPresent(true); host.step();
    expect(body.motor).not.toBeNull(); expect(body.attackPhase).toBeCloseTo((1 / 60) / 1.1, 14);
    expect(body.position.distanceTo(point)).toBeGreaterThan(0);
  } finally { host.dispose(); }
});

it('restores absent roster state and native absence before an exact frozen/resumed suffix', () => {
  const host = createSimHost(SIM_LEVEL, { rapier }), presence = install(host);
  try {
    host.step(); presence.setPresent(false); host.step(); const saved = snapshotSimHost(host);
    let restoredPresence: ReturnType<typeof install> | undefined;
    const copy = restoreSimHost(SIM_LEVEL, { rapier }, saved, restored => { restoredPresence = install(restored); });
    try {
      expectSameSimSnapshot(snapshotSimHost(copy), saved);
      for (let tick = 0; tick < 120; tick++) { host.step(); copy.step(); }
      expectSameSimSnapshot(snapshotSimHost(copy), snapshotSimHost(host));
      if (restoredPresence === undefined) throw new Error('Missing restored roster owner');
      presence.setPresent(true); restoredPresence.setPresent(true);
      for (let tick = 0; tick < 120; tick++) { host.step(); copy.step(); }
      expectSameSimSnapshot(snapshotSimHost(copy), snapshotSimHost(host));
    } finally { copy.dispose(); }
  } finally { host.dispose(); }
});

it('keeps an omitted presence predicate identical to the all-present path', () => {
  const old = createSimHost(SIM_LEVEL, { rapier }), explicit = createSimHost(SIM_LEVEL, { rapier });
  old.useBodyBands(); explicit.useBodyBands({ present: () => true });
  try {
    for (let tick = 0; tick < 120; tick++) { old.step(); explicit.step(); }
    expectSameSimSnapshot(snapshotSimHost(explicit), snapshotSimHost(old));
  } finally { explicit.dispose(); old.dispose(); }
});
