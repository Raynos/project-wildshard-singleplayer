// oxlint-disable-next-line import/no-nodejs-modules -- The actual native roster uses committed terrain/navigation and real WASM.
import { readFileSync } from 'node:fs';
import { Vector3 } from 'three';
import { beforeAll, expect, it } from 'vitest';
import { createSimHost, type SimHost } from '../../../src/engine/sim';
import { snapshotSimHost, restoreSimHost, type SimSnapshot } from '../../../src/engine/sim/snapshot';
import { CharacterMotor } from '../../../src/engine/physics/CharacterMotor';
import { loadRapier, type Rapier } from '../../../src/engine/physics/rapier';
import type { HeadlessRuntimePlan } from '../../../src/sdk/headlessRuntime';
import { expectSameSimSnapshot } from '../../fake/simSnapshot';
import source from '../../../src/shards/nalati-grasslands/shard.config';
import { NALATI_ELITE_DEFS } from '../../../src/shards/nalati-grasslands/combat/eliteRoster';
import { NALATI_TERRAIN_ASSET, NALATI_NAVMESH_ASSET, prepareHeadlessRuntime } from '../../../src/shards/nalati-grasslands/runtime/headless';
import { nalatiCreaturesOf, NALATI_CREATURES_STEP } from '../../../src/shards/nalati-grasslands/runtime/headlessCreatures';
import { nalatiGroupsOf } from '../../../src/shards/nalati-grasslands/runtime/groups';

let rapier: Rapier, plan: HeadlessRuntimePlan;
const assets = new Map([NALATI_TERRAIN_ASSET, NALATI_NAVMESH_ASSET].map(path => [path, new Uint8Array(readFileSync(path))] as const));
const effects = { commands: () => [], emit: (): never => { throw new Error('pack admission must not emit rewards'); } };
const variants = ['grey', 'tawny', 'grey', 'dark', 'scout'];
beforeAll(async () => { rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); plan = await prepareHeadlessRuntime({ shard: source, assets, rapier }); });
function boot(saved?: SimSnapshot): SimHost {
  const ports = { ...plan.ports, rapier };
  if (saved === undefined) { const host = createSimHost(plan.level, ports); plan.install(host, { restoring: false, ...effects }); return host; }
  return restoreSimHost(plan.level, ports, saved, host => { if (ports.heightAt !== undefined) host.setHeightQuery(ports.heightAt); plan.install(host, { restoring: true, snapshot: saved, ...effects }); });
}
function parts(host: SimHost) {
  const creatures = nalatiCreaturesOf(host), groups = nalatiGroupsOf(host);
  if (creatures === undefined || groups === undefined) throw new Error('missing real pack controllers');
  return { creatures, groups };
}
function lair(host: SimHost): { x: number; z: number } {
  const def = NALATI_ELITE_DEFS['kokbori'], height = plan.ports?.heightAt;
  if (def === undefined || height === undefined) throw new Error('missing authored dusk lair');
  const x = def.lair.x - 6, z = def.lair.z + 4;
  host.player.position.set(x, height(x, z) + 0.1, z); host.player.motor.resetAt(host.player.position);
  return { x, z };
}

it('keeps killed pack members as corpses and retires living members to exact dormant host identities with no native bodies', () => {
  const first = boot(); let restored: SimHost | undefined;
  try {
    const { creatures, groups } = parts(first), { x, z } = lair(first);
    const pack = creatures.spawnElitePack(x, z, variants), members = [...pack.members], corpse = members[0];
    if (corpse === undefined) throw new Error('missing real pack alpha');
    expect(members.map(a => a.variant)).toEqual(variants);
    expect(members.map(a => a.entityId)).toEqual(['creature:36', 'creature:37', 'creature:38', 'creature:39', 'creature:40']);
    const handles = members.slice(1).map(a => { if (!(a.motor instanceof CharacterMotor)) throw new Error('nearby pack lacks a native motor'); return a.motor.collider.handle; });
    expect(corpse.applyDamage(100_000, corpse.position.clone(), new Vector3())).toBe(true);
    first.step(); creatures.retirePack(pack);
    expect(pack.members).toEqual(members); expect(creatures.bodies).toContain(corpse); expect(Reflect.get(corpse, 'hidden')).toBe(false);
    members.slice(1).forEach((a, i) => {
      expect(first.entities.get(a.entityId)).toBe(a); expect(creatures.bodies).not.toContain(a);
      expect([a.alive, Reflect.get(a, 'hidden'), a.position.y, a.motor]).toEqual([false, true, -9999, null]);
      expect(first.physics.world.getCollider(handles[i] ?? -1)).toBeNull();
      expect(first.bodyDt(a.entityId)).toBe(0); expect(first.brainDt(a.entityId)).toBe(0);
    });
    const saved = snapshotSimHost(first); restored = boot(saved); expectSameSimSnapshot(snapshotSimHost(restored), saved);
    const old = parts(restored).groups.packs[1]; if (old === undefined) throw new Error('missing restored pack');
    expect(old.members.map(a => a.entityId)).toEqual(members.map(a => a.entityId));
    old.members.slice(1).forEach(a => { expect(Reflect.get(a, 'hidden')).toBe(true); expect(a.motor).toBeNull(); expect(restored?.bodyDt(a.entityId)).toBe(0); });
    for (let i = 0; i < 60; i++) { first.step(); restored.step(); }
    expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(first));
    members.slice(1).forEach(a => { expect([a.position.y, a.motor]).toEqual([-9999, null]); });
    expect(groups.packs).toHaveLength(2);
  } finally { restored?.dispose(); first.dispose(); expect(Object.values(first.scope.census).every(n => n === 0)).toBe(true); }
});

it('restores interleaved dusk-pack and raid identities then respawns fresh members with an exact native suffix', () => {
  const first = boot(); let restored: SimHost | undefined;
  try {
    const { creatures } = parts(first), { x, z } = lair(first);
    const old = creatures.spawnElitePack(x, z, variants);
    first.step(); creatures.retirePack(old);
    expect(creatures.raid.start(true)).toBe(true);
    const saved = snapshotSimHost(first); restored = boot(saved); expectSameSimSnapshot(snapshotSimHost(restored), saved);
    const next = creatures.spawnElitePack(x, z, variants), copy = parts(restored).creatures.spawnElitePack(x, z, variants);
    expect(next.members.map(a => a.entityId)).toEqual(['creature:44', 'creature:45', 'creature:46', 'creature:47', 'creature:48']);
    expect(copy.members.map(a => a.entityId)).toEqual(next.members.map(a => a.entityId));
    expect(next.members.some(a => old.members.includes(a))).toBe(false);
    expect(parts(first).groups.packs).toHaveLength(4);
    for (let i = 0; i < 120; i++) { first.step(); restored.step(); }
    expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(first));
    const invalid = snapshotSimHost(first);
    invalid.adapters = invalid.adapters.map(row => {
      if (row.id !== NALATI_CREATURES_STEP) return row;
      if (row.state === null || typeof row.state !== 'object' || Array.isArray(row.state)) throw new Error('invalid creature fixture');
      return { ...row, state: { ...row.state, dormant: ['creature:0'] } };
    });
    expect(() => boot(invalid)).toThrow('Invalid Nalati dormant pack identities');
    const liveDormant = snapshotSimHost(first), liveId = next.members[0]?.entityId;
    if (liveId === undefined) throw new Error('missing fresh pack member');
    liveDormant.adapters = liveDormant.adapters.map(row => {
      if (row.id !== NALATI_CREATURES_STEP) return row;
      if (row.state === null || typeof row.state !== 'object' || Array.isArray(row.state)) throw new Error('invalid creature fixture');
      return { ...row, state: { ...row.state, dormant: [liveId] } };
    });
    expect(() => boot(liveDormant)).toThrow('Invalid Nalati dormant body');
  } finally { restored?.dispose(); first.dispose(); expect(Object.values(first.scope.census).every(n => n === 0)).toBe(true); }
});
