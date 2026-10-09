// oxlint-disable-next-line import/no-nodejs-modules -- Initialize the actual native physics engine.
import { readFileSync } from 'node:fs';
import { Vector3 } from 'three';
import * as v from 'valibot';
import { beforeAll, expect, it } from 'vitest';
import { createSimHost, type SimHost } from '../../src/engine/sim';
import type { AnimalSim } from '../../src/engine/entities/AnimalSim';
import type { BossScript } from '../../src/engine/ai/BossBrain';
import { decodeSimSnapshot, restoreSimHost, serializeSimSnapshot, snapshotSimHost } from '../../src/engine/sim/snapshot';
import { loadRapier, type Rapier } from '../../src/engine/physics/rapier';
import { bossFlagRecord, installBossRow } from '../../src/game/shardfile/bossRow';
import { SIM_LEVEL } from '../fixtures/sim-level/level';

let rapier: Rapier;
beforeAll(async () => { rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); });
const level = { ...SIM_LEVEL, entities: [], quests: [] };
const recipe = SIM_LEVEL.entities[0];
if (recipe?.spec === undefined) throw new Error('Missing native fixture recipe');
const native = recipe.spec;
const STEP = 'fixture.boss', NAMES = { defeated: 'fixture.boss.beaten', paid: 'fixture.boss.paid' };
const definition = { id: STEP, name: 'Boss', title: 'Fixture', retryTitle: 'Again', intro: 0.5, introShort: 0.2, phases: [{ at: 1, caption: 'One', name: 'One' }], reward: {} };

/** A boss on a fixture level: one body spawned at install, a script whose own state counts its ticks, a shield the test holds. */
function install(host: SimHost): { fight: { ticks: number; shield: boolean; rewards: number }; row: ReturnType<typeof installBossRow>; body: AnimalSim } {
  // a restore reinstalls the same trusted recipe before the host restores its state
  const body = host.spawn({ id: 'fixture.boss:body', spec: native, seed: 7, scale: 1, at: { x: 0, y: 0, z: 6 }, yaw: 0 });
  const fight = { ticks: 0, shield: false, rewards: 0 }, point = new Vector3(0, 0, 6);
  const script: BossScript = { inArena: () => true, reset: () => undefined, seal: () => undefined, intro: () => point, begin: () => undefined, enterPhase: () => undefined,
    update: () => { fight.ticks++; }, get hpFrac() { return body.alive ? body.hp / body.maxHp : 0; }, get shielded() { return fight.shield; }, get dead() { return !body.alive; },
    clampHp: () => undefined, setInvulnerable: () => undefined, victory: () => undefined, rewardPoint: () => point, respawnPoint: () => ({ pos: new Vector3(0, 0, -4), yaw: 0 }) };
  const record = bossFlagRecord(host.flags, NAMES);
  const row = installBossRow(host, { step: STEP, definition, script, body: () => body, shielded: () => fight.shield, saved: record.saved, persist: record.persist, armed: true,
    spawnReward: () => { fight.rewards++; },
    fight: { snapshot: () => ({ ticks: fight.ticks }), restore: value => { fight.ticks = v.parse(v.object({ ticks: v.number() }), value).ticks; } } });
  return { fight, row, body };
}
function hit(host: SimHost, body: AnimalSim, amount: number): void {
  host.combat.hit({ source: host.player.health, sourceTags: ['actor.player'], target: body.combatActor(), amount, point: body.position.clone(), dir: new Vector3(0, 0, 1), from: host.player.position.clone(), moveId: 'test.hit' });
}

it('keeps the record on the shard flags: beaten and paid start the brain, persist writes them back', () => {
  const flags = new Set<string>(), store = { has: (flag: string) => flags.has(flag), set: (flag: string) => { flags.add(flag); } };
  expect(bossFlagRecord(store, NAMES).saved).toEqual({ defeated: false, rewardTaken: false, kills: 0 });
  bossFlagRecord(store, NAMES).persist({ defeated: true, rewardTaken: false, kills: 1 });
  expect(bossFlagRecord(store, NAMES).saved).toEqual({ defeated: true, rewardTaken: false, kills: 1 });
});

it('runs an armed boss through the intro (weapons locked), refuses hits while shielded, and wins by gameplay once', () => {
  const host = createSimHost(level, { rapier }), { fight, row, body } = install(host);
  try {
    expect(row.boss.state).toBe('armed');
    host.step(); expect(row.locked()).toBe(true);
    for (let tick = 0; tick < 40; tick++) host.step();
    expect(row.boss.state).toBe('fight'); expect(row.locked()).toBe(false);
    const hp = body.hp; fight.shield = true; hit(host, body, 5); expect(body.hp).toBe(hp);
    fight.shield = false; hit(host, body, 5); expect(body.hp).toBe(hp - 5);
    hit(host, body, 10_000);
    for (let tick = 0; tick < 240; tick++) host.step();
    expect(row.boss.state).toBe('victory'); expect(row.boss.defeated).toBe(true); expect(fight.rewards).toBe(1);
    expect(host.flags.has(NAMES.defeated)).toBe(true);
  } finally { host.dispose(); }
});

it('restores the brain and the script\'s own state as one continuation, exactly', () => {
  const original = createSimHost(level, { rapier }), made = install(original);
  let restored: SimHost | undefined;
  try {
    for (let tick = 0; tick < 50; tick++) original.step();
    hit(original, made.body, 5);
    const saved = decodeSimSnapshot(serializeSimSnapshot(snapshotSimHost(original)));
    let twin: ReturnType<typeof install> | undefined;
    restored = restoreSimHost(level, { rapier }, saved, host => { twin = install(host); });
    expect(snapshotSimHost(restored)).toEqual(snapshotSimHost(original));
    expect(twin?.fight.ticks).toBe(made.fight.ticks); expect(twin?.row.boss.state).toBe('fight');
    for (let tick = 0; tick < 60; tick++) { original.step(); restored.step(); }
    expect(serializeSimSnapshot(snapshotSimHost(restored))).toBe(serializeSimSnapshot(snapshotSimHost(original)));
  } finally { restored?.dispose(); original.dispose(); }
});
