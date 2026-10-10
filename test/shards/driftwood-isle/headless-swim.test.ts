// oxlint-disable-next-line import/no-nodejs-modules -- The real headless runtime uses the committed native Rapier wasm.
import { readFileSync } from 'node:fs';
import { Vector3 } from 'three';
import { beforeAll, expect, it } from 'vitest';
import { createSimHost, type SimHost } from '../../../src/engine/sim';
import { decodeSimSnapshot, restoreSimHost, serializeSimSnapshot, snapshotSimHost } from '../../../src/engine/sim/snapshot';
import { loadRapier, type Rapier } from '../../../src/engine/physics/rapier';
import { waveClock } from '../../../src/engine/world/waves';
import type { HeadlessRuntimePlan } from '../../../src/sdk/headlessRuntime';
import source from '../../../src/shards/driftwood-isle/shard.config';
import { DRIFTWOOD_SEA, LOWERED_SEA } from '../../../src/shards/driftwood-isle/world/sea';
import { driftwoodBake } from '../../../src/shards/driftwood-isle/runtime/baked';
import { prepareHeadlessRuntime } from '../../../src/shards/driftwood-isle/runtime/headless';
import { expectSameSimSnapshot } from '../../fake/simSnapshot';

let rapier: Rapier, plan: HeadlessRuntimePlan;
const effects = { commands: () => [], emit: () => undefined };
beforeAll(async () => {
  rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
  plan = await prepareHeadlessRuntime({ shard: source, assets: new Map(), rapier });
});
const boot = (): SimHost => {
  const host = createSimHost(plan.level, { ...plan.ports, rapier });
  plan.install(host, { restoring: false, ...effects }); return host;
};
const restore = (wire: string): SimHost => {
  const saved = decodeSimSnapshot(wire), ports = { ...plan.ports, rapier };
  return restoreSimHost(plan.level, ports, saved, host => {
    if (ports.heightAt !== undefined) host.setHeightQuery(ports.heightAt);
    plan.install(host, { restoring: true, snapshot: saved, ...effects });
  });
};
const still = { moveX: 0, moveZ: 0, yaw: 0 };
const put = (host: SimHost, x: number, y: number, z: number): void => {
  const at = new Vector3(x, y, z); host.player.motor.resetAt(at); host.player.position.copy(at);
};

it('installs the real lowered sea with dry entry sockets, swims and dives, and restores the complete wet continuation on its own wave clock', () => {
  const original = boot(); let resumed: SimHost | undefined;
  const oldWaveTime = waveClock.t;
  try {
    expect(original.hasWater).toBe(true);
    const x = -220, z = -210;
    expect(DRIFTWOOD_SEA.restAt(x, z)).toBe(LOWERED_SEA);
    expect(driftwoodBake().floorAt(x, z)).toBeLessThan(LOWERED_SEA - 3);
    // Focused swim law at real deep water; the optional reef journey remains a separate gameplay proof.
    put(original, x, LOWERED_SEA - 0.9, z);
    original.step(still);
    expect(original.playerMode).toBe('swim'); expect(original.playerSwim.on).toBe(true);
    for (let tick = 0; tick < 90; tick++) original.step(still);
    const afloat = original.player.position.y;
    expect(afloat).toBeGreaterThan(LOWERED_SEA - 2); expect(afloat).toBeLessThan(LOWERED_SEA - 0.7);
    for (let tick = 0; tick < 60; tick++) original.step({ ...still, dive: true });
    expect(original.playerSwim.diving).toBe(true); expect(original.player.position.y).toBeLessThan(afloat - 0.5);
    resumed = restore(serializeSimSnapshot(snapshotSimHost(original)));
    expect(resumed.hasWater).toBe(true); expect(resumed.playerMode).toBe('swim');
    expectSameSimSnapshot(snapshotSimHost(resumed), snapshotSimHost(original));
    for (let tick = 0; tick < 240; tick++) {
      const command = { ...still, moveX: tick < 60 ? 0.2 : 0, surface: tick < 120 };
      waveClock.t = tick * 17; original.step(command);
      // A renderer or another host may have a different wave clock; neither may change this host's ocean.
      waveClock.t = -tick * 29; resumed.step(command);
      expect(resumed.player.position).toEqual(original.player.position);
      expect(resumed.swimVelocity).toEqual(original.swimVelocity);
      expect(resumed.playerSwim).toEqual(original.playerSwim);
    }
    expect(original.playerSwim.diving).toBe(false); expect(original.playerMode).toBe('swim');
    expectSameSimSnapshot(snapshotSimHost(resumed), snapshotSimHost(original));
  } finally { waveClock.t = oldWaveTime; resumed?.dispose(); original.dispose(); }
});

it('keeps all four real dry sockets out of the sea and refuses a second water owner', () => {
  const host = boot();
  try {
    for (const [x, z] of [[0, -240], [0, 240], [-240, 0], [240, 0]] as const) {
      expect(DRIFTWOOD_SEA.restAt(x, z)).toBeNull();
      put(host, x, -0.1, z); host.step(still);
      expect(host.playerSwim.on).toBe(false);
    }
    expect(() => host.useWater({ surfaceAt: () => 0 })).toThrow('Water belongs to an owned host, once');
  } finally { host.dispose(); }
});
