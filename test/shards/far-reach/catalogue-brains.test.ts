// oxlint-disable-next-line import/no-nodejs-modules -- Hash full native traces against the frozen pre-port body adapter.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- The renderer-free fixture loads the shipped physics WASM.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, it } from 'vitest';
import { Rng } from '../../../src/engine/core/rng';
import { loadRapier, type Rapier } from '../../../src/engine/physics/rapier';
import { createSimHost, SIM_API_VERSION, type SimHost, type SimLevel } from '../../../src/engine/sim';
import type { AnimalSim } from '../../../src/engine/entities/AnimalSim';
import { speciesBrains } from '../../../src/sdk/speciesBrains';
import { SKY_CREATURE_ROWS, SKY_CREATURE_STRIKES } from '../../../src/shards/far-reach/data/brains';
import type { KeptPolicy } from '../../../src/game/shardfile/homeKeeper';
import { skySpecs } from '../../fake/sky-specs';
import { flockBrain as shippingBrain } from '../../fixtures/species-oracle/skyFlock';

let rapier: Rapier;
beforeAll(async () => { rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); });
const HOME = { x: 7, z: -4, r: 12, y: 0 };
const level: SimLevel = { version: SIM_API_VERSION, id: 'sky-policy-arena', seed: 71,
  ground: { size: 100, height: 0 }, player: { at: { x: 7, y: 0, z: -2 }, yaw: 0, speed: 5 }, entities: [], quests: [],
  weapon: { id: 'test.probe', shape: { kind: 'point', radius: 1 }, windup: 0.1, active: 0.1, recover: 0.1, cooldown: 1, range: 1, damage: 0, tags: [] } };
interface Fixture { host: SimHost; actor: AnimalSim; brain: KeptPolicy; rng: Rng }
function fixture(kind: string, next: boolean): Fixture {
  const spec = skySpecs().get(kind);
  if (spec === undefined) throw new Error('Missing actual native species recipe');
  const host = createSimHost(level, { rapier }), rng = new Rng(357);
  const actor = host.spawn({ id: 'sky.policy', spec, seed: 0.5, scale: 1, at: { x: 19, y: spec.flight === undefined ? 0 : 14, z: -4 }, yaw: 0 });
  return { host, actor, rng, brain: next ? declaredBrain(kind, actor, host, rng) : shippingBrain(kind, spec.label, actor, HOME, { host, rng }) };
}
function declaredBrain(kind: string, actor: AnimalSim, host: SimHost, stream: Rng): KeptPolicy {
  const brain = speciesBrains(SKY_CREATURE_ROWS, SKY_CREATURE_STRIKES).body(kind, actor, { host, stream, home: HOME, attacks: { kind: 'unlimited', limit: Infinity } });
  if (brain === null) throw new Error('Missing admitted Sky body');
  return brain;
}
function drive(f: Fixture, tick: number): void {
  const { host, actor, brain } = f;
  host.player.position.set(HOME.x + Math.sin(tick * 0.004) * 3, tick >= 6000 && tick < 7000 ? 5 : 0,
    HOME.z + (tick < 600 || tick >= 4000 && tick < 5000 ? 80 : 2));
  if (tick === 1500 && actor.kind === 'skyGoat') actor.position.set(HOME.x + HOME.r - 0.1, 0, HOME.z);
  if (tick === 2200 && actor.kind === 'skyGoat') actor.position.y = -2;
  if (tick === 7500) actor.alive = false;
  if (tick === 7600) actor.alive = true;
  host.step();
  if (tick % 6 === 0) brain.decide(0.1);
  brain.move(1 / 60);
}
it.each(['skyGoat', 'driftRay', 'galeWisp'])('%s retains the complete native policy/body/RNG/contact trace and quiet restore with its own home', kind => {
  const old = fixture(kind, false), next = fixture(kind, true), expected = createHash('sha256'), actual = createHash('sha256');
  const sample = (f: Fixture): string => JSON.stringify({ actor: f.actor.snapshot(), policy: f.brain.snapshot(), rng: f.rng.snapshot(), health: f.host.player.health.snapshot(), player: f.host.player.position.toArray() });
  try {
    for (let tick = 0; tick < 10000; tick++) {
      drive(old, tick); drive(next, tick);
      expected.update(sample(old)); actual.update(sample(next));
      if (tick === 1400 || tick === 3400 || tick === 6400) {
        const state = next.brain.snapshot(), before = sample(next);
        const restored = declaredBrain(kind, next.actor, next.host, next.rng);
        restored.restore(state); next.brain = restored;
        expect(sample(next)).toBe(before); expect(next.brain.snapshot()).toBe(old.brain.snapshot());
      }
    }
    expect(actual.digest('hex')).toBe(expected.digest('hex'));
  } finally { next.host.dispose(); old.host.dispose(); }
});
