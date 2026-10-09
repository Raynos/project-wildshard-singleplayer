// oxlint-disable-next-line import/no-nodejs-modules -- The native witness reads committed terrain/navigation and real WASM.
import { readFileSync } from 'node:fs';
import { Vector3 } from 'three';
import { beforeAll, expect, it, vi } from 'vitest';
import { createSimHost, type SimHost } from '../../../src/engine/sim';
import { snapshotSimHost, restoreSimHost, serializeSimSnapshot, decodeSimSnapshot, type SimSnapshot } from '../../../src/engine/sim/snapshot';
import { loadRapier, type Rapier } from '../../../src/engine/physics/rapier';
import type { HeadlessRuntimePlan } from '../../../src/sdk/headlessRuntime';
import { expectSameSimSnapshot } from '../../fake/simSnapshot';
import source from '../../../src/shards/nalati-grasslands/shard.config';
import { nalatiBake } from '../../../src/shards/nalati-grasslands/runtime/baked';
import { NALATI_TERRAIN_ASSET, NALATI_NAVMESH_ASSET, prepareHeadlessRuntime } from '../../../src/shards/nalati-grasslands/runtime/headless';
import { nalatiCreaturesOf } from '../../../src/shards/nalati-grasslands/runtime/headlessCreatures';
import { nalatiElitesOf } from '../../../src/shards/nalati-grasslands/runtime/headlessElites';
import { nalatiGroupsOf } from '../../../src/shards/nalati-grasslands/runtime/groups';

let rapier: Rapier, plan: HeadlessRuntimePlan;
const assets = new Map([NALATI_TERRAIN_ASSET, NALATI_NAVMESH_ASSET].map(path => [path, new Uint8Array(readFileSync(path))] as const));
const effects = { commands: () => [], emit: (): never => { throw new Error('elite rules must not invent a reward'); } };
beforeAll(async () => { rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); plan = await prepareHeadlessRuntime({ shard: source, assets, rapier }); });
function boot(saved?: SimSnapshot): SimHost {
  const ports = { ...plan.ports, rapier };
  if (saved === undefined) { const host = createSimHost(plan.level, ports); plan.install(host, { restoring: false, ...effects }); return host; }
  return restoreSimHost(plan.level, ports, saved, host => { if (ports.heightAt !== undefined) host.setHeightQuery(ports.heightAt); plan.install(host, { restoring: true, snapshot: saved, ...effects }); });
}
function parts(host: SimHost) {
  const elites = nalatiElitesOf(host), creatures = nalatiCreaturesOf(host), groups = nalatiGroupsOf(host);
  if (elites === undefined || creatures === undefined || groups === undefined) throw new Error('missing native elite controllers');
  const aq = elites.core.entry('aqbars'), arg = elites.core.entry('argymaq');
  if (aq?.script.animal === null || aq === undefined || arg?.script.animal === null || arg === undefined) throw new Error('missing boot elite actors');
  return { ...elites, creatures, groups, aq, arg, leopard: aq.script.animal, horse: arg.script.animal };
}
function feet(host: SimHost, x: number, z: number): void {
  const height = plan.ports?.heightAt; if (height === undefined) throw new Error('missing actual terrain');
  host.player.position.set(x, height(x, z) + 0.1, z); host.player.motor.resetAt(host.player.position);
}

it('adopts both real boot actors without a draw, pins before thinking, and restores the phase-two beat and keeper suffix', () => {
  const first = boot(); let restored: SimHost | undefined;
  try {
    const { aq, arg, leopard, horse, groups, aqbars } = parts(first), basis = first.physics.snapshot();
    expect([...first.entities.keys()]).toEqual(nalatiBake().actors.map(a => a.id));
    expect([leopard.entityId, horse.entityId]).toEqual(['creature:25', 'creature:35']);
    expect(horse).toBe(groups.herds[1]?.stallion); expect(aq.state).toBe('idle'); expect(arg.state).toBe('idle');
    expect(leopard.mem['low']).toBe(0.3);
    expect(parts(first).creatures.rng.snapshot()).toEqual({ version: 1, state: 481243377, initial: 19001, scrambledFork: false });
    feet(first, leopard.position.x + 10, leopard.position.z); first.step();
    expect(aq.state).toBe('engaged'); expect(aqbars.state).toBe('stalk');
    expect(first.bodyBandState()?.rows.find(r => r.id === leopard.entityId)?.rate).toBe('always');
    expect(leopard.motor).not.toBeNull(); expect(first.physics.world.colliders.len()).toBeGreaterThan(2694);
    leopard.hp = leopard.maxHp * 0.45; first.step();
    expect(aq.phase2).toBe(true); expect(aq.beatT).toBeCloseTo(1 - 1 / 60, 12);
    leopard.hp = 1; first.step(); expect(leopard.hp).toBe(aq.lockHp);
    const saved = snapshotSimHost(first);
    // One JSON checkpoint against the immutable admitted native basis; no full-world compression search.
    restored = boot(decodeSimSnapshot(serializeSimSnapshot(saved, basis), basis));
    expectSameSimSnapshot(snapshotSimHost(restored), saved);
    for (let i = 0; i < 30; i++) { first.step(); restored.step(); }
    expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(first));
    const def = aq.script.def;
    feet(first, def.lair.x + def.leashR + 10, def.lair.z); first.step();
    expect(aq.state).toBe('leash'); expect(aq.phase2).toBe(false); expect(aqbars.state).toBe('home');
    expect(first.bodyBandState()?.rows.find(r => r.id === leopard.entityId)?.rate).toBe('ai');
  } finally { restored?.dispose(); first.dispose(); expect(Object.values(first.scope.census).every(n => n === 0)).toBe(true); if (restored !== undefined) expect(Object.values(restored.scope.census).every(n => n === 0)).toBe(true); }
}, 60_000);

it('keeps the real respawn delay and interleaved raid/elite identities across native restore without replaying rolls', () => {
  const first = boot(); let restored: SimHost | undefined;
  try {
    const { aq, leopard, creatures, core } = parts(first);
    expect(leopard.applyDamage(100_000, leopard.position.clone(), new Vector3())).toBe(true);
    first.step(); expect(aq.state).toBe('dead'); expect(aq.timer).toBe(20 * 60); expect(core.record('aqbars')?.kills).toBe(1);
    first.step(); expect(aq.timer).toBeCloseTo(20 * 60 - 1 / 60, 9); expect(first.entities.size).toBe(35);
    expect(creatures.raid.start(true)).toBe(true); // ids 36..38, before the next elite
    // Take only the actual timer's final frame, rather than running twenty minutes in a unit test.
    aq.timer = 1 / 60; first.step();
    const next = aq.script.animal; if (next === null) throw new Error('no actual respawn');
    expect(next.entityId).toBe('creature:39'); expect(next.kind).toBe('leopard'); expect(next.variant).toBe('aqbars');
    expect(next).not.toBe(leopard); expect(first.entities.get(leopard.entityId)).toBe(leopard); expect(leopard.alive).toBe(false);
    expect(next.mem['low']).toBe(0.3); expect(next.seed).not.toBe(leopard.seed);
    const saved = snapshotSimHost(first); restored = boot(saved); expectSameSimSnapshot(snapshotSimHost(restored), saved);
    expect(parts(restored).aq.script.animal?.entityId).toBe('creature:39');
    for (let i = 0; i < 30; i++) { first.step(); restored.step(); }
    expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(first));
  } finally { restored?.dispose(); first.dispose(); expect(Object.values(first.scope.census).every(n => n === 0)).toBe(true); if (restored !== undefined) expect(Object.values(restored.scope.census).every(n => n === 0)).toBe(true); }
}, 60_000);

it('uses the actual Argymaq herd, phase-two lead-away clock and broken state, with no fake taming reward', () => {
  const host = boot();
  try {
    const { arg, horse, groups, argymaq } = parts(host), herd = groups.herds[1];
    if (herd === undefined) throw new Error('no actual Argymaq herd');
    feet(host, horse.position.x + 12, horse.position.z); host.step(); expect(arg.state).toBe('engaged');
    const lead = vi.spyOn(herd, 'leadAway'); horse.hp = horse.maxHp * 0.45; host.step();
    expect(arg.phase2).toBe(true); expect(lead).toHaveBeenCalledTimes(1); expect(argymaq.snapshot().runT).toBe(8);
    expect(argymaq.snapshot().lastState).toBe('watch'); expect(herd.stallionState).toBe('lead'); // EliteCore runs before this frame's herd decision.
    herd.stallionState = 'beaten'; host.step(); expect(arg.state).toBe('broken');
    expect(host.entities.get(horse.entityId)).toBe(horse); expect(arg.script.animal).toBe(horse);
    expect(host.entities.size).toBe(35); expect(parts(host).core.record('argymaq')?.kills).toBe(0);
  } finally { host.dispose(); }
});

it('wakes eligible targets on the accepted dodge before the cached second take, rejects cooldown presses, and restores the edge', () => {
  const first = boot(); let restored: SimHost | undefined;
  try {
    const { creatures } = parts(first), wolf = creatures.bodies.find(a => a.kind === 'wolf');
    if (wolf === undefined) throw new Error('no real wolf');
    // Isolate a real paused aggressive actor: the shipping interrupt visits it even with zero decision dt.
    creatures.bodies.forEach(a => { a.harnessHold = a !== wolf; }); wolf.aggressive = true;
    feet(first, wolf.position.x + 200, wolf.position.z + 200); first.step();
    const take = vi.spyOn(first, 'brainDt');
    first.step({ moveX: 0, moveZ: 0, yaw: 0, dodge: true });
    expect(take.mock.calls).toEqual([[wolf.entityId, true], [wolf.entityId, false]]);
    expect(take.mock.results[0]?.value).toBe(0); expect(first.playerDodge.cd).toBeGreaterThan(0);
    take.mockClear(); first.step({ moveX: 0, moveZ: 0, yaw: 0, dodge: true });
    expect(take.mock.calls).toEqual([[wolf.entityId, false]]);
    const saved = snapshotSimHost(first); restored = boot(saved); expectSameSimSnapshot(snapshotSimHost(restored), saved);
    for (let i = 0; i < 60; i++) {
      const command = i === 50 ? { moveX: 0, moveZ: 0, yaw: 0, dodge: true as const } : undefined;
      first.step(command); restored.step(command);
    }
    expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(first));
    expect(take.mock.calls.filter(([, urgent]) => urgent === true)).toHaveLength(1);
    for (let i = 0; i < 50; i++) { first.step(); restored.step(); }
    feet(first, wolf.position.x + 10, wolf.position.z); feet(restored, wolf.position.x + 10, wolf.position.z);
    take.mockClear(); first.step({ moveX: 0, moveZ: 0, yaw: 0, dodge: true }); restored.step({ moveX: 0, moveZ: 0, yaw: 0, dodge: true });
    expect(take.mock.calls).toEqual([[wolf.entityId, true], [wolf.entityId, false]]);
    expect(take.mock.results[0]?.value).toBeGreaterThan(0); expect(take.mock.results[1]?.value).toBe(0); // the wake consumed this frame's step
    expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(first));
  } finally { restored?.dispose(); first.dispose(); expect(Object.values(first.scope.census).every(n => n === 0)).toBe(true); if (restored !== undefined) expect(Object.values(restored.scope.census).every(n => n === 0)).toBe(true); }
}, 60_000);

it('retires a real boot actor, reinstalls the bounded saved roster, and refuses forged elite identities before restoring controllers', () => {
  const first = boot(); let restored: SimHost | undefined;
  try {
    const { aq, leopard, creatures } = parts(first);
    feet(first, leopard.position.x + 10, leopard.position.z); first.step(); expect(leopard.motor).not.toBeNull();
    aq.script.despawn(); first.step(); expect(aq.state).toBe('absent'); expect(aq.script.animal).toBeNull();
    expect(first.entities.has(leopard.entityId)).toBe(false); expect(creatures.bodies.some(a => a === leopard)).toBe(false);
    const saved = snapshotSimHost(first); restored = boot(saved); expectSameSimSnapshot(snapshotSimHost(restored), saved);
    first.step(); restored.step();
    expect(parts(first).aq.script.animal?.entityId).toBe('creature:36');
    expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(first));
    const invalid = snapshotSimHost(first);
    invalid.adapters = invalid.adapters.map(entry => {
      if (entry.id !== 'nalati.elites') return entry;
      const root = entry.state;
      if (root === null || typeof root !== 'object' || Array.isArray(root)) throw new Error('invalid elite fixture root');
      const script = root['aqbars'];
      if (script === null || typeof script !== 'object' || Array.isArray(script)) throw new Error('invalid elite fixture script');
      return { ...entry, state: { ...root, aqbars: { ...script, animal: 'creature:0' } } };
    });
    expect(() => boot(invalid)).toThrow('Incompatible Nalati elite body creature:0');
  } finally { restored?.dispose(); first.dispose(); expect(Object.values(first.scope.census).every(n => n === 0)).toBe(true); if (restored !== undefined) expect(Object.values(restored.scope.census).every(n => n === 0)).toBe(true); }
}, 60_000);
