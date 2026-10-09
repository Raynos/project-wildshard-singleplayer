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
import { ELITES_STEP } from '../../../src/shards/pine-hollow/runtime/elites';
import { PINE_NAVMESH_ASSET, PINE_TERRAIN_ASSET, prepareHeadlessRuntime } from '../../../src/shards/pine-hollow/runtime/headless';
import type { HuntBody } from '../../../src/engine/ai/hunt';
import { PINE_ELITE_DEFS } from '../../../src/shards/pine-hollow/combat/eliteRoster';
import { PINE_LEVEL_SEED, pineEliteStreams } from '../../../src/shards/pine-hollow/combat/eliteStreams';
import { PINE_LANES } from '../../../src/shards/pine-hollow/combat/strikes';
import { BEAR_CAVE } from '../../../src/shards/pine-hollow/layout';

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

it('turns the four lair elites by the level seed\'s own streams, as the page does (no page salt, no Math.random)', () => {
  expect(PINE_LEVEL_SEED).toBe(source.identity.seed);
  const host = boot();
  try {
    const elites = bake.actors.filter(a => a.scripted).map(a => host.entities.get(a.id));
    // (Old Blackpaw then lurks in his cave, turned out of its mouth, as the page's script places him on spawn)
    expect(elites.map(a => a?.yaw)).toEqual(Object.keys(PINE_ELITE_DEFS).map(id => id === 'blackpaw' ? BEAR_CAVE.rot + Math.PI : pineEliteStreams(id).spawn.next() * Math.PI * 2));
    // two boots of a seed draw the same fight; another seed draws another
    const a = pineEliteStreams('ironhide'), b = pineEliteStreams('ironhide'), c = pineEliteStreams('ironhide', 7);
    const rolls = (r: typeof a): number[] => Array.from({ length: 4 }, () => r.fight.next());
    expect(rolls(a)).toEqual(rolls(b)); expect(rolls(c)).not.toEqual(rolls(pineEliteStreams('ironhide')));
  } finally { host.dispose(); }
});

/** The elites' continuation, as the host snapshots it (runtime/elites.ts). */
interface ElitesState { entries: { id: string; state: string; phase2: boolean; timer: number }[]; scripts: { id: string; mode: string; fields: Record<string, number | boolean | null> }[] }
const elitesState = (host: SimHost): ElitesState => {
  const adapter = host.adapters.get(ELITES_STEP);
  if (adapter === undefined) throw new Error('no elites continuation');
  const state: unknown = adapter.snapshot();
  return state as ElitesState;
};
const entryOf = (host: SimHost, id: string): ElitesState['entries'][number] => { const e = elitesState(host).entries.find(x => x.id === id); if (e === undefined) throw new Error(id); return e; };
/** Stand the player `d` m east of a named elite's body, on the ground. */
function standByElite(host: SimHost, variant: string, d: number): HuntBody {
  const body = [...host.entities.values()].find(a => a.scripted && a.variant === variant);
  if (body === undefined) throw new Error(`no elite ${variant}`);
  const at = new Vector3(body.position.x + d, heightAt(body.position.x + d, body.position.z) + 0.3, body.position.z);
  host.player.motor.resetAt(at); host.player.position.copy(at);
  return Object.assign(body, { hidden: false, sampleTerrain: (): void => undefined });
}
const still = { moveX: 0, moveZ: 0, yaw: 0 };

it('runs the four elites under the game\'s elite rules renderer-free: Old Ironhide engages, gore-charges and lands one blow through the host', () => {
  const host = boot();
  try {
    expect(elitesState(host).entries.map(e => [e.id, e.state])).toEqual([['ironhide', 'idle'], ['ghost-stag', 'idle'], ['blackpaw', 'idle'], ['imperial-bull', 'idle']]);
    // Blackpaw lurks in his cave: hidden at its mouth from his first spawn, as on the page
    expect(elitesState(host).scripts.find(s => s.id === 'blackpaw')?.mode).toBe('lurk');
    standByElite(host, 'ironhide', 20);
    const states = new Set<string>(), before = host.player.health.attributes.health;
    for (let tick = 0; tick < 900 && host.player.health.attributes.health === before; tick++) {
      host.step(still);
      const e = entryOf(host, 'ironhide'), s = elitesState(host).scripts[0];
      states.add(`${e.state}.${s?.mode ?? ''}`);
    }
    expect(states).toContain('engaged.circle'); expect(states).toContain('engaged.charge');
    expect(host.player.health.attributes.health).toBe(before - PINE_LANES.ironhide.damage);
  } finally { host.dispose(); }
});

it('takes Old Ironhide to phase 2 at half health (the 1 s beat holds his hp) and the kill sleeps his lair 20 minutes', () => {
  const host = boot();
  try {
    const boar = standByElite(host, 'ironhide', 20);
    const hit = (amount: number): void => { host.combat.hit({ source: host.player.health, sourceTags: ['dmg.melee', 'cover.checked'], target: boar.combatActor(), amount, point: boar.position.clone(), dir: new Vector3() }); };
    host.step(still);
    expect(entryOf(host, 'ironhide')).toMatchObject({ state: 'engaged', phase2: false });
    boar.hp = boar.maxHp * 0.45; host.step(still);
    expect(entryOf(host, 'ironhide')).toMatchObject({ state: 'engaged', phase2: true });
    expect(elitesState(host).scripts[0]?.fields['p2']).toBe(true);
    const locked = boar.hp; boar.hp -= 5; host.step(still);
    expect(boar.hp).toBe(locked); // the beat: invulnerable for a second
    for (let tick = 0; tick < 70; tick++) host.step(still);
    hit(boar.maxHp * 10); host.step(still);
    expect(boar.alive).toBe(false);
    expect(entryOf(host, 'ironhide')).toMatchObject({ state: 'dead' });
    expect(entryOf(host, 'ironhide').timer).toBeGreaterThan(20 * 60 - 1);
  } finally { host.dispose(); }
});

it('fades the Ghost Stag when the player walks up on it, and it comes back facing them two seconds later', () => {
  const host = boot();
  try {
    const stag = standByElite(host, 'ghost', 8), modes = new Set<string>();
    let hidden = false;
    // its fade cools down 3 s from its spawn; a blow after that fades it wherever it stands
    for (let tick = 0; tick < 400; tick++) {
      if (tick === 200) host.combat.hit({ source: host.player.health, sourceTags: ['dmg.melee', 'cover.checked'], target: stag.combatActor(), amount: 1, point: stag.position.clone(), dir: new Vector3() });
      host.step(still); modes.add(elitesState(host).scripts[1]?.mode ?? ''); hidden ||= stag.hidden;
    }
    expect(modes).toContain('faded'); expect(hidden).toBe(true); expect(modes).toContain('stare');
  } finally { host.dispose(); }
});

it('restores exactly mid-fight with an elite: Old Ironhide mid-charge, the Ghost Stag faded', () => {
  for (const [variant, at] of [['ironhide', 170], ['ghost', 230]] as const) {
    const original = boot(); let restored: SimHost | undefined;
    try {
      const body = standByElite(original, variant, variant === 'ghost' ? 8 : 20);
      for (let tick = 0; tick < at; tick++) {
        if (tick === 200) original.combat.hit({ source: original.player.health, sourceTags: ['dmg.melee', 'cover.checked'], target: body.combatActor(), amount: 1, point: body.position.clone(), dir: new Vector3() });
        original.step(still);
      }
      const mode = elitesState(original).scripts.find(s => s.id === (variant === 'ghost' ? 'ghost-stag' : 'ironhide'))?.mode;
      expect(mode).toBe(variant === 'ghost' ? 'faded' : 'charge');
      restored = restore(serializeSimSnapshot(snapshotSimHost(original)));
      expect(snapshotSimHost(restored)).toEqual(snapshotSimHost(original));
      for (let tick = 0; tick < 300; tick++) { original.step(still); restored.step(still); }
      expect(serializeSimSnapshot(snapshotSimHost(restored))).toBe(serializeSimSnapshot(snapshotSimHost(original)));
    } finally { restored?.dispose(); original.dispose(); }
  }
}, 60_000);

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
      // the host runs on the page's distance bands and the body LOD; their clocks ride the snapshot
      expect(original.bodyBands).toEqual({ physics: true }); expect(snapshotSimHost(original).bands).toBeDefined();
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

it('imports the trusted headless runtime, the elites\' goals and the bare lane without DOM or renderer modules', () => {
  const result = spawnSync(execPath, ['--experimental-transform-types', '--disable-warning=ExperimentalWarning', '--import', './scripts/sim-node-loader.mjs', '--input-type=module', '-e',
    "const m = await import('./src/shards/pine-hollow/runtime/headless.ts'); if (typeof m.prepareHeadlessRuntime !== 'function') throw new Error('no factory'); const g = await import('./src/shards/pine-hollow/combat/EliteGoals.ts'), l = await import('./src/shards/pine-hollow/combat/lane.ts'); if (typeof g.ironhideGoal !== 'function' || typeof l.Lane !== 'function') throw new Error('no goals'); if (typeof window !== 'undefined' || typeof document !== 'undefined') throw new Error('DOM present');"], { encoding: 'utf8', timeout: 20000 });
  expect(result.stderr).toBe(''); expect(result.status).toBe(0);
});
