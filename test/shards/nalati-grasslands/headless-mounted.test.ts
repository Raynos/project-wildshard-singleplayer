// oxlint-disable-next-line import/no-nodejs-modules -- Real Rapier and the admitted page terrain bytes.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, it } from 'vitest';
import { createSimHost, type SimCommand, type SimHost } from '../../../src/engine/sim';
import { snapshotSimHost, restoreSimHost } from '../../../src/engine/sim/snapshot';
import { loadRapier, type Rapier } from '../../../src/engine/physics/rapier';
import type { HeadlessRuntimePlan } from '../../../src/sdk/headlessRuntime';
import { prepareHeadlessRuntime, NALATI_TERRAIN_ASSET, NALATI_NAVMESH_ASSET } from '../../../src/shards/nalati-grasslands/runtime/headless';
import { nalatiMountedOf } from '../../../src/shards/nalati-grasslands/runtime/headlessMounted';
import { nalatiGroupsOf } from '../../../src/shards/nalati-grasslands/runtime/groups';
import { HITCH_HORSE_SPOTS } from '../../../src/shards/nalati-grasslands/world/layout';
import source from '../../../src/shards/nalati-grasslands/shard.config';
import { nalatiBake } from '../../../src/shards/nalati-grasslands/runtime/baked';
import { expectSameSimSnapshot } from '../../fake/simSnapshot';

let rapier: Rapier, plan: HeadlessRuntimePlan;
const effects = { commands: () => [], emit: () => { throw new Error('This mounted slice emits no quest rewards'); } };
beforeAll(async () => {
  rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
  const assets = new Map([NALATI_TERRAIN_ASSET, NALATI_NAVMESH_ASSET].map(path => [path, new Uint8Array(readFileSync(path))] as const));
  plan = await prepareHeadlessRuntime({ shard: source, assets, rapier });
});
const campIds = nalatiBake().spawns.filter(row => HITCH_HORSE_SPOTS.some(p => p.x === row.at[0] && p.z === row.at[2])).map(row => row.id);
function install(host: SimHost, restoring: boolean): void {
  plan.install(host, { restoring, ...effects });

}
const boot = (): SimHost => { const host = createSimHost(plan.level, { ...plan.ports, rapier }); install(host, false); return host; };
const mounted = (host: SimHost) => { const value = nalatiMountedOf(host); if (value === undefined) throw new Error('Missing mounted player'); return value; };
function command(tick: number): SimCommand {
  return { moveX: 0, moveZ: 0, yaw: 0, commandVersion: 1,
    steer: { keyX: tick < 60 ? 0 : 0.4, keyY: tick < 100 ? 1 : 0, stickX: tick >= 100 ? -0.25 : 0, stickY: tick >= 100 ? 0.7 : 0 },
    sprint: tick >= 140 && tick < 190, ...(tick === 25 || tick === 117 ? { jump: true } : {}) };
}

it('rides only the two real camp horses with a separate lying motor, then restores the standing capsule on dismount', () => {
  const host = boot(), ride = mounted(host);
  try {
    expect(campIds).toHaveLength(2);
    expect(ride.mount('creature:23')).toBe(false); expect(ride.mount('missing')).toBe(false);
    const id = campIds[0]; if (id === undefined) throw new Error('Missing camp horse');
    const a = host.entities.get(id); if (a === undefined) throw new Error('Missing camp actor');
    expect(ride.mount(id)).toBe(true); expect(ride.mount(id)).toBe(false);
    expect(host.player.motor.snapshot().enabled).toBe(false); expect(a.driven).toBe(true);
    expect(ride.body.motor?.opts.length).toBe(2.4);
    const start = a.position.clone();
    for (let tick = 0; tick < 200; tick++) host.step(command(tick));
    expect(a.position.distanceTo(start)).toBeGreaterThan(1); expect(ride.phase(id)).toBeGreaterThan(0);
    expect(nalatiGroupsOf(host)?.env.playerMounted).toBe(true);
    expect(a.motor).toBeNull(); // the native body LOD owns no second upright creature capsule
    const count = host.physics.world.colliders.len();
    ride.dismount(); expect(host.physics.world.colliders.len()).toBe(count - 1);
    expect(host.player.motor.snapshot().enabled).toBe(true); expect(a.driven).toBe(false); expect(ride.horse).toBeNull();
    expect(nalatiGroupsOf(host)?.env.playerMounted).toBe(false);
    expect(host.player.position.distanceTo(a.position)).toBeGreaterThan(1);
    host.step({ moveX: 0, moveZ: 0, yaw: 0 });
  } finally { host.dispose(); }
  expect(Object.values(host.scope.census).every(n => n === 0)).toBe(true);
});

it('reconnects the saved lying capsule without duplication and reproduces the actual native riding suffix', () => {
  const original = boot(); let restored: SimHost | undefined;
  try {
    const id = campIds[1]; if (id === undefined) throw new Error('Missing camp horse');
    expect(mounted(original).mount(id)).toBe(true);
    for (let tick = 0; tick < 41; tick++) original.step(command(tick));
    const saved = snapshotSimHost(original), count = original.physics.world.colliders.len();
    restored = restoreSimHost(plan.level, { ...plan.ports, rapier }, saved, fresh => { install(fresh, true); });
    expect(restored.physics.world.colliders.len()).toBe(count);
    expect(mounted(restored).body.motor?.snapshot()).toEqual(mounted(original).body.motor?.snapshot());
    expect(mounted(restored).body.snapshotBody()).toEqual(mounted(original).body.snapshotBody());
    expect(mounted(restored).phase(id)).toBe(mounted(original).phase(id));
    for (let tick = 41; tick < 201; tick++) { original.step(command(tick)); restored.step(command(tick)); }
    expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(original));
    expect(mounted(restored).rider).toEqual(mounted(original).rider);
  } finally { restored?.dispose(); original.dispose(); }
});

it('refuses malformed history atomically and a native capsule belonging to another owner', () => {
  const host = boot(); let failed: SimHost | undefined;
  try {
    const id = campIds[0]; if (id === undefined) throw new Error('Missing camp horse');
    expect(mounted(host).mount(id)).toBe(true); host.step(command(0));
    const adapter = host.adapters.get('nalati.mounted'); if (adapter === undefined) throw new Error('Missing owned continuation');
    const good = adapter.snapshot();
    if (good === null || Array.isArray(good) || typeof good !== 'object') throw new Error('Invalid test checkpoint');
    for (const bad of [{ ...good, version: 2 }, { ...good, body: { wrong: true } }, { ...good, poses: [] }, { ...good, horse: 'creature:23' }]) {
      expect(() => adapter.restore(bad)).toThrow(); expect(adapter.snapshot()).toEqual(good);
    }
    const saved = snapshotSimHost(host), row = saved.adapters.find(a => a.id === 'nalati.mounted');
    if (row === undefined) throw new Error('Missing saved continuation');
    if (row.state === null || Array.isArray(row.state) || typeof row.state !== 'object') throw new Error('Missing saved continuation');
    const motor = row.state['motor'];
    if (motor === null || Array.isArray(motor) || typeof motor !== 'object') throw new Error('Missing saved mounted motor');
    row.state['motor'] = { ...motor, colliderHandle: host.player.motor.collider.handle };
    expect(() => restoreSimHost(plan.level, { ...plan.ports, rapier }, saved, fresh => { failed = fresh; install(fresh, true); })).toThrow('Invalid mounted native capsule identity');
  } finally { host.dispose(); }
  expect(failed).toBeDefined(); expect(Object.values(failed?.scope.census ?? {}).every(n => n === 0)).toBe(true);
});

it('crouches through the actual standing controller, refuses the grounded jump, and retains that state on restore', () => {
  const original = boot(), fast = boot(); let restored: SimHost | undefined;
  try {
    const walk: SimCommand = { moveX: 0, moveZ: -1, yaw: 0, commandVersion: 1, sprint: true, crouch: true };
    const start = original.player.position.clone();
    for (let tick = 0; tick < 30; tick++) { original.step(walk); fast.step({ ...walk, crouch: false }); }
    expect(mounted(original).rider.crouching).toBe(true); expect(mounted(original).rider.sprinting).toBe(false);
    expect(nalatiGroupsOf(original)?.env.playerCrouched).toBe(true);
    expect(original.player.position.distanceTo(start)).toBeGreaterThan(0.9);
    expect(fast.player.position.distanceTo(start)).toBeGreaterThan(original.player.position.distanceTo(start) * 2);
    original.step({ ...walk, jump: true });
    expect(original.playerFall.grounded).toBe(true); expect(original.playerFall.vy).toBe(0);
    const saved = snapshotSimHost(original);
    restored = restoreSimHost(plan.level, { ...plan.ports, rapier }, saved, fresh => { install(fresh, true); });
    expect(mounted(restored).rider.crouching).toBe(true); expect(nalatiGroupsOf(restored)?.env.playerCrouched).toBe(true);
    for (let tick = 0; tick < 30; tick++) { original.step(walk); restored.step(walk); }
    expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(original));
    expect(mounted(restored).rider).toEqual(mounted(original).rider);
    original.step({ ...walk, crouch: false, jump: true });
    expect(original.playerFall.grounded).toBe(false); expect(original.playerFall.vy).toBeGreaterThan(0);
  } finally { restored?.dispose(); fast.dispose(); original.dispose(); }
});
