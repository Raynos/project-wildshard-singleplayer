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
import type { HeadlessRuntimePlan } from '../../../src/sdk/headlessRuntime';
import source from '../../../src/shards/far-reach/shard.config';
import baked from '../../../src/shards/far-reach/runtime/physics.baked.json';
import { CROWN, GOATS, ROC } from '../../../src/shards/far-reach/layout';
import type { HeadlessEffect } from '../../../src/sdk/tickProtocol';
import { FLAGS } from '../../../src/shards/far-reach/quest/flags';
import { ROC_STEP } from '../../../src/shards/far-reach/runtime/roc';
import { FLOCK_STEP, SKY_KILL_Y } from '../../../src/shards/far-reach/runtime/flock';
import { SKY_REACH } from '../../../src/shards/far-reach/manifest';
import { prepareHeadlessRuntime } from '../../../src/shards/far-reach/runtime/headless';

let rapier: Rapier, plan: HeadlessRuntimePlan;
beforeAll(async () => {
  rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
  plan = await prepareHeadlessRuntime({ shard: source, assets: new Map(), rapier });
});
const noEffects = { commands: () => [], emit: () => { throw new Error('the flock keeper emits no gameplay effects'); } };
interface Effects { commands: () => never[]; emit: (effect: HeadlessEffect) => void }
const boot = (effects: Effects = noEffects): SimHost => { const host = createSimHost(plan.level, { ...plan.ports, rapier }); plan.install(host, { restoring: false, ...effects }); return host; };
const restore = (saved: string, effects: Effects = noEffects): SimHost => {
  const decoded = decodeSimSnapshot(saved), ports = { ...plan.ports, rapier };
  return restoreSimHost(plan.level, ports, decoded, fresh => { if (ports.heightAt !== undefined) fresh.setHeightQuery(ports.heightAt); plan.install(fresh, { restoring: true, snapshot: decoded, ...effects }); });
};
const collect = (into: HeadlessEffect[]): Effects => ({ commands: () => [], emit: effect => { into.push(effect); } });
/** The player's tape: off Sunrest's north rope bridge onto the windmill isle (its goats, the free ray overhead), then wander. */
const route = [new Vector3(0, 0, -30), new Vector3(0, 0, -58), new Vector3(4, 0, -66)];
function step(host: SimHost): void {
  const tick = host.state.tick, goal = route[Math.min(route.length - 1, Math.floor(tick / 900))] ?? new Vector3(), p = host.player.position;
  const dx = goal.x - p.x, dz = goal.z - p.z, d = Math.hypot(dx, dz);
  host.step(d < 1.5 ? { moveX: Math.sin(tick / 40), moveZ: Math.cos(tick / 40), yaw: 0 } : { moveX: dx / d, moveZ: dz / d, yaw: Math.atan2(dx, dz) });
}
function kill(host: SimHost, id: string): void {
  const actor = host.entities.get(id); if (actor === undefined) throw new Error(`missing ${id}`);
  host.combat.hit({ source: host.player.health, sourceTags: ['actor.player'], target: actor.combatActor(), amount: 10_000, point: actor.position.clone(), dir: new Vector3(0, 0, 1), from: host.player.position.clone(), moveId: 'test.kill' });
}
const order = baked.actors.map(actor => actor.id);

it('keeps the manifest kill height', () => { expect(SKY_KILL_Y).toBe(SKY_REACH.world?.killY); });

it('spawns the eight flyers at install and the five goats on the first fixed step, reproducing every baked seed and scale', () => {
  const host = boot();
  try {
    expect([...host.entities.keys()]).toEqual(order.slice(0, 8));
    // the Roc spawns at its storm altitude over its circle; the armed encounter's reset sets it on its perch (BossBrain.arm)
    expect(snapshotSimHost(host).adapters.find(adapter => adapter.id === 'runtime.actor.far.roc')?.state).toContain(`"y":${String(ROC.y)}`);
    expect(host.entities.get('far.roc')?.position.y).toBeLessThan(ROC.y);
    step(host);
    expect([...host.entities.keys()]).toEqual(order);
    for (const actor of baked.actors) {
      const live = host.entities.get(actor.id);
      expect([actor.id, live?.seed, live?.scale]).toEqual([actor.id, actor.seed, actor.scale]);
    }
    // each goat stands on its island's deck (the first WORLD floor under deck + 2 m), never on the analytic -1000 m floor
    GOATS.forEach((goat, i) => { expect(host.entities.get(`far.goat.${String(i)}`)?.position.y).toBeCloseTo(goat.isle.y, 1); });
    expect(plan.proveEntries).toBeUndefined(); // finish stays refused until the entry proof is real
  } finally { host.dispose(); }
});

it('runs 10k ticks of the shipping policies: real contacts hurt the player, a fall below the kill height kills', () => {
  const host = boot(), seen = new Set<string>();
  let lowest = host.player.health.attributes.health;
  try {
    for (let tick = 0; tick < 10_000; tick++) {
      if (tick === 3000) { const goat = host.entities.get('far.goat.4'); goat?.place(goat.position.x + 40, goat.position.z, 0, goat.position.y); }
      step(host);
      for (const actor of host.entities.values()) seen.add(`${actor.kind}:${actor.state}`);
      lowest = Math.min(lowest, host.player.health.attributes.health);
    }
    expect(host.state.tick).toBe(10_000);
    expect(lowest).toBeLessThan(host.player.health.attributes.maxHealth);
    // the goat set down over the void falls past the death plane and dies by the fall pipeline
    const fallen = host.entities.get('far.goat.4');
    expect(fallen?.alive).toBe(false); expect(fallen?.position.y).toBeLessThan(SKY_KILL_Y + 1);
    expect([...host.entities.values()].every(a => [a.position.x, a.position.y, a.position.z].every(Number.isFinite))).toBe(true);
    expect(seen.size).toBeGreaterThan(3);
  } finally { host.dispose(); }
});

it('restores before and after the goats land, mid-fight, exactly, reinstalling the saved roster before restore', () => {
  for (const checkpoint of [0, 1, 700, 2600]) {
    const original = boot(); let restored: SimHost | undefined;
    try {
      for (let tick = 0; tick < checkpoint; tick++) step(original);
      const saved = serializeSimSnapshot(snapshotSimHost(original));
      restored = restore(saved);
      expect(snapshotSimHost(restored)).toEqual(snapshotSimHost(original));
      for (let tick = 0; tick < 900; tick++) {
        if (tick === 120) { kill(original, 'far.ray.0'); kill(restored, 'far.ray.0'); }
        step(original); step(restored);
      }
      expect(serializeSimSnapshot(snapshotSimHost(restored))).toBe(serializeSimSnapshot(snapshotSimHost(original)));
      expect(snapshotSimHost(original).adapters.some(adapter => adapter.id === FLOCK_STEP)).toBe(true);
    } finally { restored?.dispose(); original.dispose(); }
  }
});

it('shoves the player through the host impulse when a wisp bursts on them', () => {
  const host = boot();
  try {
    step(host);
    const wisp = host.entities.get('far.wisp.0'); if (wisp === undefined) throw new Error('missing wisp');
    // stand under the keeper isle's wisp, facing nothing: its burst claims, darts and contacts within a few seconds
    host.player.position.set(wisp.position.x, wisp.position.y - 2, wisp.position.z);
    let shoved = false;
    for (let tick = 0; tick < 600 && !shoved; tick++) { host.step(); shoved = host.playerImpulse.lengthSq() > 0; }
    expect(shoved).toBe(true);
  } finally { host.dispose(); }
});

/** Stand the player on the crown (the bridge that leads there is not yet owned headless) and fight: chip the Roc down. */
function crownFight(host: SimHost, tick: number): void {
  if (tick === 0) host.player.position.set(CROWN.x, CROWN.y, CROWN.z + 6);
  const roc = host.entities.get('far.roc');
  if (roc !== undefined && roc.alive && tick > 400 && tick % 240 === 0)
    host.combat.hit({ source: host.player.health, sourceTags: ['actor.player'], target: roc.combatActor(), amount: 60, point: roc.position.clone(), dir: new Vector3(0, 0, 1), moveId: 'test.chip' }); // a direct test chip: the War Fan is not yet owned
  host.step();
}
it('runs the Storm Roc encounter: intro on the crown, phases at 66 % and 33 %, one fact and purse on its first fall', () => {
  const effects: HeadlessEffect[] = [], host = boot(collect(effects)), states = new Set<string>(), phases = new Set<number>();
  let lowest = host.player.health.attributes.health;
  try {
    step(host);
    expect(snapshotSimHost(host).adapters.find(adapter => adapter.id === ROC_STEP)?.state).toContain('"state":"armed"'); // armed at install, waiting at the crown
    for (let tick = 0; tick < 6000 && !host.flags.has(FLAGS.roc); tick++) {
      crownFight(host, tick);
      const encounter = snapshotSimHost(host).adapters.find(adapter => adapter.id === ROC_STEP)?.state;
      if (typeof encounter === 'string') { const parsed: unknown = JSON.parse(encounter); if (typeof parsed === 'object' && parsed !== null && 'boss' in parsed && typeof parsed.boss === 'object' && parsed.boss !== null && 'state' in parsed.boss && 'phase' in parsed.boss) { states.add(String(parsed.boss.state)); phases.add(Number(parsed.boss.phase)); } }
      lowest = Math.min(lowest, host.player.health.attributes.health);
    }
    expect(host.flags.has(FLAGS.roc)).toBe(true);
    expect([...states]).toEqual(expect.arrayContaining(['intro', 'fight', 'beat', 'victory']));
    expect([...phases]).toEqual(expect.arrayContaining([0, 1, 2]));
    expect(lowest).toBeLessThan(host.player.health.attributes.maxHealth); // the Roc's own strikes landed through the fight
    expect(effects).toEqual([{ kind: 'fact', name: 'far-reach.roc', actorId: 'far.roc' }, { kind: 'coins', amount: 25, actorId: 'far.roc' }]);
  } finally { host.dispose(); }
});

it('restores the Roc encounter mid-fight exactly, its victory paying once on the restored host', () => {
  for (const checkpoint of [900, 2000]) {
    const paidOriginal: HeadlessEffect[] = [], resumed: HeadlessEffect[] = [], original = boot(collect(paidOriginal));
    let restored: SimHost | undefined;
    try {
      step(original);
      for (let tick = 0; tick < checkpoint; tick++) crownFight(original, tick);
      restored = restore(serializeSimSnapshot(snapshotSimHost(original)), collect(resumed));
      const paid = paidOriginal.length;
      for (let tick = checkpoint; tick < checkpoint + 3000; tick++) { crownFight(original, tick); crownFight(restored, tick); }
      expect(serializeSimSnapshot(snapshotSimHost(restored))).toBe(serializeSimSnapshot(snapshotSimHost(original)));
      expect(resumed).toEqual(paidOriginal.slice(paid));
    } finally { restored?.dispose(); original.dispose(); }
  }
});

it('refuses a saved roster whose recipe no longer matches the baked spec', () => {
  const host = boot();
  try {
    for (let tick = 0; tick < 60; tick++) step(host);
    const saved = snapshotSimHost(host);
    const actor = saved.adapters.find(adapter => adapter.id === 'runtime.actor.far.goat.1');
    if (actor === undefined || typeof actor.state !== 'string') throw new Error('missing saved goat recipe');
    actor.state = actor.state.replace('"hp":40', '"hp":41');
    expect(() => restore(serializeSimSnapshot(saved))).toThrow('Incompatible dynamic simulation actor recipe');
  } finally { host.dispose(); }
});

it('imports the trusted headless runtime without DOM or renderer modules', () => {
  const result = spawnSync(execPath, ['--experimental-transform-types', '--disable-warning=ExperimentalWarning', '--import', './scripts/sim-node-loader.mjs', '--input-type=module', '-e',
    "const m = await import('./src/shards/far-reach/runtime/headless.ts'); if (typeof m.prepareHeadlessRuntime !== 'function') throw new Error('no factory'); if (typeof window !== 'undefined' || typeof document !== 'undefined') throw new Error('DOM present');"], { encoding: 'utf8', timeout: 20000 });
  expect(result.stderr).toBe(''); expect(result.status).toBe(0);
});
