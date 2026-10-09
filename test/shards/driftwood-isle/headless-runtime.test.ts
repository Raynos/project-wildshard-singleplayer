// oxlint-disable-next-line import/no-nodejs-modules -- The headless runtime reads the native physics module.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Import the trusted runtime in plain Node with the renderer-denying loader.
import { spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Use the current Node binary for the closure proof.
import { execPath } from 'node:process';
import { Vector3 } from 'three';
import { beforeAll, expect, it } from 'vitest';
import { createSimHost, type SimHost } from '../../../src/engine/sim';
import { decodeSimSnapshot, restoreSimHost, serializeSimSnapshot, snapshotSimHost } from '../../../src/engine/sim/snapshot';
import { loadRapier, type Rapier } from '../../../src/engine/physics/rapier';
import { Rng } from '../../../src/engine/core/rng';
import type { HeadlessRuntimePlan } from '../../../src/sdk/headlessRuntime';
import source from '../../../src/shards/driftwood-isle/shard.config';
import { DRIFTWOOD_ISLE, PRACTICE_CRAB } from '../../../src/shards/driftwood-isle/manifest';
import { MONKEY } from '../../../src/shards/driftwood-isle/species/monkey';
import { MONKEY_VARIANTS } from '../../../src/shards/driftwood-isle/species/monkeyVariants';
import { driftwoodBake } from '../../../src/shards/driftwood-isle/runtime/baked';
import { DRIFTWOOD_FIGHT, FAUNA_DRAWS, ISLAND_STEP } from '../../../src/shards/driftwood-isle/runtime/keeper';
import { LOWERED_SEA } from '../../../src/shards/driftwood-isle/world/sea';
import { prepareHeadlessRuntime } from '../../../src/shards/driftwood-isle/runtime/headless';

let rapier: Rapier, plan: HeadlessRuntimePlan;
beforeAll(async () => {
  rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
  plan = await prepareHeadlessRuntime({ shard: source, assets: new Map(), rapier });
});
const effects = { commands: () => [], emit: () => { throw new Error('the island keeper emits no gameplay effects'); } };
const boot = (): SimHost => { const host = createSimHost(plan.level, { ...plan.ports, rapier }); plan.install(host, { restoring: false, ...effects }); return host; };
const restore = (saved: string): SimHost => {
  const decoded = decodeSimSnapshot(saved), ports = { ...plan.ports, rapier };
  return restoreSimHost(plan.level, ports, decoded, fresh => { if (ports.heightAt !== undefined) fresh.setHeightQuery(ports.heightAt); plan.install(fresh, { restoring: true, snapshot: decoded, ...effects }); });
};
const bake = driftwoodBake();
/** The player's tape: off the pier landing up the path past the practice crab, then away north and back. */
const route = [new Vector3(-7, 0, -150), new Vector3(-7, 0, -120), new Vector3(-20, 0, -90), new Vector3(-7, 0, -100)];
function step(host: SimHost): void {
  const tick = host.state.tick, goal = route[Math.min(route.length - 1, Math.floor(tick / 900))] ?? new Vector3(), p = host.player.position;
  const dx = goal.x - p.x, dz = goal.z - p.z, d = Math.hypot(dx, dz);
  host.step(d < 1.5 ? { moveX: Math.sin(tick / 40), moveZ: Math.cos(tick / 40), yaw: 0 } : { moveX: dx / d, moveZ: dz / d, yaw: Math.atan2(dx, dz) });
}
function kill(host: SimHost, id: string): void {
  const actor = host.entities.get(id); if (actor === undefined) throw new Error(`missing ${id}`);
  host.combat.hit({ source: host.player.health, sourceTags: ['actor.player'], target: actor.combatActor(), amount: 10_000, point: actor.position.clone(), dir: new Vector3(0, 0, 1), moveId: 'test.kill' }); // a direct test blow: no sword is owned yet
}

it('holds the renderer-free spellings equal to the browser\'s (monkey variants, sea level, spawn)', () => {
  expect(MONKEY_VARIANTS).toBe(MONKEY.variants);
  expect(LOWERED_SEA).toBe(DRIFTWOOD_ISLE.ground.terrain?.waterLevel());
  expect(DRIFTWOOD_FIGHT.attackers).toBe(DRIFTWOOD_ISLE.fight?.attackers); expect(DRIFTWOOD_FIGHT.telegraphed).toBe(DRIFTWOOD_ISLE.fight?.telegraphed);
  expect(plan.level.seed).toBe(0x5ea1); expect(plan.level.player.at).toEqual({ x: 0, y: 1.2, z: -194 }); expect(plan.level.player.yaw).toBe(Math.PI);
  expect(plan.proveEntries).toBeUndefined(); // finish stays refused until the entry proof is real
});

it('spawns the 34 load-time bodies in the manager\'s order, reproducing every baked kind, variant, herd, seed, scale and point', () => {
  const host = boot();
  try {
    expect([...host.entities.keys()]).toEqual(bake.actors.map(actor => actor.id));
    for (const actor of bake.actors) {
      const live = host.entities.get(actor.id); if (live === undefined || actor.at === null) throw new Error(`missing ${actor.id}`);
      expect([actor.id, live.kind, live.variant, live.seed, live.scale]).toEqual([actor.id, actor.kind, actor.variant, actor.seed, actor.scale]);
      expect(live.position.x).toBeCloseTo(actor.at.x, 9); expect(live.position.z).toBeCloseTo(actor.at.z, 9);
    }
    // the fauna's baked seeds all come from the creature stream's first 148 draws (their anchor searches)
    const rng = new Rng(0x5ea1 + 31), head: number[] = []; for (let i = 0; i < FAUNA_DRAWS; i++) head.push(rng.next());
    for (const actor of bake.actors.filter(a => a.kind === 'boar' || a.kind === 'bear')) expect(head).toContain(actor.seed);
    // every body stands on the island above the sea, the sailor on the sunk hold's own floor (the wreck's deck, not the sand)
    for (const actor of host.entities.values()) if (actor.kind !== 'sailor') expect(actor.position.y).toBeGreaterThan(LOWERED_SEA);
    const sailor = [...host.entities.values()].find(a => a.kind === 'sailor');
    if (sailor === undefined) throw new Error('no sailor');
    // the hold's midships deck is broken open where he rises (Enemies.placeSailor): the creature floor is the sand under the hull
    expect(sailor.levelGround).toBe(false); expect(sailor.position.y).toBeCloseTo(bake.floorAt(sailor.position.x, sailor.position.z), 6);
  } finally { host.dispose(); }
});

it('stands the player on the baked floor and the pier: 10k ticks of walking stay finite and on the island', () => {
  const host = boot();
  try {
    for (let tick = 0; tick < 10_000; tick++) step(host);
    expect(host.state.tick).toBe(10_000);
    const p = host.player.position;
    expect(p.y).toBeGreaterThan(bake.floorAt(p.x, p.z) - 0.2); expect(Math.hypot(p.x, p.z + 194)).toBeGreaterThan(60); // off the pier, up the path
    expect([...host.entities.values()].every(a => [a.position.x, a.position.y, a.position.z].every(Number.isFinite))).toBe(true);
  } finally { host.dispose(); }
});

it('brings the practice crab back 45 s after it dies once the player is 30 m off, after its shell fades, as a fresh body', () => {
  const host = boot();
  try {
    const slot = bake.habitat.practice, before = host.entities.get(slot)?.seed;
    kill(host, slot);
    host.player.position.set(PRACTICE_CRAB.x, 2, PRACTICE_CRAB.z + 10); // near: it never comes back
    for (let tick = 0; tick < 60 * 50; tick++) host.step();
    expect(host.entities.get(slot)?.alive).toBe(false);
    host.player.motor.resetAt(new Vector3(-7, 3, -100)); host.player.position.set(-7, 3, -100);
    for (let tick = 0; tick < 60 * 2; tick++) host.step();
    const fresh = host.entities.get(slot);
    expect(fresh?.alive).toBe(true); expect(fresh?.kind).toBe('crab'); expect(fresh?.variant).toBe('small'); expect(fresh?.seed).not.toBe(before);
    expect(fresh?.position.x).toBeCloseTo(PRACTICE_CRAB.x, 1); expect(fresh?.position.z).toBeCloseTo(PRACTICE_CRAB.z, 1);
  } finally { host.dispose(); }
});

it('runs the enemies\' shipping policies: the crabs close in and snap, a strike lands on the player within the attack tokens', () => {
  const host = boot(), crab = host.entities.get('creature:13'), states = new Set<string>();
  if (crab === undefined) throw new Error('missing big crab');
  let lowest = host.player.health.attributes.health, attacking = 0;
  try {
    const at = new Vector3(crab.position.x + 4, bake.floorAt(crab.position.x + 4, crab.position.z) + 0.5, crab.position.z);
    host.player.motor.resetAt(at); host.player.position.copy(at);
    for (let tick = 0; tick < 1800; tick++) {
      host.step({ moveX: 0, moveZ: 0, yaw: 0 });
      for (const actor of host.entities.values()) if (actor.kind === 'crab') states.add(String(actor.mem['st']));
      attacking = Math.max(attacking, [...host.entities.values()].filter(a => a.alive && a.attackPhase >= 0).length);
      lowest = Math.min(lowest, host.player.health.attributes.health);
    }
    expect(states).toContain('1'); expect(states).toContain('2'); // engaged (sidestepping), then attacking
    expect(lowest).toBeLessThan(host.player.health.attributes.maxHealth);
    expect(attacking).toBeGreaterThan(0); expect(attacking).toBeLessThanOrEqual(2);
  } finally { host.dispose(); }
});

it('restores exactly at install, mid-walk and after a practice crab came back, reinstalling the saved roster before restore', () => {
  const checkpoint = (host: SimHost, at: number): void => {
    for (let tick = host.state.tick; tick < at; tick++) {
      if (tick === 100) kill(host, bake.habitat.practice);
      if (tick === 400) kill(host, 'creature:13');
      if (tick === 600) { const away = new Vector3(-7, bake.floorAt(-7, -100) + 0.5, -100); host.player.motor.resetAt(away); host.player.position.copy(away); }
      // off the path after the walk: the player waits 43 m from the practice crab's spot while it comes back
      if (tick < 600) step(host); else host.step({ moveX: 0, moveZ: 0, yaw: 0 });
    }
  };
  for (const at of [0, 1, 700, 3700]) {
    const original = boot(); let restored: SimHost | undefined;
    try {
      checkpoint(original, at);
      if (at === 3700) expect(original.entities.get(bake.habitat.practice)?.alive).toBe(true);
      restored = restore(serializeSimSnapshot(snapshotSimHost(original)));
      expect(snapshotSimHost(restored)).toEqual(snapshotSimHost(original));
      for (let tick = 0; tick < 900; tick++) {
        if (tick === 120) { kill(original, 'creature:22'); kill(restored, 'creature:22'); }
        step(original); step(restored);
      }
      expect(serializeSimSnapshot(snapshotSimHost(restored))).toBe(serializeSimSnapshot(snapshotSimHost(original)));
      expect(snapshotSimHost(original).adapters.some(adapter => adapter.id === ISLAND_STEP)).toBe(true);
    } finally { restored?.dispose(); original.dispose(); }
  }
}, 90_000);

it('refuses a saved roster whose recipe no longer matches the baked spec', () => {
  const host = boot();
  try {
    for (let tick = 0; tick < 60; tick++) step(host);
    const saved = snapshotSimHost(host);
    const actor = saved.adapters.find(adapter => adapter.id === 'runtime.actor.creature:33');
    if (actor === undefined || typeof actor.state !== 'string') throw new Error('missing saved sailor recipe');
    actor.state = actor.state.replace('"hp":60', '"hp":61');
    expect(() => restore(serializeSimSnapshot(saved))).toThrow('Incompatible dynamic simulation actor recipe');
  } finally { host.dispose(); }
});

it('imports the trusted headless runtime without DOM or renderer modules', () => {
  const result = spawnSync(execPath, ['--experimental-transform-types', '--disable-warning=ExperimentalWarning', '--import', './scripts/sim-node-loader.mjs', '--input-type=module', '-e',
    "const m = await import('./src/shards/driftwood-isle/runtime/headless.ts'); if (typeof m.prepareHeadlessRuntime !== 'function') throw new Error('no factory'); if (typeof window !== 'undefined' || typeof document !== 'undefined') throw new Error('DOM present');"], { encoding: 'utf8', timeout: 20000 });
  expect(result.stderr).toBe(''); expect(result.status).toBe(0);
});
