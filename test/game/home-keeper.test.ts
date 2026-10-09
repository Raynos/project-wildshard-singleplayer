// oxlint-disable-next-line import/no-nodejs-modules -- Initialize the actual native physics engine.
import { readFileSync } from 'node:fs';
import { Vector3 } from 'three';
import * as v from 'valibot';
import { beforeAll, expect, it } from 'vitest';
import { createSimHost, type SimHost } from '../../src/engine/sim';
import type { AnimalSim } from '../../src/engine/entities/AnimalSim';
import { decodeSimSnapshot, restoreSimHost, serializeSimSnapshot, snapshotSimHost, type SimSnapshot } from '../../src/engine/sim/snapshot';
import { loadRapier, type Rapier } from '../../src/engine/physics/rapier';
import { installHomeKeeper, type HomeKeeperSpec, type KeptHome } from '../../src/game/shardfile/homeKeeper';
import { SIM_LEVEL } from '../fixtures/sim-level/level';

let rapier: Rapier;
beforeAll(async () => { rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); });
const level = { ...SIM_LEVEL, entities: [], quests: [] };
const recipe = SIM_LEVEL.entities[0];
if (recipe === undefined) throw new Error('Missing native fixture recipe');
const native = recipe.spec;
const STEP = 'fixture.homes', ENCOUNTER = 'fixture.encounter';
const homes = [{ id: 'fixture.home:0', kind: 'blob', at: [6, 6] as const, yaw: 0, respawn: 1 }, { id: 'fixture.home:1', kind: 'blob', at: [-6, 6] as const, yaw: 1, respawn: 2 },
  { id: 'fixture.home:2', kind: 'blob', at: [0, -8] as const, yaw: 2, respawn: 1 }];
const boss = { id: 'fixture.boss', kind: 'blob', at: [12, -12] as const, yaw: 0 };

/** What the fixture's policies did: decisions and moves per body id, and every `beforeStep` view. */
interface Trace { decide: Map<string, number[]>; moves: Map<string, number>; before: string[][] }
function spec(trace: Trace, attackers = 1): HomeKeeperSpec {
  return { step: STEP, seed: 9, homes, boss, specs: new Map([['blob', native]]), scales: new Map([['blob', [0.8, 1.2] as const]]), attackers, think: { every: 6, dt: 0.1 },
    // each decision asks for an attack token, so the cap is observable in the keeper's continuation
    policy: (_kind: string, actor: AnimalSim, claim: (actor: AnimalSim) => boolean) => {
      let count = 0;
      return { decide: dt => { count++; claim(actor); trace.decide.set(actor.entityId, [...(trace.decide.get(actor.entityId) ?? []), dt]); },
        move: () => { trace.moves.set(actor.entityId, (trace.moves.get(actor.entityId) ?? 0) + 1); }, snapshot: () => count,
        restore: value => { count = v.parse(v.number(), value); } };
    },
    beforeStep: (view: readonly KeptHome[]) => { trace.before.push(view.map(home => home.id)); } };
}
const fresh = (): Trace => ({ decide: new Map(), moves: new Map(), before: [] });
/** The keeper, then a later step (the encounter) that draws the boss at tick 5: a body spawned in play. */
function install(host: SimHost, trace: Trace, saved?: Readonly<SimSnapshot>): ReturnType<typeof installHomeKeeper> {
  const keeper = installHomeKeeper(host, spec(trace), saved);
  host.onStep(ENCOUNTER, () => { if (host.state.tick === 5) keeper.boss?.draw(); });
  keeper.settle();
  return keeper;
}
function kill(host: SimHost, id: string): void {
  const actor = host.entities.get(id); if (actor === undefined) throw new Error(`missing ${id}`);
  host.combat.hit({ source: host.player.health, sourceTags: ['actor.player'], target: actor.combatActor(), amount: 10_000, point: actor.position.clone(), dir: new Vector3(0, 0, 1), from: host.player.position.clone(), moveId: 'test.kill' });
}
const tokens = (host: SimHost): readonly string[] => v.parse(v.object({ tokens: v.array(v.string()) }), snapshotSimHost(host).adapters.find(adapter => adapter.id === STEP)?.state).tokens;

it('spawns the declared homes in order from the creature stream, on the decision cadence, under the attack cap', () => {
  const trace = fresh(), host = createSimHost(level, { rapier }), keeper = install(host, trace);
  try {
    expect([...host.entities.keys()]).toEqual(homes.map(home => home.id));
    const scales = [...host.entities.values()].map(actor => actor.scale);
    expect(new Set(scales).size).toBe(3); expect(scales.every(s => s >= 0.8 && s <= 1.2)).toBe(true);
    for (let tick = 0; tick < 13; tick++) host.step();
    // decisions on ticks 1, 7 and 13 (tick % 6 === 1) with the band's dt, movement every tick, the gate before each step
    expect(trace.decide.get('fixture.home:0')).toEqual([0.1, 0.1, 0.1]); expect(trace.moves.get('fixture.home:0')).toBe(13);
    expect(trace.before).toHaveLength(13); expect(trace.before[0]).toEqual(homes.map(home => home.id));
    expect(tokens(host)).toEqual(['fixture.home:0']);
    // the boss body joined at tick 5, after the homes: same stream, same cadence
    expect(keeper.boss?.actor()?.entityId).toBe('fixture.boss'); expect(trace.decide.get('fixture.boss')).toEqual([0.1, 0.1]);
  } finally { host.dispose(); }
});

it('refills a fallen home after its respawn clock with a fresh body, and never refills the boss', () => {
  const trace = fresh(), host = createSimHost(level, { rapier }), keeper = install(host, trace);
  try {
    for (let tick = 0; tick < 10; tick++) host.step();
    const seed = host.entities.get('fixture.home:1')?.seed;
    kill(host, 'fixture.home:1'); kill(host, 'fixture.boss');
    for (let tick = 0; tick < 110; tick++) host.step();
    expect(keeper.homes()[1]?.wait).toBeGreaterThan(0); // 2 s clock: still waiting
    for (let tick = 0; tick < 20; tick++) host.step();
    const reborn = host.entities.get('fixture.home:1');
    expect(reborn?.alive).toBe(true); expect(reborn?.seed).not.toBe(seed); expect(keeper.homes()[1]?.wait).toBe(0);
    expect(keeper.boss?.actor()?.alive).toBe(false);
  } finally { host.dispose(); }
});

it('restores mid-wait with the boss spawned in play exactly, reinstalling the roster with no stream draw', () => {
  for (const checkpoint of [20, 70]) {
    const original = createSimHost(level, { rapier }); install(original, fresh());
    let restored: SimHost | undefined;
    try {
      for (let tick = 0; tick < checkpoint; tick++) { if (tick === 15) kill(original, 'fixture.home:0'); original.step(); }
      const saved = decodeSimSnapshot(serializeSimSnapshot(snapshotSimHost(original)));
      restored = restoreSimHost(level, { rapier }, saved, host => { install(host, fresh(), saved); });
      expect(snapshotSimHost(restored)).toEqual(snapshotSimHost(original));
      for (let tick = 0; tick < 120; tick++) {
        if (tick === 30) { kill(original, 'fixture.home:2'); kill(restored, 'fixture.home:2'); }
        original.step(); restored.step();
      }
      expect(serializeSimSnapshot(snapshotSimHost(restored))).toBe(serializeSimSnapshot(snapshotSimHost(original)));
    } finally { restored?.dispose(); original.dispose(); }
  }
});

it('refuses a continuation whose roster does not match its declared homes', () => {
  const original = createSimHost(level, { rapier }); install(original, fresh());
  try {
    for (let tick = 0; tick < 8; tick++) original.step();
    // the saved keeper names a home this build does not declare at that index
    const text = serializeSimSnapshot(snapshotSimHost(original)).replace('"fixture.home:1","wait"', '"fixture.home:9","wait"');
    const tampered = decodeSimSnapshot(text);
    expect(JSON.stringify(tampered.adapters.find(adapter => adapter.id === STEP)?.state)).toContain('fixture.home:9');
    expect(() => restoreSimHost(level, { rapier }, tampered, host => { install(host, fresh(), tampered); })).toThrow('Incompatible fixture.homes continuation');
  } finally { original.dispose(); }
});
