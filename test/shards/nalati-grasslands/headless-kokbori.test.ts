// oxlint-disable-next-line import/no-nodejs-modules -- The actual dusk elite uses committed native terrain/navigation and real WASM.
import { readFileSync } from 'node:fs';
import { Vector3 } from 'three';
import { beforeAll, expect, it } from 'vitest';
import { createSimHost, type SimHost } from '../../../src/engine/sim';
import { snapshotSimHost, restoreSimHost, serializeSimSnapshot, decodeSimSnapshot, type SimSnapshot } from '../../../src/engine/sim/snapshot';
import { loadRapier, type Rapier } from '../../../src/engine/physics/rapier';
import type { HeadlessRuntimePlan } from '../../../src/sdk/headlessRuntime';
import { expectSameSimSnapshot } from '../../fake/simSnapshot';
import source from '../../../src/shards/nalati-grasslands/shard.config';
import { NALATI_ELITE_DEFS } from '../../../src/shards/nalati-grasslands/combat/eliteRoster';
import { NALATI_TERRAIN_ASSET, NALATI_NAVMESH_ASSET, prepareHeadlessRuntime } from '../../../src/shards/nalati-grasslands/runtime/headless';
import { nalatiCreaturesOf } from '../../../src/shards/nalati-grasslands/runtime/headlessCreatures';
import { nalatiElitesOf } from '../../../src/shards/nalati-grasslands/runtime/headlessElites';
import { nalatiGroupsOf } from '../../../src/shards/nalati-grasslands/runtime/groups';

let rapier: Rapier, plan: HeadlessRuntimePlan;
const assets = new Map([NALATI_TERRAIN_ASSET, NALATI_NAVMESH_ASSET].map(path => [path, new Uint8Array(readFileSync(path))] as const));
const effects = { commands: () => [], emit: (): never => { throw new Error('dusk elite must not invent a reward'); } };
beforeAll(async () => { rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); plan = await prepareHeadlessRuntime({ shard: source, assets, rapier }); });
function boot(saved?: SimSnapshot): SimHost {
  const ports = { ...plan.ports, rapier };
  if (saved === undefined) { const host = createSimHost(plan.level, ports); plan.install(host, { restoring: false, ...effects }); return host; }
  return restoreSimHost(plan.level, ports, saved, host => { if (ports.heightAt !== undefined) host.setHeightQuery(ports.heightAt); plan.install(host, { restoring: true, snapshot: saved, ...effects }); });
}
function parts(host: SimHost) {
  const elites = nalatiElitesOf(host), creatures = nalatiCreaturesOf(host), groups = nalatiGroupsOf(host);
  if (elites === undefined || creatures === undefined || groups === undefined) throw new Error('missing real dusk controllers');
  const entry = elites.core.entry('kokbori'); if (entry === undefined) throw new Error('missing dusk entry');
  return { ...elites, creatures, groups, entry };
}
async function phase(host: SimHost, name: 'day' | 'dusk'): Promise<void> {
  const clock = host.dayClock; if (clock === undefined) throw new Error('missing actual day clock');
  clock.paused = true; await clock.set(name);
}
function player(host: SimHost, distance: number): void {
  const def = NALATI_ELITE_DEFS['kokbori'], height = plan.ports?.heightAt;
  if (def === undefined || height === undefined) throw new Error('missing authored dusk lair');
  const x = def.lair.x + distance, z = def.lair.z;
  host.player.position.set(x, height(x, z) + 0.1, z); host.player.motor.resetAt(host.player.position);
}

it('admits on the real dusk edge, retires at day, and restores dormant pack identities before a fresh ordered respawn', async () => {
  const first = boot(); let restored: SimHost | undefined;
  try {
    const { entry, creatures, groups } = parts(first);
    expect(entry.state).toBe('absent'); expect(first.entities.size).toBe(35);
    player(first, 150); await phase(first, 'dusk'); first.step();
    const body = entry.script.animal, pack = groups.packs[1];
    if (body === null || pack === undefined) throw new Error('no actual dusk spawn');
    expect([body.entityId, body.kind, body.variant, body.maxHp, body.scale]).toEqual(['creature:36', 'kokbori', 'kokbori', 650, 2.6]);
    expect(pack.members.map(a => a.entityId)).toEqual(['creature:37', 'creature:38', 'creature:39', 'creature:40', 'creature:41']);
    expect(pack.members.map(a => a.variant)).toEqual(['grey', 'tawny', 'grey', 'dark', 'scout']);
    expect([pack.homeX, pack.homeZ]).toEqual([entry.script.def.lair.x, entry.script.def.lair.z]);
    expect(pack.findPrey).toBeTypeOf('function'); expect(entry.state).toBe('idle');
    await phase(first, 'day'); first.step();
    expect(entry.state).toBe('absent'); expect(first.entities.has(body.entityId)).toBe(false);
    pack.members.forEach(a => { expect([a.alive, a.position.y, a.motor]).toEqual([false, -9999, null]); expect(creatures.bodies).not.toContain(a); });
    const saved = snapshotSimHost(first); restored = boot(saved); expectSameSimSnapshot(snapshotSimHost(restored), saved);
    expect(creatures.raid.start(true)).toBe(true); expect(parts(restored).creatures.raid.start(true)).toBe(true);
    await phase(first, 'dusk'); await phase(restored, 'dusk'); first.step(); restored.step();
    expect(entry.script.animal?.entityId).toBe('creature:45');
    expect(parts(restored).entry.script.animal?.entityId).toBe('creature:45');
    for (let i = 0; i < 120; i++) { first.step(); restored.step(); }
    expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(first));
  } finally { restored?.dispose(); first.dispose(); expect(Object.values(first.scope.census).every(n => n === 0)).toBe(true); }
});

it('steps the actual shared-stream howl and phase-two pack command with exact native/JSON restored suffixes', async () => {
  const first = boot(); let restored: SimHost | undefined;
  try {
    const basis = first.physics.snapshot(); player(first, 30); await phase(first, 'dusk'); first.step();
    const { entry, kokbori, groups } = parts(first), body = entry.script.animal;
    if (body === null) throw new Error('no actual nearby dusk body');
    expect(entry.state).toBe('engaged'); expect(body.motor).not.toBeNull();
    for (let i = 0; i < 180; i++) first.step();
    expect(kokbori.snapshot().st).toBe('howl'); expect(kokbori.snapshot().howlHit).toBe(-Infinity);
    const saved = snapshotSimHost(first); restored = boot(decodeSimSnapshot(serializeSimSnapshot(saved, basis), basis));
    expectSameSimSnapshot(snapshotSimHost(restored), saved);
    for (let i = 0; i < 90; i++) { first.step(); restored.step(); }
    expect(kokbori.snapshot().st).toBe('hold');
    expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(first));
    const other = parts(restored).entry.script.animal; if (other === null) throw new Error('lost restored dusk body');
    body.hp = body.maxHp * 0.45; other.hp = other.maxHp * 0.45; first.step(); restored.step();
    expect(entry.phase2).toBe(true); expect(kokbori.snapshot().st).toBe('hunt'); expect(groups.packs[1]?.phase).toBe('regroup');
    for (let i = 0; i < 60; i++) { first.step(); restored.step(); }
    expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(first));
  } finally { restored?.dispose(); first.dispose(); expect(Object.values(first.scope.census).every(n => n === 0)).toBe(true); }
});

it('keeps the twenty-minute death timer and waits for the next dusk before respawning without replaying the old pack', async () => {
  const first = boot(); let restored: SimHost | undefined;
  try {
    player(first, 150); await phase(first, 'dusk'); first.step();
    const { entry, groups } = parts(first), body = entry.script.animal;
    if (body === null) throw new Error('no dusk actor');
    expect(body.applyDamage(100_000, body.position.clone(), new Vector3())).toBe(true); first.step();
    expect(entry.state).toBe('dead'); expect(entry.timer).toBe(20 * 60);
    entry.timer = 1 / 60; first.step(); expect(entry.waitDusk).toBe(true); expect(entry.script.animal).toBe(body);
    const saved = snapshotSimHost(first); restored = boot(saved); expectSameSimSnapshot(snapshotSimHost(restored), saved);
    await phase(first, 'day'); await phase(restored, 'day'); first.step(); restored.step();
    expect(entry.script.animal).toBe(body);
    await phase(first, 'dusk'); await phase(restored, 'dusk'); first.step(); restored.step();
    expect(entry.script.animal?.entityId).toBe('creature:42'); expect(groups.packs).toHaveLength(3);
    expect(first.entities.get(body.entityId)).toBe(body); expect(body.alive).toBe(false);
    for (let i = 0; i < 60; i++) { first.step(); restored.step(); }
    expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(first));
  } finally { restored?.dispose(); first.dispose(); expect(Object.values(first.scope.census).every(n => n === 0)).toBe(true); }
});
