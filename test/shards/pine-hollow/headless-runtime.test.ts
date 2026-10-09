// oxlint-disable-next-line import/no-nodejs-modules -- The headless runtime reads the native physics module and Pine's native bakes.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Import the trusted runtime in plain Node with the renderer-denying loader.
import { spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Use the current Node binary for the closure proof.
import { execPath } from 'node:process';
import { Vector3 } from 'three';
import { beforeAll, expect, it } from 'vitest';
import { createSimHost, type SimHost, type SimLevel } from '../../../src/engine/sim';
import { decodeSimSnapshot, restoreSimHost, serializeSimSnapshot, snapshotSimHost, type SimSnapshot } from '../../../src/engine/sim/snapshot';
import { loadRapier, type Rapier } from '../../../src/engine/physics/rapier';
import type { HeadlessRuntimePlan } from '../../../src/sdk/headlessRuntime';
import source from '../../../src/shards/pine-hollow/shard.config';
import { pineBake } from '../../../src/shards/pine-hollow/runtime/baked';
import { ROSTER_STEP, type PineHuntBody } from '../../../src/shards/pine-hollow/runtime/roster';
import { ELITES_STEP } from '../../../src/shards/pine-hollow/runtime/elites';
import { bodyHit } from '../../../src/shards/pine-hollow/runtime/weapons/headlessRanged';
import { LEVER_FLAG, PINE_WEAPON } from '../../../src/shards/pine-hollow/runtime/weapons/headlessLoadout';
import { installPine, PINE_NAVMESH_ASSET, PINE_TERRAIN_ASSET, pineTerrainGrid, prepareHeadlessRuntime, type PineInstall } from '../../../src/shards/pine-hollow/runtime/headless';
import { parseNavmesh } from '../../../src/engine/physics/navmesh';
import { isPineEdgeWall } from '../../../src/shards/pine-hollow/runtime/entries';
import { inEntryLanes } from '../../../src/shards/pine-hollow/world/entryLanes';
import type { ImperialBull } from '../../../src/shards/pine-hollow/combat/eliteScripts';
import type { HuntBody } from '../../../src/engine/ai/hunt';
import { PINE_ELITE_DEFS } from '../../../src/shards/pine-hollow/combat/eliteRoster';
import { PINE_LEVEL_SEED, pineEliteStreams } from '../../../src/shards/pine-hollow/combat/eliteStreams';
import { PINE_LANES } from '../../../src/shards/pine-hollow/combat/strikes';
import { expectSameSimSnapshot } from '../../fake/simSnapshot';
import { BEAR_CAVE, KINGS_CLEARING } from '../../../src/shards/pine-hollow/layout';
import { PINE_PHASES } from '../../../src/shards/pine-hollow/look/dayKeys';

let rapier: Rapier, plan: HeadlessRuntimePlan, basis: Uint8Array;
const assets = new Map([PINE_TERRAIN_ASSET, PINE_NAVMESH_ASSET].map(path => [path, new Uint8Array(readFileSync(path))] as const));
const effects = { commands: () => [], emit: () => { throw new Error('the roster emits no gameplay effects'); } };
const boot = (): SimHost => { const host = createSimHost(plan.level, { ...plan.ports, rapier }); plan.install(host, { restoring: false, ...effects }); return host; };
beforeAll(async () => {
  rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
  plan = await prepareHeadlessRuntime({ shard: source, assets, rapier });
  // the fresh world's native bytes, the checked basis a checkpoint's wire references (as the grid's durable autosave does):
  // the 8.4 MB world packs to ~0.5 MB against it, a fifth of the string round trip's cost under coverage
  const fresh = boot(); basis = fresh.physics.snapshot(); fresh.dispose();
});
/** A checkpoint through its string, once: the wire against the fresh-world basis, decoded with the same checked basis. */
const roundTrip = (saved: SimSnapshot): SimSnapshot => decodeSimSnapshot(serializeSimSnapshot(saved, basis), basis);
const restore = (saved: SimSnapshot): SimHost => {
  const decoded = roundTrip(saved), ports = { ...plan.ports, rapier };
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

it('stands the player at the gate on the page\'s terrain grid; the entry proof walks a real capsule 50 m in through every entryway\'s 23 lanes of the grid\'s world', () => {
  expect(plan.level.seed).toBe(1337); expect(plan.level.player.at.z).toBe(-235); expect(plan.level.player.yaw).toBe(Math.PI);
  expect(plan.level.player.at.y).toBeCloseTo(heightAt(0, -235) + 0.1, 9);
  const host = boot();
  try {
    const proof = plan.proveEntries?.(host);
    expect(proof?.lanes).toBe(92); expect(proof?.steps).toBeGreaterThan(92 * 400);
  } finally { host.dispose(); }
  // the scatter keeps every solid out of the openings (world/entryLanes.ts): none of the bake's solids stands in a lane
  expect(bake.solids.filter(solid => !isPineEdgeWall(solid) && solid.shape === 9 && inEntryLanes(source.entryways, 250, solid.at[0], solid.at[2]))).toEqual([]);
}, 30_000);

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

// one test per elite (each its own budget), the continuations compared with expectSameSimSnapshot
it.each([['ironhide', 170], ['ghost', 230]] as const)('restores exactly mid-fight with an elite (%s: Old Ironhide mid-charge, the Ghost Stag faded)', (variant, at) => {
  const original = boot(); let restored: SimHost | undefined;
  try {
    const body = standByElite(original, variant, variant === 'ghost' ? 8 : 20);
    for (let tick = 0; tick < at; tick++) {
      if (tick === 200) original.combat.hit({ source: original.player.health, sourceTags: ['dmg.melee', 'cover.checked'], target: body.combatActor(), amount: 1, point: body.position.clone(), dir: new Vector3() });
      original.step(still);
    }
    const mode = elitesState(original).scripts.find(s => s.id === (variant === 'ghost' ? 'ghost-stag' : 'ironhide'))?.mode;
    expect(mode).toBe(variant === 'ghost' ? 'faded' : 'charge');
    const saved = snapshotSimHost(original);
    restored = restore(saved);
    expectSameSimSnapshot(snapshotSimHost(restored), saved);
    for (let tick = 0; tick < 300; tick++) { original.step(still); restored.step(still); }
    expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(original));
  } finally { restored?.dispose(); original.dispose(); }
}, 120_000);

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

// One test per checkpoint, so each has its own budget: a checkpoint's string round trip (serialise + decode + restore of
// the 8.4 MB native world) is most of its cost under CI coverage; the continuations compare with expectSameSimSnapshot.
it.each([0, 1, 1500, 2100])('restores exactly at tick %i (install, mid-walk, mid-fight), by an identical install before the host restores', (at) => {
  const original = boot(); let restored: SimHost | undefined;
  try {
    for (let tick = 0; tick < at; tick++) { if (tick === 1800) standBy(original, 'boar', 7); if (tick < 1800) walk(original); else original.step({ moveX: 0, moveZ: 0, yaw: 0 }); }
    const saved = snapshotSimHost(original);
    restored = restore(saved);
    expectSameSimSnapshot(snapshotSimHost(restored), saved);
    expect(saved.adapters.some(adapter => adapter.id === ROSTER_STEP)).toBe(true);
    // the host runs on the page's distance bands and the body LOD; their clocks ride the snapshot
    expect(original.bodyBands).toEqual({ physics: true }); expect(saved.bands).toBeDefined();
    for (let tick = 0; tick < 600; tick++) { walk(original); walk(restored); }
    expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(original));
  } finally { restored?.dispose(); original.dispose(); }
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

/** Pine's install parts as the trusted runtime builds them, with a day-night clock the test holds (headless has none yet). */
function pineParts(dusk?: number, night = 0): PineInstall {
  const bytes = readFileSync(PINE_NAVMESH_ASSET), nav = parseNavmesh(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  if (nav === null) throw new Error('navmesh');
  nav.datum = () => 0;
  return { bake, grid: pineTerrainGrid(assets.get(PINE_TERRAIN_ASSET)), nav, heightAt, spawnY: source.spawn.y,
    ...(dusk === undefined && night === 0 ? {} : { dusk: () => dusk ?? 0, night: () => night }) };
}
function bootWith(parts: PineInstall, level: SimLevel = plan.level): { host: SimHost } & ReturnType<typeof installPine> {
  const host = createSimHost(level, { ...plan.ports, rapier });
  return { host, ...installPine(host, parts) };
}
function restoreWith(parts: PineInstall, saved: SimSnapshot, level: SimLevel = plan.level): SimHost {
  const decoded = roundTrip(saved);
  return restoreSimHost(level, { ...plan.ports, rapier }, decoded, fresh => { fresh.setHeightQuery(heightAt); installPine(fresh, { ...parts, saved: decoded }); });
}
function exactAfter(parts: PineInstall, original: SimHost, ticks: number, level: SimLevel = plan.level): void {
  const saved = snapshotSimHost(original), restored = restoreWith(parts, saved, level);
  try {
    expectSameSimSnapshot(snapshotSimHost(restored), saved);
    for (let tick = 0; tick < ticks; tick++) { original.step(still); restored.step(still); }
    expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(original));
  } finally { restored.dispose(); }
}

it('respawns a felled elite as a live spawn: the manager\'s next entity id (168), the stream\'s draws, scripted at its lair; restore reinstalls it', () => {
  const parts = pineParts(), { host, elites, roster } = bootWith(parts);
  try {
    const boar = standByElite(host, 'ironhide', 40);
    host.combat.hit({ source: host.player.health, sourceTags: ['dmg.melee', 'cover.checked'], target: boar.combatActor(), amount: boar.maxHp * 10, point: boar.position.clone(), dir: new Vector3() });
    host.step(still);
    const entry = elites.core.entries[0];
    expect(entry?.state).toBe('dead');
    if (entry === undefined) throw new Error('no ironhide');
    entry.timer = 0.05; // the 20 minutes, spent
    for (let tick = 0; tick < 6; tick++) host.step(still);
    const fresh = host.entities.get('creature:168'), lair = PINE_ELITE_DEFS['ironhide']?.lair;
    // the load-time list and the prewarm took creature:0–167 (157 swapped out at boot): the next is 168; 40 m off, he is aware
    expect(entry.state).toBe('aware'); expect(elites.scripts[0].animal?.entityId).toBe('creature:168');
    expect([fresh?.kind, fresh?.variant, fresh?.scripted, fresh?.state, fresh?.alive]).toEqual(['boar', 'ironhide', true, 'sidestep', true]);
    expect(Math.hypot((fresh?.position.x ?? 0) - (lair?.x ?? 0), (fresh?.position.z ?? 0) - (lair?.z ?? 0))).toBeLessThan(2);
    expect(roster.bodies().length).toBe(165); expect(roster.bodies().at(-1)?.id).toBe('creature:168'); // the corpse stays in the list
    expect(host.entities.get(boar.entityId)?.alive).toBe(false);
    exactAfter(parts, host, 120);
  } finally { host.dispose(); }
}, 30_000);

/** Boot with a held dusk, stand by the Imperial Bull and run until his bugle brings his rivals in (live spawns). */
function bugled(): { parts: PineInstall; host: SimHost; bull: ImperialBull<PineHuntBody> } {
  const parts = pineParts(1), { host, elites } = bootWith(parts), bull = elites.scripts[3];
  standByElite(host, 'imperial', 30);
  for (let tick = 0; tick < 900 && bull.rivals.length === 0; tick++) host.step(still);
  return { parts, host, bull };
}

// one boot and one checkpoint: the bugle's live spawns are asserted on their way in, the checkpoint is taken mid-charge
// (a restore there reinstalls both live spawns and continues their lanes)
it('bugles at dusk: the Imperial Bull calls two rival bulls in as live spawns (the next entity ids); they charge the player down their lanes, restored exactly mid-charge', () => {
  const { parts, host, bull } = bugled();
  try {
    expect(bull.rivals.map(r => [r.a.entityId, r.a.kind, r.a.variant, r.a.scripted, r.mode])).toEqual([['creature:168', 'elk', 'big-bull', true, 'approach'], ['creature:169', 'elk', 'bull', true, 'approach']]);
    let charging = false;
    for (let i = 0; i < 1500 && !charging; i++) { host.step(still); charging = bull.rivals.some(r => r.mode === 'charge'); }
    expect(charging).toBe(true);
    exactAfter(parts, host, 60);
  } finally { host.dispose(); }
}, 30_000);

it('roots the player where Old Blackpaw\'s roar catches them for 1.3 s (the page\'s effect.stun), and restores mid-stun', () => {
  const parts = pineParts(), { host } = bootWith(parts);
  try {
    standByElite(host, 'black-old', 5);
    const before = host.player.health.attributes.health, walkOn = { moveX: 1, moveZ: 0, yaw: 0 };
    let tick = 0;
    for (; tick < 300 && host.player.health.attributes.health === before; tick++) host.step(still);
    expect(host.player.health.attributes.health).toBeLessThan(before);
    host.step(walkOn);
    const held = host.player.position.clone();
    for (let i = 0; i < 30; i++) host.step(walkOn);
    expect(host.player.position.distanceTo(held)).toBeLessThan(1e-6);
    exactAfter(parts, host, 30);
    // free again once the 1.3 s run out (the cave's rock stops the walk a little further on)
    for (let i = 0; i < 90; i++) host.step(walkOn);
    expect(host.player.position.distanceTo(held)).toBeGreaterThan(0.2);
  } finally { host.dispose(); }
}, 30_000);

it('the Antler King comes at night on the boss row: his prewarm body (creature:161), the intro, phase II\'s thralls as live spawns, restored exactly mid-fight', () => {
  const parts = pineParts(undefined, 1), { host, king } = bootWith(parts);
  try {
    // the player walks in through the stones' south gap: inside them (22 m) the fog closes and the intro runs
    const at = new Vector3(KINGS_CLEARING.x, heightAt(KINGS_CLEARING.x, KINGS_CLEARING.z + 12) + 0.3, KINGS_CLEARING.z + 12);
    host.player.motor.resetAt(at); host.player.position.copy(at);
    const states = new Set<string>();
    for (let tick = 0; tick < 600 && king.boss.state !== 'fight'; tick++) { host.step(still); states.add(king.boss.state); }
    expect([...states]).toEqual(['intro', 'fight']); // armed and in the stones on the same tick
    const body = king.fight.king;
    expect([body?.entityId, body?.kind, body?.scripted]).toEqual(['creature:161', 'antler-king', true]);
    expect(king.fight.hpFrac).toBe(1);
    // past 60 %: the beat, then the lanterns fall and he rings his bells for two thralls (the next entity ids)
    if (body === null) throw new Error('no King');
    body.hp = Math.round(body.maxHp * 0.55);
    for (let tick = 0; tick < 900 && !host.entities.has('creature:169'); tick++) host.step(still);
    expect(king.boss.phase).toBe(1);
    expect(['creature:168', 'creature:169'].map(id => { const a = host.entities.get(id); return [a?.kind, a?.variant, a?.scripted]; })).toEqual([['elk', 'thrall', true], ['boar', 'thrall', true]]);
    exactAfter(parts, host, 60);
  } finally { host.dispose(); }
}, 30_000);

it('steps the page\'s own day clock: a witness started just before dusk (SimLevel.day) hears the Imperial Bull bugle on his own; the clock restores exactly', () => {
  const level: SimLevel = { ...plan.level, day: { start: PINE_PHASES.dusk - 0.002 } }, parts = pineParts(), { host, elites } = bootWith(parts, level), bull = elites.scripts[3];
  try {
    expect(host.dayClock?.dusk ?? 0).toBeGreaterThan(0.5);
    standByElite(host, 'imperial', 30);
    for (let tick = 0; tick < 900 && bull.rivals.length === 0; tick++) host.step(still);
    expect(bull.rivals.map(r => r.a.entityId)).toEqual(['creature:168', 'creature:169']);
    expect(snapshotSimHost(host).day).toBeDefined();
    exactAfter(parts, host, 60, level);
  } finally { host.dispose(); }
}, 30_000);


/** Pine's parts with a night the test turns (a held dusk-free clock) and the facts the King files. */
function kingParts(): { parts: PineInstall; clock: { night: number }; facts: string[] } {
  const clock = { night: 1 }, facts: string[] = [];
  return { clock, facts, parts: { ...pineParts(), night: () => clock.night, fact: (name, entity) => { facts.push(`${name}/${entity}`); } } };
}
/** Stand the player `d` m south of the King's clearing, on the ground. */
function standAtClearing(host: SimHost, d: number): void {
  const at = new Vector3(KINGS_CLEARING.x, heightAt(KINGS_CLEARING.x, KINGS_CLEARING.z + d) + 0.3, KINGS_CLEARING.z + d);
  host.player.motor.resetAt(at); host.player.position.copy(at);
}

it('parks the Antler King by day (out of sight, kept for tonight) and a restore keeps him hidden', () => {
  const { parts, clock } = kingParts(), { host, king } = bootWith(parts);
  try {
    standAtClearing(host, 50); // within 80 m, outside the stones: he comes and waits
    host.step(still);
    expect([king.boss.state, king.fight.king?.entityId, king.fight.king?.hidden]).toEqual(['armed', 'creature:161', false]);
    clock.night = 0; host.step(still);
    expect([king.boss.state, king.fight.king?.entityId, king.fight.king?.hidden]).toEqual(['dormant', 'creature:161', true]);
    const saved = snapshotSimHost(host), restored = restoreWith(parts, saved);
    try {
      expect(restored.entities.get('creature:161')).toMatchObject({ kind: 'antler-king', hidden: true });
      expectSameSimSnapshot(snapshotSimHost(restored), saved);
    } finally { restored.dispose(); }
  } finally { host.dispose(); }
}, 30_000);

it('keeps the King\'s record on the shard\'s flags: his fall pays the bow once and files his fact; by day he goes, the next night a fresh King (the next entity id), restored exactly', () => {
  const { parts, clock, facts } = kingParts(), { host, king } = bootWith(parts);
  /** walk in through the south gap, sit out the intro, fell him with one blow */
  const fell = (): void => {
    standAtClearing(host, 12);
    for (let tick = 0; tick < 600 && king.boss.state !== 'fight'; tick++) host.step(still);
    const body = king.fight.king;
    if (body === null || king.boss.state !== 'fight') throw new Error('no King fight');
    host.combat.hit({ source: host.player.health, sourceTags: ['dmg.melee', 'cover.checked'], target: body.combatActor(), amount: body.maxHp * 10, point: body.position.clone(), dir: new Vector3() });
    host.step(still);
  };
  try {
    expect(host.flags.has('dead:king')).toBe(false);
    fell();
    expect(king.boss.state).toBe('victory');
    expect(['dead:king', 'paid:king'].map(f => host.flags.has(f))).toEqual([true, true]);
    expect(facts).toEqual(['pine.feat.king/king:1']);
    // by day the fallen King goes (his body retired); the next night he is back, a fresh body at the stones
    clock.night = 0; host.step(still);
    expect([king.boss.state, king.fight.king, host.entities.has('creature:161')]).toEqual(['dormant', null, false]);
    clock.night = 1; standAtClearing(host, 50); host.step(still);
    const next = king.fight.king;
    expect([king.boss.state, next?.entityId, next?.kind, next?.variant, next?.scripted, next?.alive, king.fight.hpFrac]).toEqual(['armed', 'creature:168', 'antler-king', 'warden', true, true, 1]);
    expect(Math.hypot((next?.position.x ?? 0) - KINGS_CLEARING.x, (next?.position.z ?? 0) - KINGS_CLEARING.z)).toBeLessThan(1);
    exactAfter(parts, host, 30);
    // a re-fight: the record counts him twice, the bow is not paid again
    fell();
    expect([king.boss.state, king.boss.snapshot().saved]).toEqual(['victory', { defeated: true, rewardTaken: true, kills: 2 }]);
    expect(facts).toEqual(['pine.feat.king/king:1', 'pine.feat.king/king:1']);
  } finally { host.dispose(); }
}, 30_000);

it('fires the crossbow as a real projectile: a bolt flies to a boar and lands the damage model\'s blow through the host; the bow reloads itself; restored exactly mid-flight', () => {
  const shots: string[] = [], parts: PineInstall = { ...pineParts(), shots: () => shots }, { host, crossbow } = bootWith(parts);
  try {
    const id = standBy(host, 'boar', 14), boar = host.entities.get(id);
    if (boar === undefined) throw new Error('no boar');
    const hp = boar.hp;
    shots.push(id); host.step(still); shots.length = 0;
    expect([crossbow.flying(), crossbow.state.loaded, crossbow.state.quiver]).toEqual([1, false, 29]);
    exactAfter(parts, host, 30); // mid-flight: the bolt is the bow's continuation
    expect(crossbow.flying()).toBe(0);
    expect(boar.hp).toBeLessThan(hp);
    expect(hp - boar.hp).toBeGreaterThanOrEqual(19); // 32-40, ×2.5 on the head, less the range's falloff (none at 14 m)
    // a pull while it is spent: the reload starts at once (1.35 s), then it is loaded again
    shots.push(id); host.step(still); shots.length = 0;
    expect(crossbow.state.reloading).toBe(true);
    for (let tick = 0; tick < 90; tick++) host.step(still);
    expect([crossbow.state.loaded, crossbow.state.reloading]).toEqual([true, false]);
  } finally { host.dispose(); }
}, 30_000);

it('takes the King\'s bark at ×0.25 and his ribcage at ×0.6 shut, and a bolt passes a faded (hidden) body', () => {
  const { parts } = kingParts(), { host, king } = bootWith(parts);
  try {
    standAtClearing(host, 12);
    for (let tick = 0; tick < 600 && king.boss.state !== 'fight'; tick++) host.step(still);
    const body = king.fight.king;
    if (body === null) throw new Error('no King');
    const hit = (point: Vector3): number => {
      const before = body.hp;
      host.combat.hit({ source: host.player.health, sourceTags: ['weapon.crossbow', 'cover.checked'], target: body.combatActor(), amount: 100, point, dir: new Vector3() });
      return before - body.hp;
    };
    const a = new Vector3(), b = new Vector3();
    body.bodyCapsule(a, b);
    expect(hit(a.clone())).toBe(25); // the haunch: bark
    expect(hit(a.clone().lerp(b, 0.75))).toBe(60); // the chest: the ribcage, shut
    // the bodyHit test skips a hidden body (the Ghost Stag's fade, a parked King)
    const from = new Vector3(b.x + 10, b.y, b.z), dir = new Vector3(-1, 0, 0);
    expect(bodyHit([body], from, dir, 30)?.body).toBe(body);
    // the analytic cast reaches a body 100 m off (a rifle's line), short of its axis by its girth
    const far = bodyHit([body], new Vector3(b.x + 100, b.y, b.z), dir, 320)?.distance ?? Infinity;
    expect(far).toBeGreaterThan(97); expect(far).toBeLessThan(100);
    body.hidden = true;
    expect(bodyHit([body], from, dir, 30)).toBeNull();
  } finally { host.dispose(); }
}, 30_000);

/** Hold the tick's weapon pick, trigger pulls and HEAVY hold as a tape would (the trusted runtime reads them from commands). */
function armed(): { parts: PineInstall; tick: { pick: number | null; shots: string[]; heavy: { targetId?: string } | null } } {
  const tick: { pick: number | null; shots: string[]; heavy: { targetId?: string } | null } = { pick: null, shots: [], heavy: null };
  return { tick, parts: { ...pineParts(), pick: () => tick.pick, shots: () => tick.shots, heavy: () => tick.heavy } };
}
/** Step `n` ticks standing still, the tick's inputs cleared after the first. */
function stepFor(host: SimHost, tick: ReturnType<typeof armed>['tick'], n: number): void {
  for (let i = 0; i < n; i++) { host.step(still); tick.pick = null; tick.shots = []; }
}

it('swaps weapons on the `pine.weapon` command as the page\'s EquipmentService: only owned ones, 0.25 s out then 0.25 s in with no trigger live, restored exactly mid-swap', () => {
  const { parts, tick } = armed(), { host, loadout, crossbow } = bootWith(parts);
  try {
    const id = standBy(host, 'boar', 14);
    tick.pick = PINE_WEAPON.lever; stepFor(host, tick, 1);
    expect([loadout.held(), loadout.swapping()]).toEqual([PINE_WEAPON.crossbow, false]); // the cabin's rifle is not owned yet
    host.flags.set(LEVER_FLAG);
    tick.pick = PINE_WEAPON.lever; stepFor(host, tick, 1);
    expect([loadout.held(), loadout.swapping(), loadout.live(PINE_WEAPON.crossbow)]).toEqual([PINE_WEAPON.crossbow, true, false]);
    tick.shots = [id]; stepFor(host, tick, 1);
    expect(crossbow.state.loaded).toBe(true); // mid-swap: the trigger is dead
    exactAfter(parts, host, 16); // across the switch at 0.25 s
    expect([loadout.held(), loadout.swapping()]).toEqual([PINE_WEAPON.lever, true]);
    stepFor(host, tick, 16);
    expect([loadout.held(), loadout.swapping(), loadout.live(PINE_WEAPON.lever)]).toEqual([PINE_WEAPON.lever, false, true]);
    tick.pick = PINE_WEAPON.longbow; stepFor(host, tick, 1);
    expect(loadout.swapping()).toBe(false); // the longbow is the King's reward
  } finally { host.dispose(); }
}, 30_000);

it('fires the lever-action on the page\'s action: a hitscan round lands the damage model\'s blow ×1.5, the lever cycles the next one in; a dry pull reloads through the gate, a pull mid-reload stops after the round in hand; restored exactly mid-cycle', () => {
  const { parts, tick } = armed(), { host, lever } = bootWith(parts);
  try {
    host.flags.set(LEVER_FLAG);
    tick.pick = PINE_WEAPON.lever; stepFor(host, tick, 31);
    const id = standBy(host, 'boar', 14), boar = host.entities.get(id);
    if (boar === undefined) throw new Error('no boar');
    const hp = boar.hp;
    tick.shots = [id]; stepFor(host, tick, 1);
    expect(boar.hp).toBeLessThan(hp);
    expect([lever.act.phase, lever.act.rounds]).toEqual(['beat', 6]);
    tick.shots = [id]; stepFor(host, tick, 1);
    expect(lever.act.rounds).toBe(6); // no second shot before the throw
    exactAfter(parts, host, 20); // into the throw
    stepFor(host, tick, 30);
    expect([lever.act.phase, lever.act.chambered, lever.act.tube]).toEqual(['idle', true, 5]);
    // run it dry: a pull on an empty gun clicks and reloads, a pull mid-reload stops it after the round in hand
    lever.act.tube = 0; lever.act.chambered = false;
    tick.shots = [id]; stepFor(host, tick, 1);
    expect([lever.act.phase, lever.act.dryAtStart]).toEqual(['reload', true]);
    stepFor(host, tick, 40);
    expect([lever.act.fed, lever.store.reserve]).toEqual([1, 20]);
    tick.shots = [id]; stepFor(host, tick, 1);
    stepFor(host, tick, 30);
    expect([lever.act.phase, lever.act.fed, lever.store.reserve]).toEqual(['cycle', 2, 19]); // the gun run dry is cycled at the end
    stepFor(host, tick, 40);
    expect([lever.act.phase, lever.act.chambered, lever.act.tube]).toEqual(['idle', true, 1]);
  } finally { host.dispose(); }
}, 30_000);

it('draws the longbow on the HEAVY hold and looses only at full: an arrow flies to the named boar and lands its blow; an early release lets down; restored exactly mid-flight', () => {
  const { parts, tick } = armed(), { host, longbow } = bootWith(parts);
  try {
    host.flags.set('paid:king');
    tick.pick = PINE_WEAPON.longbow; stepFor(host, tick, 31);
    const id = standBy(host, 'boar', 14), boar = host.entities.get(id);
    if (boar === undefined) throw new Error('no boar');
    const hp = boar.hp;
    tick.heavy = { targetId: id }; stepFor(host, tick, 20); tick.heavy = null; stepFor(host, tick, 1);
    expect([longbow.flying(), longbow.state.arrows, longbow.draw.drawT > 0]).toEqual([0, 20, true]); // let down
    stepFor(host, tick, 30);
    tick.heavy = { targetId: id }; stepFor(host, tick, 50); tick.heavy = null; stepFor(host, tick, 1);
    expect([longbow.flying(), longbow.state.arrows]).toEqual([1, 19]);
    exactAfter(parts, host, 4); // mid-flight: the arrow and the re-nock are the bow's continuation
    stepFor(host, tick, 20);
    expect(longbow.flying()).toBe(0);
    expect(boar.hp).toBeLessThan(hp);
  } finally { host.dispose(); }
}, 30_000);
