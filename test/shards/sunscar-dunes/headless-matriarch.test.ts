// oxlint-disable-next-line import/no-nodejs-modules -- The headless runtime reads the shard's admitted in-tree bytes and the native physics module.
import { readFileSync } from 'node:fs';
import { Vector3 } from 'three';
import * as v from 'valibot';
import { beforeAll, expect, it } from 'vitest';
import { createSimHost, type SimHost } from '../../../src/engine/sim';
import type { AnimalSim } from '../../../src/engine/entities/AnimalSim';
import { decodeSimSnapshot, restoreSimHost, serializeSimSnapshot, snapshotSimHost } from '../../../src/engine/sim/snapshot';
import { expectSameSimSnapshot } from '../../fake/simSnapshot';
import { loadRapier, type Rapier } from '../../../src/engine/physics/rapier';
import type { HeadlessRuntimePlan } from '../../../src/sdk/headlessRuntime';
import type { HeadlessCommand, HeadlessEffect } from '../../../src/sdk/tickProtocol';
import source from '../../../src/shards/sunscar-dunes/shard.config';
import { SCOUT_FLAG } from '../../../src/shards/sunscar-dunes/data/flags';
import { BASIN } from '../../../src/shards/sunscar-dunes/data/layout';
import { COMPLETE_FLAG, MATRIARCH_FLAG } from '../../../src/shards/sunscar-dunes/quests/signal';
import { MATRIARCH_ID } from '../../../src/shards/sunscar-dunes/data/matriarchFight';
import { WHIP_STEP } from '../../../src/shards/sunscar-dunes/data/headless';
import { prepareHeadlessRuntime, signalSpots } from '../../../src/shards/sunscar-dunes/runtime/headless';
import type { QuestGraphSpot as SignalSpot } from '../../../src/game/quest/questGraph';
import { SIGNAL_ACT, SIGNAL_INTERACT } from '../../../src/shards/sunscar-dunes/quests/interactions';

let rapier: Rapier, plan: HeadlessRuntimePlan;
const assets = new Map(source.files.map(file => [file.hash, new Uint8Array(readFileSync(`src/shards/sunscar-dunes/assets/${file.hash}`))]));
beforeAll(async () => {
  rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
  plan = await prepareHeadlessRuntime({ shard: source, assets, rapier });
});
interface Run { host: SimHost; effects: HeadlessEffect[]; tape: HeadlessCommand[] }
function context(run: Omit<Run, 'host'>, restoring: boolean, snapshot?: ReturnType<typeof decodeSimSnapshot>) {
  return { restoring, ...(snapshot === undefined ? {} : { snapshot }), commands: () => run.tape, emit: (effect: HeadlessEffect) => { run.effects.push(effect); } };
}
function boot(): Run {
  const run = { effects: [] as HeadlessEffect[], tape: [] as HeadlessCommand[] }, host = createSimHost(plan.level, { ...plan.ports, rapier });
  plan.install(host, context(run, false)); return Object.assign(run, { host });
}
function restore(saved: string): Run {
  const run = { effects: [] as HeadlessEffect[], tape: [] as HeadlessCommand[] }, decoded = decodeSimSnapshot(saved), ports = { ...plan.ports, rapier };
  const host = restoreSimHost(plan.level, ports, decoded, fresh => { if (ports.heightAt !== undefined) fresh.setHeightQuery(ports.heightAt); plan.install(fresh, context(run, true, decoded)); });
  return Object.assign(run, { host });
}
/** One tick as the trusted adapter runs it: the commands are lent to the runtime, the player command steps the host. */
function tick(run: Run, commands: HeadlessCommand[] = []): void {
  run.tape = commands;
  try {
    const player = commands.find(command => command.kind === 'player');
    run.host.step(player?.kind === 'player' ? { moveX: player.moveX, moveZ: player.moveZ, yaw: player.yaw, ...(player.attack === undefined ? {} : { attack: player.attack }) } : { moveX: 0, moveZ: 0, yaw: run.host.player.yaw });
  } finally { run.tape = []; }
}
const spot = (list: readonly SignalSpot[], id: string): SignalSpot => { const found = list.find(s => s.id === id); if (found === undefined) throw new Error(`missing spot ${id}`); return found; };
/** A crack is the whip's own (its row's cooldown gates it): a player lets the lash recover a second before the next one. */
const CRACKS = new Set<number>([SIGNAL_ACT.crank, SIGNAL_ACT.light, SIGNAL_ACT.light + 1, SIGNAL_ACT.light + 2]);
function act(run: Run, value: number, at: SignalSpot): void {
  if (CRACKS.has(value)) for (let i = 0; i < 60; i++) tick(run);
  run.host.player.position.set(at.x, at.y - 1, at.z + 0.3);
  tick(run, [{ kind: 'script', actorId: SIGNAL_INTERACT, value }]);
  if (!CRACKS.has(value)) return;
  for (let i = 0; i < 120; i++) {
    const saved = snapshotSimHost(run.host).adapters.find(adapter => adapter.id === WHIP_STEP)?.state;
    if (typeof saved !== 'string') throw new Error('missing lash continuation');
    const state = v.parse(v.object({ crackT: v.number() }), JSON.parse(saved));
    if (state.crackT < 0) return;
    tick(run);
  }
  throw new Error('Signal lash did not finish within its bounded recovery window');
}
/** The quest's own steps up to the signal fire (each act at its baked spot). */
function lightTheSignal(run: Run): void {
  const { interact, crack } = signalSpots();
  tick(run); tick(run); run.host.flags.set(SCOUT_FLAG);
  act(run, SIGNAL_ACT.logbook, spot(interact, 'logbook'));
  act(run, SIGNAL_ACT.crank, spot(crack, 'well.crank'));
  act(run, SIGNAL_ACT.well, spot(interact, 'well'));
  for (let i = 0; i < 3; i++) { act(run, SIGNAL_ACT.pour + i, spot(interact, `brazier.${String(i)}`)); act(run, SIGNAL_ACT.light + i, spot(crack, `brazier.${String(i)}`)); }
  act(run, SIGNAL_ACT.fire, spot(interact, 'fire'));
}
/**
 * The fighter's tape: circle a stand on the basin floor (10 m round it, at the walk speed) and lash her whenever her body
 * comes within 8 m; once she is grounded, walk in on her. Commands only, from the host's own state.
 */
const STAND = { x: BASIN.x, z: BASIN.z + 12 };
function fight(run: Run): void {
  const t = run.host.state.tick / 60, goal = { x: STAND.x + Math.sin(t * 0.5) * 10, z: STAND.z + Math.cos(t * 0.5) * 10 };
  const p = run.host.player.position, her = run.host.entities.get(MATRIARCH_ID), grounded = her !== undefined && (her.mem['phase'] ?? 0) >= 2;
  if (grounded) { goal.x = her.position.x; goal.z = her.position.z; }
  const dx = goal.x - p.x, dz = goal.z - p.z, d = Math.hypot(dx, dz), walk = d > (grounded ? 5 : 1);
  const reach = her !== undefined && her.alive && her.position.distanceTo(p) < 8;
  tick(run, [{ kind: 'player', moveX: walk ? dx / d : 0, moveZ: walk ? dz / d : 0, yaw: run.host.player.yaw, ...(reach ? { attack: { targetId: MATRIARCH_ID } } : {}) }]);
}
interface Encounter { state: string; phase: number; checkpoint: number; attempts: number; storm: number; invulnerable: boolean; saved: { defeated: boolean; rewardTaken: boolean; kills: number } }
function encounter(run: Run): Encounter {
  const saved = snapshotSimHost(run.host).adapters.find(adapter => adapter.id === MATRIARCH_ID)?.state;
  if (typeof saved !== 'string') throw new Error('missing Matriarch continuation');
  const value = JSON.parse(saved) as { boss: Omit<Encounter, 'storm' | 'invulnerable'>; fight: { storm: number; invulnerable: boolean } };
  return { ...value.boss, storm: value.fight.storm, invulnerable: value.fight.invulnerable };
}
function until(run: Run, done: (e: Encounter) => boolean, limit = 30_000): void {
  for (let i = 0; i < limit; i++) { fight(run); if (i % 30 === 0 && done(encounter(run))) return; }
  throw new Error(`fight did not reach the expected state: ${JSON.stringify(encounter(run))}`);
}
const her = (run: Run): AnimalSim => { const actor = run.host.entities.get(MATRIARCH_ID); if (actor === undefined) throw new Error('no Matriarch body'); return actor; };
/** A blow through the host's combat pipeline (the damage gates, her invulnerability and death all apply). */
function blow(run: Run, amount: number): void {
  const actor = her(run);
  run.host.combat.hit({ source: run.host.player.health, sourceTags: ['actor.player'], target: actor.combatActor(), amount, point: actor.position.clone(), dir: new Vector3(0, 0, 1), from: actor.position.clone(), moveId: 'test.blow' });
}
const save = (run: Run): string => serializeSimSnapshot(snapshotSimHost(run.host));
const ofKind = (effects: readonly HeadlessEffect[]): string[] => effects.map(effect => effect.kind === 'fact' ? `fact:${effect.name}` : `coins:${String(effect.amount)}`);

it('rises on the signal fire, holds the whip through her intro, and the whip\'s cracks carry her into the storm', () => {
  const run = boot();
  try {
    lightTheSignal(run);
    expect(encounter(run).state).toBe('armed');
    const body = her(run);
    expect([body.hp, body.scale, body.mem['fight'], body.mem['rise']]).toEqual([600, 3.6, 0, 0]);
    run.host.player.position.set(STAND.x, run.host.groundHeightAt(STAND.x, STAND.z) + 0.1, STAND.z);
    tick(run);
    expect(encounter(run).state).toBe('intro');
    // locked: no crack fires, so the lash's cooldown (left from the last waymark's crack) only runs down
    const cooldown = (): number => { const state = snapshotSimHost(run.host).adapters.find(a => a.id === WHIP_STEP)?.state; return typeof state === 'string' ? v.parse(v.object({ cooldown: v.number() }), JSON.parse(state)).cooldown : Number.NaN; };
    const before = cooldown();
    tick(run, [{ kind: 'player', moveX: 0, moveZ: 0, yaw: 0, attack: { targetId: MATRIARCH_ID } }]);
    expect(cooldown()).toBeCloseTo(Math.max(0, before - 1 / 60), 9); expect(cooldown()).toBeLessThan(0.45);
    until(run, e => e.state === 'fight');
    until(run, e => e.phase === 1);
    expect(her(run).hp).toBe(600 * 0.66); // clamped at the threshold, never past it
    const beat = encounter(run);
    expect(beat.state).toBe('beat'); expect(beat.invulnerable).toBe(true); expect(beat.checkpoint).toBe(1);
    blow(run, 50);
    expect(her(run).hp).toBe(600 * 0.66); // the beat's shield answers damage.modify
    until(run, e => e.state === 'fight' && e.storm > 0.5);
    expect(her(run).mem['phase']).toBe(1);
    expect(run.effects).toEqual([]);
  } finally { run.host.dispose(); }
});

it('a death in her fight answers the checkpoint: back at the basin rim, her body fresh at the phase reached', () => {
  const run = boot();
  try {
    lightTheSignal(run); run.host.player.position.set(STAND.x, run.host.groundHeightAt(STAND.x, STAND.z) + 0.1, STAND.z);
    until(run, e => e.phase === 1 && e.state === 'fight');
    const seed = her(run).seed, attempts = encounter(run).attempts, actor = her(run);
    // Exercise checkpoint recovery through real lethal combat, rather than depending on this tape losing a fight.
    run.host.combat.hit({ source: actor.combatActor(), sourceTags: ['actor.creature'], target: run.host.player.health,
      amount: 10_000, point: run.host.player.position.clone(), dir: new Vector3(0, 0, 1), from: actor.position.clone(), moveId: 'test.checkpoint' });
    expect(run.host.player.health.alive).toBe(false);
    for (let i = 0; i < 240 && encounter(run).attempts === attempts; i++) tick(run);
    expect(encounter(run).attempts).toBe(attempts + 1);
    const p = run.host.player.position;
    expect(Math.hypot(p.x - BASIN.x, p.z - (BASIN.z + BASIN.r + 4))).toBeLessThan(1);
    expect(run.host.player.health.attributes.health).toBe(100);
    expect(her(run).seed).not.toBe(seed); // a fresh body: six new draws from the creature stream
    expect(her(run).hp).toBe(600 * 0.66);
    expect(encounter(run).checkpoint).toBe(1);
  } finally { run.host.dispose(); }
});

it('restores mid-fight (storm phase) exactly (canonical state), and the suffix of the same tape stays identical', () => {
  const original = boot(); let restored: Run | undefined;
  try {
    lightTheSignal(original); original.host.player.position.set(STAND.x, original.host.groundHeightAt(STAND.x, STAND.z) + 0.1, STAND.z);
    until(original, e => e.phase === 1 && e.state === 'fight' && e.storm > 0.3);
    const saved = save(original);
    restored = restore(saved);
    expectSameSimSnapshot(snapshotSimHost(restored.host), decodeSimSnapshot(saved));
    for (let i = 0; i < 1200; i++) { fight(original); fight(restored); }
    expectSameSimSnapshot(snapshotSimHost(restored.host), snapshotSimHost(original.host));
    expect(restored.effects).toEqual(original.effects);
  } finally { restored?.host.dispose(); original.host.dispose(); }
});

it('her fall sets the quest\'s last flag, emits her fact, completes the signal and pays once; a restore re-emits nothing', () => {
  const run = boot(); let restored: Run | undefined;
  try {
    lightTheSignal(run); run.host.player.position.set(STAND.x, run.host.groundHeightAt(STAND.x, STAND.z) + 0.1, STAND.z);
    until(run, e => e.state === 'fight');
    blow(run, 10_000);
    for (let i = 0; i < 120; i++) fight(run);
    const done = encounter(run);
    expect(done.state).toBe('victory'); expect(done.saved).toEqual({ defeated: true, rewardTaken: true, kills: 1 });
    expect(run.host.flags.has(MATRIARCH_FLAG)).toBe(true); expect(run.host.flags.has(COMPLETE_FLAG)).toBe(true);
    expect(ofKind(run.effects).sort()).toEqual(['coins:20', 'coins:5', 'fact:sunscar.matriarch', 'fact:sunscar.signal']);
    restored = restore(save(run));
    for (let i = 0; i < 120; i++) { fight(run); fight(restored); }
    expect(restored.effects).toEqual([]); expect(run.effects).toHaveLength(4);
    expect(save(restored)).toBe(save(run));
  } finally { restored?.host.dispose(); run.host.dispose(); }
});
