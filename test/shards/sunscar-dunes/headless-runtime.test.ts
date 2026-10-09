// oxlint-disable-next-line import/no-nodejs-modules -- The headless runtime reads the shard's admitted in-tree bytes and the native physics module.
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
import { expectSameSimSnapshot } from '../../fake/simSnapshot';
import type { HeadlessRuntimePlan } from '../../../src/sdk/headlessRuntime';
import source from '../../../src/shards/sunscar-dunes/shard.config';
import manifest from '../../../src/shards/sunscar-dunes/manifest';
import { SIGNAL_SPAWNS } from '../../../src/shards/sunscar-dunes/data/spawns';
import { SCOUT_FLAG } from '../../../src/shards/sunscar-dunes/data/flags';
import { HOMES_STEP } from '../../../src/shards/sunscar-dunes/runtime/homes';
import { WHIP_STEP } from '../../../src/shards/sunscar-dunes/runtime/whip';
import { WHIP_ITEM } from '../../../src/shards/sunscar-dunes/data/items';
import type { HeadlessCommand } from '../../../src/sdk/tickProtocol';
import { prepareHeadlessRuntime, SIGNAL_ATTACKERS } from '../../../src/shards/sunscar-dunes/runtime/headless';

let rapier: Rapier, plan: HeadlessRuntimePlan;
const assets = new Map(source.files.map(file => [file.hash, new Uint8Array(readFileSync(`src/shards/sunscar-dunes/assets/${file.hash}`))]));
beforeAll(async () => {
  rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
  plan = await prepareHeadlessRuntime({ shard: source, assets, rapier });
});
/** The tick's commands, as the trusted adapter lends them (a player attack names its target). */
let tape: HeadlessCommand[] = [];
const noEffects = { commands: () => tape, emit: () => { throw new Error('the homes keeper emits no gameplay effects'); } };
const boot = (): SimHost => { const host = createSimHost(plan.level, { ...plan.ports, rapier }); plan.install(host, { restoring: false, ...noEffects }); return host; };
const restore = (saved: string): SimHost => {
  const decoded = decodeSimSnapshot(saved), ports = { ...plan.ports, rapier };
  return restoreSimHost(plan.level, ports, decoded, fresh => { if (ports.heightAt !== undefined) fresh.setHeightQuery(ports.heightAt); plan.install(fresh, { restoring: true, snapshot: decoded, ...noEffects }); });
};
/** One tick with the player standing still, cracking the whip at `target` (the adapter's command, then the host's step). */
function crack(host: SimHost, target: string | null): void {
  const player = { kind: 'player' as const, moveX: 0, moveZ: 0, yaw: host.player.yaw };
  tape = target === null ? [] : [{ ...player, attack: { targetId: target } }];
  try { host.step({ moveX: 0, moveZ: 0, yaw: host.player.yaw, ...(target === null ? {} : { attack: { targetId: target } }) }); } finally { tape = []; }
}
/** The player's tape: meet Sefa (the ray is released), walk into the skitterer pack west of camp, then on to a strider. */
const route = [new Vector3(-28, 0, 6), new Vector3(-24, 0, -38), new Vector3(-96, 0, 2)];
function step(host: SimHost): void {
  const tick = host.state.tick, goal = route[Math.min(route.length - 1, Math.floor(tick / 2400))] ?? new Vector3(), p = host.player.position;
  if (tick === 30) host.flags.set(SCOUT_FLAG);
  const dx = goal.x - p.x, dz = goal.z - p.z, d = Math.hypot(dx, dz);
  host.step(d < 1.5 ? { moveX: Math.sin(tick / 40), moveZ: Math.cos(tick / 40), yaw: 0 } : { moveX: dx / d, moveZ: dz / d, yaw: Math.atan2(dx, dz) });
}
function kill(host: SimHost, id: string): void {
  const actor = host.entities.get(id); if (actor === undefined) throw new Error(`missing ${id}`);
  host.combat.hit({ source: host.player.health, sourceTags: ['actor.player'], target: actor.combatActor(), amount: 10_000, point: actor.position.clone(), dir: new Vector3(0, 0, 1), from: host.player.position.clone(), moveId: 'test.kill' });
}

it('keeps the manifest\'s attack cap and installs the 13 declared homes as trusted dynamic actors', () => {
  expect(SIGNAL_ATTACKERS).toBe(manifest.fight?.attackers);
  const host = boot();
  try {
    expect([...host.entities.keys()]).toEqual(SIGNAL_SPAWNS.homes.map(home => home.id));
  } finally { host.dispose(); }
});

it('proves its entries on the native terrain: a player capsule walks 50 m in on all 92 lanes of the four declared openings', () => {
  const host = boot();
  try {
    for (let tick = 0; tick < 60; tick++) host.step({ moveX: 0, moveZ: 0, yaw: 0 });
    const colliders = host.physics.world.colliders.len();
    const proof = plan.proveEntries?.(host);
    expect(proof?.lanes).toBe(92); expect(proof?.steps).toBeGreaterThanOrEqual(46_000);
    expect(host.physics.world.colliders.len()).toBe(colliders); // the proof's capsule is released
  } finally { host.dispose(); }
});

it('runs 10k ticks of the shipping policies: real contacts hurt the player, a death respawns from the creature stream', () => {
  const host = boot(), seen = new Set<string>();
  let lowest = host.player.health.attributes.health;
  try {
    const before = host.entities.get('sunscar.home:1')?.seed;
    for (let tick = 0; tick < 10_000; tick++) {
      if (tick === 2000) kill(host, 'sunscar.home:1');
      step(host);
      for (const actor of host.entities.values()) seen.add(`${actor.kind}:${actor.state}`);
      lowest = Math.min(lowest, host.player.health.attributes.health);
    }
    expect(host.state.tick).toBe(10_000);
    expect(lowest).toBeLessThan(host.player.health.attributes.maxHealth);
    const reborn = host.entities.get('sunscar.home:1');
    expect(reborn?.alive).toBe(true); expect(reborn?.seed).not.toBe(before);
    expect([...host.entities.values()].every(a => [a.position.x, a.position.y, a.position.z].every(Number.isFinite))).toBe(true);
    expect(seen.size).toBeGreaterThan(3);
  } finally { host.dispose(); }
});

it('restores mid-fight and mid-respawn continuation exactly, reinstalling the saved roster before restore', () => {
  for (const checkpoint of [700, 2600, 4100]) {
    const original = boot(); let restored: SimHost | undefined;
    try {
      for (let tick = 0; tick < checkpoint; tick++) { if (tick === 2000) kill(original, 'sunscar.home:1'); step(original); }
      const saved = serializeSimSnapshot(snapshotSimHost(original));
      restored = restore(saved);
      expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(original));
      for (let tick = 0; tick < 900; tick++) {
        if (tick === 120) { kill(original, 'sunscar.home:2'); kill(restored, 'sunscar.home:2'); }
        step(original); step(restored);
      }
      expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(original));
      const keeper = snapshotSimHost(original).adapters.find(adapter => adapter.id === HOMES_STEP);
      expect(keeper).toBeDefined();
    } finally { restored?.dispose(); original.dispose(); }
  }
});

it('cracks the declared whip row through the shared LashRuntime: 18 per light contact inside its reach, cooldown-gated, exact on restore', () => {
  const host = boot(); let restored: SimHost | undefined;
  try {
    const target = host.entities.get('sunscar.home:12'); if (target === undefined) throw new Error('missing strider');
    for (let tick = 0; tick < 2; tick++) crack(host, null);
    // stand 4 m from the strider's body, inside the row's 7 m reach
    host.player.position.set(target.position.x, target.position.y, target.position.z + 4);
    const hp = target.combatActor().attributes.health;
    crack(host, target.entityId);
    expect(target.combatActor().attributes.health).toBe(hp); // the lash is still unrolling
    crack(host, target.entityId); // inside the 0.45 s cooldown: no second swing
    expect(target.combatActor().attributes.health).toBe(hp);
    const saved = serializeSimSnapshot(snapshotSimHost(host));
    expect(snapshotSimHost(host).adapters.some(adapter => adapter.id === WHIP_STEP)).toBe(true);
    restored = restore(saved);
    const twin = restored.entities.get(target.entityId); if (twin === undefined) throw new Error('missing restored strider');
    for (let tick = 0; tick < 60; tick++) {
      host.player.position.set(target.position.x, target.position.y, target.position.z + 4); restored.player.position.set(twin.position.x, twin.position.y, twin.position.z + 4);
      crack(host, tick % 10 === 0 ? target.entityId : null); crack(restored, tick % 10 === 0 ? twin.entityId : null);
    }
    expect(target.combatActor().attributes.health).toBeLessThan(hp - WHIP_ITEM.light.damage);
    expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(host));
    // out of reach (12 m): the lash lands on nothing
    const before = target.combatActor().attributes.health;
    for (let tick = 0; tick < 40; tick++) { host.player.position.set(target.position.x, target.position.y, target.position.z + 12); crack(host, tick % 30 === 0 ? target.entityId : null); }
    expect(target.combatActor().attributes.health).toBe(before);
  } finally { restored?.dispose(); host.dispose(); }
});

it('refuses a saved roster whose recipe no longer matches the baked spec', () => {
  const host = boot();
  try {
    for (let tick = 0; tick < 60; tick++) step(host);
    const saved = snapshotSimHost(host);
    const actor = saved.adapters.find(adapter => adapter.id === 'runtime.actor.sunscar.home:3');
    if (actor === undefined || typeof actor.state !== 'string') throw new Error('missing saved home recipe');
    actor.state = actor.state.replace('"hp":24', '"hp":25');
    expect(() => restore(serializeSimSnapshot(saved))).toThrow('Incompatible dynamic simulation actor recipe');
  } finally { host.dispose(); }
});

it('imports the trusted headless runtime without DOM or renderer modules', () => {
  const result = spawnSync(execPath, ['--experimental-transform-types', '--disable-warning=ExperimentalWarning', '--import', './scripts/sim-node-loader.mjs', '--input-type=module', '-e',
    "const m = await import('./src/shards/sunscar-dunes/runtime/headless.ts'); if (typeof m.prepareHeadlessRuntime !== 'function') throw new Error('no factory'); if (typeof window !== 'undefined' || typeof document !== 'undefined') throw new Error('DOM present');"], { encoding: 'utf8', timeout: 20000 });
  expect(result.stderr).toBe(''); expect(result.status).toBe(0);
});
