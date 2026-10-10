// oxlint-disable-next-line import/no-nodejs-modules -- Initialize the real native engine for the parity trace.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { createSimHost, type SimSpawn } from '../../../src/engine/sim';
import { loadRapier, type Rapier } from '../../../src/engine/physics/rapier';
import { canReach } from '../../../src/engine/ai/reach';
import type { AnimalSim } from '../../../src/engine/entities/AnimalSim';
import { SIM_LEVEL } from '../../fixtures/sim-level/level';
import { SkittererBrain } from '../../fixtures/species-oracle/skitterer';
import { speciesBrains } from '../../../src/sdk/speciesBrains';
import type { HomeObservation, SpeciesPolicy } from '../../../src/game/shardfile/speciesBrains';
import { sha256, moduleBytes } from '../../../src/game/shardfile/speciesScripts';
import { SIGNAL_MODULES, SIGNAL_SPECIES, SIGNAL_STRIKES, SKITTERER_BRAIN } from '../../../src/shards/sunscar-dunes/data/brains';
import skitterer from '../../../src/shards/sunscar-dunes/behaviour/skitterer.json' with { type: 'json' };

// SF27: Signal's skitterer is an admitted species script (behaviour/skitterer.as). Held to the shipping TypeScript policy
// it replaced (test/fixtures/species-oracle/skitterer.ts), on the same native body, for 9,000 fixed steps of a player who
// stands off, circles in close (bursts, hunts, bites, retreats), goes calm (it reburies), walks away and comes back, with
// reach and attack-token windows closed for a while: every frame's position, yaw, burrow, attack phase and state, every
// blow and every strike start must be identical.
let rapier: Rapier;
beforeAll(async () => { rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); });
const level = { ...SIM_LEVEL, entities: [], quests: [], ground: { size: 2048, height: 0 } };
const STATES = ['buried', 'burst', 'hunt', 'retreat'];
function recipe(seed: number, x: number): SimSpawn {
  const base = SIM_LEVEL.entities[0];
  if (base === undefined) throw new Error('Missing native fixture recipe');
  return { ...base, id: `skitterer:${String(seed)}`, seed, at: { x, y: 0, z: 0 }, spec: { ...base.spec, kind: 'sandSkitterer' } };
}
function playerAt(tick: number, out: Vector3): void {
  if (tick < 600) out.set(0, 0, 30);
  else if (tick < 3000) out.set(Math.sin(tick * 0.004) * 6, 0, Math.cos(tick * 0.004) * 6);
  else if (tick < 4200) out.set(Math.sin(tick * 0.004) * 6, 0, Math.cos(tick * 0.004) * 6);
  else if (tick < 5200) out.set(0, 0, 45);
  else out.set(Math.sin(tick * 0.006) * 3, 0, 4 + Math.cos(tick * 0.006) * 3);
}
function stateOf(policy: SpeciesPolicy<HomeObservation>): string {
  const saved = policy.snapshot(), value: unknown = typeof saved === 'string' ? JSON.parse(saved) : null;
  if (typeof value !== 'object' || value === null) throw new Error('Expected policy object');
  const slots: unknown = Reflect.get(value, 'slots'), state: unknown = Reflect.get(value, 'state');
  return Array.isArray(slots) ? STATES[Number(slots[0])] ?? 'unknown' : String(state);
}
function trace(script: boolean, seed: number, x: number): { frames: unknown[]; hits: unknown[]; states: Set<string> } {
  const host = createSimHost(level, { rapier }), actor: AnimalSim = host.spawn(recipe(seed, x)), player = new Vector3(), hits: unknown[] = [], frames: unknown[] = [], states = new Set<string>();
  let tick = 0;
  const ports: HomeObservation = { dt: 0, t: 0, player, calm: false, phaseOffset: 0,
    reach: a => (tick < 2400 || tick > 2700) && canReach(a, player, host.physics), claim: () => tick < 1500 || tick > 1800,
    hurt: damage => { hits.push([tick, damage]); },
    steer: (a, yaw, speed, turn) => { a.setMotion(yaw, speed, turn); }, flight: { steer: (a, yaw, speed, altitude, turn) => { a.fly(yaw, speed, altitude, turn); } } };
  const shipped = script ? speciesBrains(SIGNAL_SPECIES, SIGNAL_STRIKES, SIGNAL_MODULES).policy('sandSkitterer', actor) : new SkittererBrain<AnimalSim>(actor);
  if (shipped === null) throw new Error('Missing skitterer script policy');
  const policy = shipped;
  host.onStep('policy', dt => {
    playerAt(tick, player); ports.calm = tick > 3000 && tick < 3700; ports.t = host.clock.now;
    if (tick % 6 === 1) { ports.dt = 0.1; policy.think(ports); }
    ports.dt = dt; if (actor.alive && !actor.stunned) policy.act(ports);
  });
  try {
    for (; tick < 9000; tick++) {
      host.step(); const state = stateOf(policy); states.add(state);
      frames.push([actor.position.x, actor.position.y, actor.position.z, actor.yaw, actor.mem['burrow'] ?? 0, actor.attackPhase, state]);
    }
  } finally { host.dispose(); }
  return { frames, hits, states };
}

it('admits exactly the committed module bytes under the declared hash', () => {
  const bytes = moduleBytes(skitterer.bytes);
  expect(sha256(bytes)).toBe(skitterer.module);
  expect(SKITTERER_BRAIN.archetype === 'script' && SKITTERER_BRAIN.data.module).toBe(skitterer.module);
  const tampered = `${skitterer.bytes.slice(0, 60)}${skitterer.bytes[60] === 'A' ? 'B' : 'A'}${skitterer.bytes.slice(61)}`;
  expect(() => speciesBrains(SIGNAL_SPECIES, SIGNAL_STRIKES, new Map([[skitterer.module, tampered]]))).toThrow(/hash/u);
  expect(() => speciesBrains(SIGNAL_SPECIES, SIGNAL_STRIKES)).toThrow(/not supplied/u);
});
it.each([[11, 3], [29, -4], [53, 0.5]])('the admitted skitterer script plays the shipping policy exactly (seed %i)', (seed, x) => {
  const script = trace(true, seed, x), oracle = trace(false, seed, x);
  expect(script.frames).toEqual(oracle.frames);
  expect(script.hits).toEqual(oracle.hits);
  expect([...oracle.states].sort()).toEqual([...STATES].sort());
  expect(oracle.hits.length).toBeGreaterThan(0);
}, 60_000);
