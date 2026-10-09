// oxlint-disable-next-line import/no-nodejs-modules -- The headless runtime reads the native physics module and Pine's native bakes.
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
import source from '../../../src/shards/pine-hollow/shard.config';
import { pineBake } from '../../../src/shards/pine-hollow/runtime/baked';
import { ROSTER_STEP } from '../../../src/shards/pine-hollow/runtime/roster';
import { PINE_NAVMESH_ASSET, PINE_TERRAIN_ASSET, prepareHeadlessRuntime } from '../../../src/shards/pine-hollow/runtime/headless';

let rapier: Rapier, plan: HeadlessRuntimePlan;
const assets = new Map([PINE_TERRAIN_ASSET, PINE_NAVMESH_ASSET].map(path => [path, new Uint8Array(readFileSync(path))] as const));
beforeAll(async () => {
  rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
  plan = await prepareHeadlessRuntime({ shard: source, assets, rapier });
});
const effects = { commands: () => [], emit: () => { throw new Error('the roster emits no gameplay effects'); } };
const boot = (): SimHost => { const host = createSimHost(plan.level, { ...plan.ports, rapier }); plan.install(host, { restoring: false, ...effects }); return host; };
const restore = (saved: string): SimHost => {
  const decoded = decodeSimSnapshot(saved), ports = { ...plan.ports, rapier };
  return restoreSimHost(plan.level, ports, decoded, fresh => { if (ports.heightAt !== undefined) fresh.setHeightQuery(ports.heightAt); plan.install(fresh, { restoring: true, snapshot: decoded, ...effects }); });
};
const bake = pineBake();
const heightAt = (x: number, z: number): number => { const h = plan.ports?.heightAt; if (h === undefined) throw new Error('no height query'); return h(x, z); };
/** The player's tape: up the south trail from the gate toward the crossroads, weaving. */
function walk(host: SimHost): void { const t = host.state.tick; host.step({ moveX: 0.3 * Math.sin(t / 90), moveZ: 1, yaw: 0 }); }
/** Stand the player `d` m off the first live body of `kind` (its herd's side), on the ground. */
function standBy(host: SimHost, kind: string, d: number): string {
  const actor = [...host.entities.values()].find(a => a.kind === kind && a.alive && !a.scripted);
  if (actor === undefined) throw new Error(`no ${kind}`);
  const at = new Vector3(actor.position.x + d, heightAt(actor.position.x + d, actor.position.z) + 0.3, actor.position.z);
  host.player.motor.resetAt(at); host.player.position.copy(at);
  return actor.entityId;
}

it('stands the player at the gate on the page\'s terrain grid, with no entry proof yet (finish refuses)', () => {
  expect(plan.level.seed).toBe(1337); expect(plan.level.player.at.z).toBe(-235); expect(plan.level.player.yaw).toBe(Math.PI);
  expect(plan.level.player.at.y).toBeCloseTo(heightAt(0, -235) + 0.1, 9);
  expect(plan.proveEntries).toBeUndefined();
});

it('refuses without the page\'s terrain grid or navmesh (Pine\'s shardfile admits no assets)', async () => {
  await expect(Promise.resolve().then(() => prepareHeadlessRuntime({ shard: source, assets: new Map(), rapier }))).rejects.toThrow('baked terrain grid');
  await expect(Promise.resolve().then(() => prepareHeadlessRuntime({ shard: source, assets: new Map([[PINE_TERRAIN_ASSET, assets.get(PINE_TERRAIN_ASSET) ?? new Uint8Array()]]), rapier }))).rejects.toThrow('baked navmesh');
});

it('spawns the page\'s 164 load-time bodies in its list order, every kind, variant, seed and scale the bake\'s, on the creature floor', () => {
  const host = boot();
  try {
    expect([...host.entities.keys()]).toEqual(bake.actors.map(a => a.id));
    for (const actor of bake.actors) {
      const live = host.entities.get(actor.id); if (live === undefined) throw new Error(`missing ${actor.id}`);
      expect([live.kind, live.variant, live.seed, live.scale, live.scripted]).toEqual([actor.kind, actor.variant, actor.seed, actor.scale, actor.scripted]);
      expect([live.position.x, live.position.y, live.position.z].every(Number.isFinite)).toBe(true);
      if (!live.levelGround) expect(live.position.y).toBeCloseTo(heightAt(live.position.x, live.position.z), 6);
    }
    // the King's prewarm took ids 161-163 and their draws, with no body; the four elites stand at their lairs, scripted
    for (const id of ['creature:157', 'creature:161', 'creature:162', 'creature:163']) expect(host.entities.has(id)).toBe(false);
    const elites = bake.actors.filter(a => a.scripted).map(a => host.entities.get(a.id));
    expect(elites.map(a => a?.state)).toEqual(['sidestep', 'sidestep', 'sidestep', 'sidestep']);
  } finally { host.dispose(); }
});

it('walks 10k ticks up the trail: the herds graze, wander and notice the player; everything stays finite on the ground', () => {
  const host = boot(), states = new Set<string>();
  try {
    for (let tick = 0; tick < 10_000; tick++) { walk(host); if (tick % 30 === 0) for (const a of host.entities.values()) states.add(a.state); }
    const p = host.player.position;
    expect(p.z).toBeGreaterThan(-100); expect(p.y).toBeGreaterThan(heightAt(p.x, p.z) - 0.3);
    expect([...host.entities.values()].every(a => [a.position.x, a.position.y, a.position.z].every(Number.isFinite))).toBe(true);
    expect(states).toContain('graze'); expect(states).toContain('wander'); expect(states).toContain('alert');
  } finally { host.dispose(); }
}, 60_000);

it('a boar the player stands next to charges and its blow lands through the host\'s combat, knocking the player back', () => {
  const host = boot();
  try {
    const id = standBy(host, 'boar', 6), boar = host.entities.get(id), start = host.player.position.clone();
    let charged = false, lowest = host.player.health.attributes.health, shoved = false;
    for (let tick = 0; tick < 900; tick++) {
      host.step({ moveX: 0, moveZ: 0, yaw: 0 });
      charged ||= boar?.state === 'charge'; shoved ||= host.playerShove.t > 0;
      lowest = Math.min(lowest, host.player.health.attributes.health);
    }
    expect(charged).toBe(true); expect(lowest).toBeLessThan(host.player.health.attributes.maxHealth); expect(shoved).toBe(true);
    expect(host.player.position.distanceTo(start)).toBeGreaterThan(0.1);
  } finally { host.dispose(); }
});

it('restores exactly at install, mid-walk and mid-fight, by an identical install before the host restores', () => {
  for (const at of [0, 1, 1500, 2100]) {
    const original = boot(); let restored: SimHost | undefined;
    try {
      for (let tick = 0; tick < at; tick++) { if (tick === 1800) standBy(original, 'boar', 7); if (tick < 1800) walk(original); else original.step({ moveX: 0, moveZ: 0, yaw: 0 }); }
      restored = restore(serializeSimSnapshot(snapshotSimHost(original)));
      expect(snapshotSimHost(restored)).toEqual(snapshotSimHost(original));
      for (let tick = 0; tick < 600; tick++) { walk(original); walk(restored); }
      expect(serializeSimSnapshot(snapshotSimHost(restored))).toBe(serializeSimSnapshot(snapshotSimHost(original)));
      expect(snapshotSimHost(original).adapters.some(adapter => adapter.id === ROSTER_STEP)).toBe(true);
    } finally { restored?.dispose(); original.dispose(); }
  }
}, 120_000);

it('keeps the browser\'s navmesh refusing with no level configured: only a host that says datum 0 queries in the bake\'s frame', () => {
  // the Heightfield binds the datum (as the page does); no level is configured, so the default datum still refuses
  const script = `const { readFileSync } = await import('node:fs');
await import('./src/engine/world/Heightfield.ts');
const { parseNavmesh } = await import('./src/engine/physics/navmesh.ts');
const bytes = readFileSync('${PINE_NAVMESH_ASSET}'), nav = parseNavmesh(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
if (nav === null) throw new Error('navmesh');
let refused = '';
try { nav.closestWalkable({ x: 0, y: 0, z: -200 }); } catch (error) { refused = String(error); }
nav.datum = () => 0;
console.log(JSON.stringify({ refused, snapped: nav.closestWalkable({ x: 0, y: 0, z: -200 }) !== null }));`;
  const result = spawnSync(execPath, ['--experimental-transform-types', '--disable-warning=ExperimentalWarning', '--import', './scripts/sim-node-loader.mjs', '--input-type=module', '-e', script], { encoding: 'utf8', timeout: 20000 });
  expect(result.stderr).toBe(''); expect(result.status).toBe(0);
  const out = JSON.parse(result.stdout) as { refused: string; snapped: boolean };
  expect(out.refused).toContain('No level has been configured'); expect(out.snapped).toBe(true);
});

it('imports the trusted headless runtime without DOM or renderer modules', () => {
  const result = spawnSync(execPath, ['--experimental-transform-types', '--disable-warning=ExperimentalWarning', '--import', './scripts/sim-node-loader.mjs', '--input-type=module', '-e',
    "const m = await import('./src/shards/pine-hollow/runtime/headless.ts'); if (typeof m.prepareHeadlessRuntime !== 'function') throw new Error('no factory'); if (typeof window !== 'undefined' || typeof document !== 'undefined') throw new Error('DOM present');"], { encoding: 'utf8', timeout: 20000 });
  expect(result.stderr).toBe(''); expect(result.status).toBe(0);
});
