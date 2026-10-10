// oxlint-disable-next-line import/no-nodejs-modules -- The actual native world and renderer-free admission bytes.
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createSimHost, type SimCommand, type SimHost } from '../../../src/engine/sim';
import { snapshotSimHost, restoreSimHost, serializeSimSnapshot, type SimSnapshot } from '../../../src/engine/sim/snapshot';
import { loadRapier, type Rapier } from '../../../src/engine/physics/rapier';
import { HeadlessSimulation } from '../../../src/sdk/headless';
import { canonicalSimDigest } from '../../fake/simState';
import type { HeadlessCommand } from '../../../src/sdk/tickProtocol';
import type { HeadlessRuntimePlan } from '../../../src/sdk/headlessRuntime';
import { prepareHeadlessRuntime, NALATI_TERRAIN_ASSET, NALATI_NAVMESH_ASSET } from '../../../src/shards/nalati-grasslands/runtime/headless';
import { nalatiCreaturesOf } from '../../../src/shards/nalati-grasslands/runtime/headlessCreatures';
import { nalatiMountedOf } from '../../../src/shards/nalati-grasslands/runtime/headlessMounted';
import { nalatiTamingOf } from '../../../src/shards/nalati-grasslands/runtime/headlessTaming';
import { nalatiGroupsOf } from '../../../src/shards/nalati-grasslands/runtime/groups';
import { nalatiBake } from '../../../src/shards/nalati-grasslands/runtime/baked';
import { nalatiTulparSpec } from '../../../src/shards/nalati-grasslands/runtime/headlessHorse';
import { spawnRolls } from '../../../src/engine/ai/hunt';
import { nalatiSpawnSpecies } from '../../../src/shards/nalati-grasslands/runtime/bootRoster';
import { Rng } from '../../../src/engine/core/rng';
import { expectSameSimSnapshot } from '../../fake/simSnapshot';
import source from '../../../src/shards/nalati-grasslands/shard.config';

let rapier: Rapier, plan: HeadlessRuntimePlan;
let bondedHost: SimHost | null = null;
let buckingCheckpoint: SimSnapshot | undefined;
const workerTape: { commands: HeadlessCommand[]; digest: string }[] = [];
afterAll(() => { bondedHost?.dispose(); });
let commands: readonly HeadlessCommand[] = [];
const effects = { commands: () => commands, emit: () => { throw new Error('Taming does not invent quest facts'); } };
beforeAll(async () => {
  rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
  const assets = new Map([NALATI_TERRAIN_ASSET, NALATI_NAVMESH_ASSET].map(path => [path, new Uint8Array(readFileSync(path))] as const));
  plan = await prepareHeadlessRuntime({ shard: source, assets, rapier });
});
function manager(host: SimHost) { const value = nalatiCreaturesOf(host); if (value === undefined) throw new Error('Missing actual manager'); return value; }
function ride(host: SimHost) { const value = nalatiMountedOf(host); if (value === undefined) throw new Error('Missing actual mounted owner'); return value; }
function taming(host: SimHost) { const value = nalatiTamingOf(host); if (value === undefined) throw new Error('Missing actual taming'); return value; }
function groups(host: SimHost) { const value = nalatiGroupsOf(host); if (value === undefined) throw new Error('Missing actual herds'); return value; }
function boot(): SimHost { const host = createSimHost(plan.level, { ...plan.ports, rapier }); plan.install(host, { restoring: false, ...effects }); return host; }

it('rolls the real Tulpar then adopts, places and finally scales Argymaq with strict retirement ownership', () => {
  commands = []; const host = boot();
  try {
    const m = manager(host), rng = new Rng(0); rng.restore(m.rng.snapshot());
    const rolled = spawnRolls(rng, 'horse', 'tulpar', m.bodies.some(a => a.kind === 'horse' && a.rarity === 'legendary'), nalatiSpawnSpecies());
    const spot = source.spawn, a = m.spawnBondedHorse(spot.x + 4, spot.z + 4, 0.4, true);
    expect(a.seed).toBe(rolled.seed); expect(a.variant).toBe('tulpar'); expect(a.scale).toBe(1.3);
    expect(a.dims).toEqual(nalatiTulparSpec().dims); expect(a.position.y).toBe(plan.ports?.heightAt?.(a.position.x, a.position.z));
    // Hunt.adopt consumes exactly the page's three memory draws after the saved adoption edge.
    rng.next(); rng.next(); rng.next(); expect(m.rng.snapshot()).toEqual(rng.snapshot());
    ride(host).addMountable(a); expect(a.mem['owned']).toBe(1); expect(ride(host).mount(a.entityId)).toBe(true);
    for (let i = 0; i < 20; i++) host.step({ moveX: 0, moveZ: 0, yaw: 0.4, commandVersion: 1, steer: { keyX: 0, keyY: 0, stickX: 0, stickY: 0 } });
    expect(() => m.retireBondedHorse(m.bodies[0] ?? a)).toThrow();
    ride(host).dismount(); ride(host).removeMountable(a); m.retireBondedHorse(a);
    expect(a.alive).toBe(false); expect(host.entities.has(a.entityId)).toBe(false); expect(a.motor).toBeNull();
    expect(() => m.retireBondedHorse(a)).toThrow();
  } finally { host.dispose(); }
});

it('approaches a real living stallion, earns the live prompt, rides all five bucking rounds and retains the original hidden living identity', () => {
  const row = nalatiBake().actors.find(a => a.kind === 'horse' && a.variant === 'stallion');
  if (row === undefined) throw new Error('Missing real wild stallion');
  // One fixture spawn is placed near the real boot actor; no later player/horse position writes or trust grants.
  const spawn = nalatiBake().spawns.find(a => a.id === row.id); if (spawn === undefined) throw new Error('Missing stallion spawn');
  const x = spawn.at[0], z = spawn.at[2];
  const level = { ...plan.level, player: { ...plan.level.player, at: { x: x + 2, y: (plan.ports?.heightAt?.(x + 2, z) ?? 0) + 0.1, z }, yaw: 0 } };
  const host = createSimHost(level, { ...plan.ports, rapier });
  let restored: SimHost | null = null;
  commands = []; plan.install(host, { restoring: false, ...effects });
  try {
    const law = taming(host), original = host.entities.get(row.id); if (original === undefined) throw new Error('Missing owned stallion');
    let lastBalance = 0, sawPrompt = false, breakingTicks = 0;
    for (let tick = 0; tick < 10000 && law.phase !== 'bonded'; tick++) {
      let moveX = 0, moveZ = 0;
      if (law.phase !== 'breaking') {
        const dx = original.position.x - host.player.position.x, dz = original.position.z - host.player.position.z, length = Math.hypot(dx, dz);
        if (length > 2.2) { moveX = dx / length; moveZ = dz / length; }
      } else breakingTicks++;
      const balance = law.view.balance, lean = Math.max(-1, Math.min(1, balance * 12 + (balance - lastBalance) * 60 * 3)); lastBalance = balance;
      sawPrompt ||= law.interactable.radius > 0;
      commands = [{ kind: 'script', actorId: 'nalati.taming.offer', value: 1 }, { kind: 'script', actorId: 'nalati.taming.lean', value: lean },
        ...(law.interactable.radius > 0 ? [{ kind: 'script' as const, actorId: 'nalati.taming.mount', value: 1 }] : [])];
      const c: SimCommand = { moveX, moveZ, yaw: 0, crouch: true, commandVersion: 1, steer: { keyX: moveX, keyY: -moveZ, stickX: 0, stickY: 0 } };
      host.step(c); restored?.step(c);
      if (buckingCheckpoint !== undefined && workerTape.length < 3) workerTape.push({ commands: [{ kind: 'player', ...c }, ...commands], digest: canonicalSimDigest(snapshotSimHost(host)) });
      if (restored === null && law.phase === 'breaking' && breakingTicks === 250) {
        const saved = snapshotSimHost(host); buckingCheckpoint = saved;
        restored = restoreSimHost(level, { ...plan.ports, rapier }, saved, resident => { plan.install(resident, { restoring: true, snapshot: saved, ...effects }); });
        expectSameSimSnapshot(snapshotSimHost(restored), saved);
      }
    }
    expect(sawPrompt).toBe(true); expect(breakingTicks).toBeGreaterThanOrEqual(5 * 3.5 * 60);
    expect(law.phase).toBe('bonded'); expect(law.tulpar?.variant).toBe('tulpar'); expect(ride(host).horse).toBe(law.tulpar);
    expect(original.alive).toBe(true); expect(host.entities.get(original.entityId)).toBe(original);
    expect(original.position.y).toBe(-1e4); expect(original.motor).toBeNull();
    expect(groups(host).herds[0]?.stallion).toBeNull();
    if (restored === null) throw new Error('Missing mid-round continuation proof');
    expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(host));
    bondedHost = host;
  } finally { commands = []; restored?.dispose(); if (bondedHost !== host) host.dispose(); }
}, 60000);


it('reinstalls the actually bonded horse before mounted and taming restore, without rerolling or resurrecting its hidden stallion', () => {
  const first = bondedHost; if (first === null) throw new Error('The real five-round journey must have completed');
  const saved = snapshotSimHost(first);
  const restored = restoreSimHost(first.level, { ...plan.ports, rapier }, saved, resident => { plan.install(resident, { restoring: true, snapshot: saved, ...effects }); });
  try {
    expectSameSimSnapshot(snapshotSimHost(restored), saved);
    expect(taming(restored).tulpar?.entityId).toBe(taming(first).tulpar?.entityId);
    expect(ride(restored).horse).toBe(taming(restored).tulpar);
    expect(manager(restored).rng.snapshot()).toEqual(manager(first).rng.snapshot());
    commands = [];
    for (let tick = 0; tick < 60; tick++) {
      const c: SimCommand = { moveX: 0, moveZ: 0, yaw: first.player.yaw, commandVersion: 1,
        steer: { keyX: 0, keyY: -1, stickX: 0, stickY: 0 } };
      first.step(c); restored.step(c);
    }
    expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(first));
  } finally { commands = []; restored.dispose(); }
}, 60000);


it('refuses foreign, duplicate and oversized bonded continuations before a mounted owner can bind them', () => {
  const first = bondedHost; if (first === null) throw new Error('The actual bond must exist');
  const saved = snapshotSimHost(first);
  for (const change of ['foreign-id', 'duplicate', 'wrong-recipe'] as const) {
    const malformed = structuredClone(saved), row = malformed.adapters.find(a => a.id === 'nalati.creatures');
    if (row?.state === undefined || row.state === null || typeof row.state !== 'object' || Array.isArray(row.state)) throw new Error('Missing actual manager continuation');
    const bonded = row.state['bonded'];
    if (!Array.isArray(bonded) || bonded.length !== 1) throw new Error('Missing actual bonded metadata');
    const item = bonded[0];
    if (item === null || typeof item !== 'object' || Array.isArray(item)) throw new Error('Missing actual bond row');
    const body = item['body'];
    if (body === null || typeof body !== 'object' || Array.isArray(body)) throw new Error('Missing actual adopted body');
    if (change === 'foreign-id') body['id'] = 'foreign:1';
    else if (change === 'wrong-recipe') body['variant'] = 'stallion';
    else bonded.push(structuredClone(item));
    expect(() => restoreSimHost(first.level, { ...plan.ports, rapier }, malformed, resident => {
      plan.install(resident, { restoring: true, snapshot: malformed, ...effects });
    })).toThrow();
  }
});


it('connects real scoped creature signals to once-per-herd trust, and distant weapon impacts to the shipping distrust filter', () => {
  commands = []; const host = boot();
  try {
    const h = groups(host).herds[0], stallion = h?.stallion;
    if (h === undefined || stallion === undefined || stallion === null) throw new Error('Missing actual wild herd');
    // A fixture observation at the herd is only for event-port admission, not the journey proof above.
    host.player.position.copy(stallion.position);
    const before = h.trust;
    host.events.emit('creature.signal', { name: 'pack-break', x: h.cx, z: h.cz }); host.events.flush('fixed.post');
    expect(h.trust).toBe(Math.min(100, before + 30));
    host.events.emit('creature.signal', { name: 'pack-driven-off', x: h.cx, z: h.cz }); host.events.flush('fixed.post');
    expect(h.trust).toBe(Math.min(100, before + 30));
    host.events.emit('weapon.impact', { id: 'weapon.bow', surface: 'ground', point: host.player.position.clone() }); host.events.flush('fixed.post');
    expect(h.trust).toBe(Math.min(100, before + 30));
    const landing = host.player.position.clone(); landing.x += 6;
    host.events.emit('weapon.impact', { id: 'weapon.bow', surface: 'ground', point: landing }); host.events.flush('fixed.post');
    expect(h.trust).toBe(Math.max(0, Math.min(100, before + 30) - 30)); expect(h.alert).toBe(100);
  } finally { host.dispose(); }
});


it('resumes the real mid-buck checkpoint in the shipping worker across all native body cadences', async () => {
  const first = bondedHost, saved = buckingCheckpoint;
  if (first === null || saved === undefined || workerTape.length !== 3) throw new Error('Missing actual mid-round checkpoint and command suffix');
  const at = first.level.player.at;
  const fixture = { ...source, spawn: { x: at.x, y: at.y, z: at.z, yaw: 0 } };
  // The explicit transport adapter supplies unchanged native terrain/navmesh bytes; it replaces no gameplay owner.
  const worker = await HeadlessSimulation.create(fixture, new Map(), serializeSimSnapshot(saved), {
    deadline: 'advisory', trustedRuntime: { module: new URL('../../proof/nalati-grasslands/worker.ts', import.meta.url).href },
  });
  try {
    for (const row of workerTape) {
      const commit = await worker.step([{ source: 'witness.taming', commands: row.commands }]);
      expect(commit.effects).toEqual([]); expect(canonicalSimDigest(commit.snapshot)).toBe(row.digest);
    }
  } finally { await worker.dispose(); }
}, 60000);
