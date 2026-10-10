import { afterAll, expect, it } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Verify the captured shipping source bytes independently of the implementation.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- Test-only oracle provenance, never a shard runtime dependency.
import { readFileSync } from 'node:fs';
import { registerSpecies } from '../../../src/engine/entities/species/registry';
import { speciesWithLook } from '../../../src/engine/entities/species/look';
import { overrideTerrain } from '../../../src/engine/world/Heightfield';
import { PhasedRaptorBrain } from '../../../src/engine/ai/phasedRaptor';
import { stormRocBrain, type StormRocBrain } from '../../../src/shards/far-reach/runtime/stormRocBrain';
import { STORM_ROC, STORM_ROC_LOOK } from '../../../src/shards/far-reach/species/stormRoc';
import { bindPlayerPush } from '../../../src/shards/far-reach/species/rig';
import { CROWN, DAIS } from '../../../src/shards/far-reach/data/layout';
import { StormRocBrain as ShippingRoc } from '../../fixtures/far-reach/rocBrainOracle';
import source from '../../fixtures/far-reach/rocBrainOracle.json';
import { creature } from '../../fake/creature';

registerSpecies(speciesWithLook(STORM_ROC, STORM_ROC_LOOK));
const release = overrideTerrain({ heightAt: () => CROWN.y, normalAt: (): [number, number, number] => [0, 1, 0], waterLevel: () => -1000, streamAt: () => null });
afterAll(release);
function fixture(next: boolean): ReturnType<typeof creature> & { policy: StormRocBrain | ShippingRoc; shoves: number[][] } {
  let policy: StormRocBrain | ShippingRoc | undefined;
  const f = creature('stormRoc', 'storm', {}, undefined, (_actor, ctx) => {
    if (policy === undefined) throw new Error('Roc was not installed'); policy.think(ctx);
  }, (_actor, ctx) => {
    if (policy === undefined) throw new Error('Roc was not installed'); policy.act(ctx);
  });
  const shoves: number[][] = [];
  policy = next ? stormRocBrain(f.animal) : new ShippingRoc(f.animal);
  return { ...f, get frame(): number { return f.frame; }, get policy(): StormRocBrain | ShippingRoc {
    if (policy === undefined) throw new Error('Missing Roc'); return policy;
  }, set policy(value: StormRocBrain | ShippingRoc) { policy = value; }, shoves };
}
function drive(f: ReturnType<typeof fixture>, tick: number): void {
  const phase = tick < 3000 ? 0 : tick < 6000 ? 1 : 2;
  f.policy.phase = phase; f.policy.fighting = tick >= 60;
  f.ctx.player.set(DAIS.x + Math.sin(tick * 0.004), CROWN.y + DAIS.h, DAIS.z);
  f.ctx.calm = tick >= 8200 && tick < 8400;
  f.ctx.reach = () => tick < 4500 || tick >= 4700;
  f.ctx.claim = () => tick < 3500 || tick >= 3800;
  if (tick === 60 || tick === 3000 || tick === 6000 || tick === 7400) f.policy.restart();
  if (tick === 7000) f.animal.alive = false;
  if (tick === 7400) f.animal.alive = true;
  if (tick % 600 === 100) f.animal.place(DAIS.x, DAIS.z + (phase === 1 ? 14 : 2), 0, phase === 0 ? f.ctx.player.y + 10 : phase === 1 ? CROWN.y + 7 : CROWN.y + DAIS.h);
  bindPlayerPush(velocity => { f.shoves.push([tick, velocity.x, velocity.y, velocity.z]); });
  try { f.advance(1); } finally { bindPlayerPush(null); }
}
function sample(f: ReturnType<typeof fixture>): object {
  return { actor: f.animal.snapshot(), state: f.policy.state, phase: f.policy.phase, fighting: f.policy.fighting,
    current: f.policy.current?.id ?? null, aim: f.policy.aim, windup: f.policy.windup, rng: f.ctx.rng.snapshot() };
}
it('keeps the exact source-hashed shipping policy as the independent oracle', () => {
  const text = readFileSync(new URL('../../fixtures/far-reach/rocBrainOracle.ts', import.meta.url), 'utf8');
  const body = text.slice(text.indexOf('/** Phase 1:'));
  expect(createHash('sha256').update(body).digest('hex')).toBe(source.policySha256);
});
it('matches the shipping Roc for 10,000 ticks across all phases, calm, reach, tokens, death and restart', () => {
  const old = fixture(false), next = fixture(true), strikes = new Set<string>();
  for (let tick = 0; tick < 10000; tick++) {
    drive(old, tick); drive(next, tick); expect(sample(next)).toEqual(sample(old));
    if (next.policy.current !== null) strikes.add(next.policy.current.id);
  }
  expect([...strikes].sort()).toEqual(['far.roc.galeWall', 'far.roc.stoop', 'far.roc.sweep']);
  expect(next.hits).toEqual(old.hits); expect(next.hits.length).toBeGreaterThan(0);
  expect(next.starts).toEqual(old.starts); expect(next.shoves).toEqual(old.shoves);
});
it.each([1400, 3400, 6400])('restores the exact body and policy suffix at tick %i without effects or RNG draws', at => {
  const f = fixture(true), restored = fixture(true);
  if (!(f.policy instanceof PhasedRaptorBrain) || !(restored.policy instanceof PhasedRaptorBrain)) throw new Error('Expected native Roc policy');
  for (let tick = 0; tick < at; tick++) { drive(f, tick); drive(restored, tick); }
  const state = f.policy.snapshot(), actor = f.animal.snapshot(), rng = f.ctx.rng.snapshot();
  const next = stormRocBrain(restored.animal), effects = restored.hits.length, attacks = restored.starts.length;
  restored.animal.restore(actor); restored.ctx.rng.restore(rng); next.restore(state); restored.policy = next;
  expect(restored.ctx.rng.snapshot()).toEqual(rng); expect(restored.animal.snapshot()).toEqual(actor);
  expect(restored.hits.length).toBe(effects); expect(restored.starts.length).toBe(attacks);
  for (let tick = at; tick < at + 1800; tick++) { drive(f, tick); drive(restored, tick); expect(sample(restored)).toEqual(sample(f)); expect(next.snapshot()).toBe(f.policy.snapshot()); }
  expect(restored.hits).toEqual(f.hits); expect(restored.starts).toEqual(f.starts); expect(restored.shoves).toEqual(f.shoves);
});
it('rejects invalid continuations before mutating the policy', () => {
  const f = fixture(true), policy = f.policy; if (!(policy instanceof PhasedRaptorBrain)) throw new Error('Expected Roc');
  const saved = policy.snapshot(); expect(() => { policy.restore(null); }).toThrow('continuation');
  if (typeof saved !== 'string') throw new Error('Expected bounded continuation');
  expect(() => { policy.restore(saved.replace('"phase":0', '"phase":9')); }).toThrow();
  expect(policy.snapshot()).toBe(saved);
});
