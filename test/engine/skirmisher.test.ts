import { afterAll, beforeAll, describe, expect, it } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Read the committed physics binary without a Vite wasm closure dependency.
import { readFile } from 'node:fs/promises';
import { createSimHost, type SimHost } from '../../src/engine/sim';
import { snapshotSimHost, restoreSimHost } from '../../src/engine/sim/snapshot';
import { loadRapier } from '../../src/engine/physics/rapier';
import { SIM_LEVEL } from '../fixtures/sim-level/level';
import { SkirmisherBrain } from '../../src/engine/ai/skirmisher';
import type { Animal } from '../../src/engine/entities/AnimalView';
import { Rng } from '../../src/engine/core/rng';
import { overrideTerrain } from '../../src/engine/world/Heightfield';
import { CRAB_BRAIN } from '../../src/shards/driftwood-isle/data/brains';
import { creature } from '../fake/creature';
import { declaredCreatureRows } from '../../src/shards/driftwood-isle/runtime/brains';
import { expectSameSimSnapshot } from '../fake/simSnapshot';

const restoreTerrain = overrideTerrain({ heightAt: (): number => 0, normalAt: (): [number, number, number] => [0, 1, 0], waterLevel: (): number => -100, streamAt: (): null => null });
afterAll(restoreTerrain);
let rapier: Awaited<ReturnType<typeof loadRapier>>;
beforeAll(async () => { const bytes = await readFile('public/assets/physics/rapier.wasm'); rapier = await loadRapier(Uint8Array.from(bytes).buffer); });
function installHeadless(host: SimHost): void {
  const actor = host.entities.values().next().value; if (!actor) throw new Error('Fixture actor missing');
  const brain = new SkirmisherBrain(actor, CRAB_BRAIN);
  host.onStep('brain.skirmisher', () => {
    if (host.state.tick % 6 !== 0) return;
    brain.think({ dt: 0.1, player: host.player.position, calm: false, rng: host.rng.stream('ai'), herd: null,
      sound: () => undefined, steer: (a, yaw, speed, turn) => { a.setMotion(yaw, speed, turn); },
      confine: () => undefined, claim: () => true, mayAttack: () => true });
  }, { snapshot: () => brain.snapshot(), restore: value => { brain.restore(value); } });
}
function replay(platform: boolean, scenario: 'approach' | 'tokens' | 'scatter'): object {
  let brain: SkirmisherBrain<Animal> | undefined;
  const f = creature('crab', 'small', {}, undefined, platform ? (a, ctx) => { brain ??= new SkirmisherBrain(a, CRAB_BRAIN); brain.think(ctx); } : undefined);
  f.ctx.rng = new Rng(357);
  const leader = scenario === 'scatter' ? creature('crab', 'big').animal : undefined;
  if (leader) f.ctx.herd = [f.animal, leader];
  const frames: ReturnType<Animal['snapshot']>[] = [];
  for (let frame = 0; frame < 10000; frame++) {
    f.ctx.player.set(0, 0, frame < 1000 ? 50 : frame < 6000 ? 1.7 : 50);
    if (scenario === 'tokens') { f.ctx.mayAttack = () => f.frame < 2500 || f.frame >= 5000; f.ctx.claim = f.ctx.mayAttack; }
    if (leader && frame === 2700) leader.alive = false;
    if (frame === 1700) f.animal.lastHitT = frame / 60;
    f.advance(1); frames.push(f.animal.snapshot());
  }
  return { frames, hits: f.hits, sounds: f.sounds, starts: f.starts, rng: f.ctx.rng.snapshot() };
}
describe('data-selected circling melee archetype', () => {
  it('selects the declared crab policy in the hybrid catalogue, retaining shipping body/rig recipes', () => {
    const row = declaredCreatureRows().find(species => species.kind === 'crab');
    if (row?.think === undefined) throw new Error('Missing declared crab policy');
    const f = creature('crab', 'small', {}, undefined, row.think, row.act); f.advance(80);
    expect(f.states).toEqual(['idle', 'sidestep', 'attack', 'sidestep']);
    expect(f.hits).toEqual([{ frame: 43, damage: 10 }]);
  });
  it.each(['approach', 'tokens', 'scatter'] as const)('matches the real shipping crab for 10,000 fixed body frames: %s', scenario => {
    expect(replay(true, scenario)).toEqual(replay(false, scenario));
  });
  it('restores actor, motor and RNG state into a fresh renderer-free host for an exact 10,000-tick suffix', () => {
    const sim = createSimHost(SIM_LEVEL, { rapier }); installHeadless(sim);
    let restored: SimHost | undefined;
    try {
      for (let tick = 0; tick < 1200; tick++) sim.step();
      restored = restoreSimHost(SIM_LEVEL, { rapier }, structuredClone(snapshotSimHost(sim)), installHeadless);
      for (let tick = 0; tick < 10000; tick++) {
        sim.step(); restored.step();
        expect(restored.entities.values().next().value?.snapshot()).toEqual(sim.entities.values().next().value?.snapshot());
      }
      expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(sim));
    } finally { sim.dispose(); restored?.dispose(); }
  });
  it('rejects nonfinite tuning and copies admitted parameters rather than keeping a mutable author object', () => {
    const f = creature('crab', 'small');
    expect(() => new SkirmisherBrain(f.animal, { ...CRAB_BRAIN, attackCooldown: Number.NaN })).toThrow('parameters');
    const data = { ...CRAB_BRAIN, awareRadius: 9 }, brain = new SkirmisherBrain(f.animal, data);
    data.awareRadius = 0; f.ctx.player.z = 8; brain.think(f.ctx);
    expect(() => new SkirmisherBrain(f.animal, { ...CRAB_BRAIN, awareRadius: 10 }).restore(brain.snapshot())).toThrow('Incompatible');
    expect(f.animal.mem['st']).toBe(1);
  });
});
