import { afterAll, describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { RamGrazerBrain } from '../../../src/engine/ai/ramGrazer';
import type { Animal } from '../../../src/engine/entities/AnimalView';
import { registerSpecies } from '../../../src/engine/entities/species/registry';
import { speciesWithLook } from '../../../src/engine/entities/species/look';
import { overrideTerrain } from '../../../src/engine/world/Heightfield';
import { fnv1a32 } from '../../../src/engine/core/rng';
import { ramGrazer } from '../../../src/sdk/grazers';
import { SKY_GOAT, SKY_GOAT_LOOK } from '../../../src/shards/far-reach/species/skyGoat';
import { setHome } from '../../../src/shards/far-reach/species/rig';
import { GOAT_BRAIN } from '../../../src/shards/far-reach/data/brains';
import { RAM } from '../../../src/shards/far-reach/runtime/strikes';
import { creature } from '../../fake/creature';
import { installPortableMath } from '../../fake/portableMath';

// SF72 (sf72-sky5): the goat's RAM became an explicit charge (`motion`) when a motionless lane strike started ending at
// its declared `active` window (the Roc's gale wall). These hashes were recorded on the shipping goat BEFORE that change
// (HEAD 243da2c5e): every body frame, strike phase and contact per tick must stay byte-identical after it.
// Platform-stable (ci-green): V8's native sin / cos / atan2… differ in the last bits on arm64 and x64, so the file runs
// on test/fake/portableMath; the hashes were re-recorded that way on 243da2c5e and match on arm64 and x64.
const restoreMath = installPortableMath();
afterAll(() => { restoreMath(); });
registerSpecies(speciesWithLook(SKY_GOAT, SKY_GOAT_LOOK));
const unbind = overrideTerrain({ heightAt: () => 0, normalAt: (): [number, number, number] => [0, 1, 0], waterLevel: () => -100, streamAt: () => null });
afterAll(unbind);
const HOME = { x: 0, z: 0, r: 20, y: 0 };
type Scenario = 'contact' | 'rim' | 'impulse' | 'calm' | 'fall' | 'tokens' | 'blocked';

function replay(scenario: Scenario): { hash: number; rams: number; hits: number; phases: Record<string, number> } {
  const held: { brain?: RamGrazerBrain<Animal> } = {};
  const f = creature('skyGoat', 'cloud', {}, undefined, (_a, c) => { held.brain?.think({ ...c, home: HOME }); },
    (_a, c) => { held.brain?.act({ ...c, home: HOME }); });
  setHome(f.animal, HOME);
  const brain = new RamGrazerBrain(f.animal, ramGrazer(GOAT_BRAIN), RAM); held.brain = brain;
  const frames: string[] = [], phases: Record<string, number> = {};
  for (let tick = 0; tick < 10000; tick++) {
    f.ctx.player.set(Math.sin(tick * 0.004) * 6, tick >= 6000 && tick < 7000 ? 5 : 0, tick < 600 ? 40 : 2);
    f.ctx.reach = () => tick < 3000 || tick >= 4000;
    f.ctx.claim = () => scenario !== 'tokens' || tick < 1000 || tick >= 4000;
    f.ctx.calm = scenario === 'calm' && tick >= 3000 && tick < 6000;
    if (scenario === 'rim' && tick % 1000 === 0) f.animal.position.set(19.9, 0, 0);
    if (scenario === 'impulse' && tick % 500 === 0) f.animal.impulse(new Vector3(1, 2, 0));
    if (scenario === 'fall' && tick === 1500) f.animal.position.y = -2;
    // a ram that never reaches its 4 m end: the goat is held in place (a wall), so the charge's timeout ends it
    if (scenario === 'blocked' && tick >= 600) f.animal.position.set(0, 0, 0);
    f.advance(1);
    const saved = brain.snapshot();
    if (typeof saved !== 'string') throw new Error('Expected a string continuation');
    const { contract: _contract, ...policy } = JSON.parse(saved) as { contract: string };
    const strikes = (policy as { strikes: { phase: string } }).strikes;
    phases[strikes.phase] = (phases[strikes.phase] ?? 0) + 1;
    frames.push(JSON.stringify([f.animal.snapshot(), policy]));
  }
  return { hash: fnv1a32(JSON.stringify({ frames, hits: f.hits, starts: f.starts, sounds: f.sounds, rng: f.ctx.rng.snapshot() })),
    rams: f.starts.length, hits: f.hits.length, phases };
}

const RECORDED: Record<Scenario, number> = {
  contact: 3483860768, rim: 1976446366, impulse: 348572411, calm: 3483860768, fall: 21161171, tokens: 3286276239, blocked: 529851510,
};
describe('the Sky goat RAM before / after the motionless-lane fix', () => {
  it.each(Object.keys(RECORDED) as Scenario[])('%s: every body frame, strike phase and contact is byte-identical', (scenario) => {
    const run = replay(scenario);
    expect(run.hash).toBe(RECORDED[scenario]);
    // every scenario rams; 'blocked' runs each ram to the charge's timeout (length / max(1, speed) + 1.2 s)
    expect(run.rams).toBeGreaterThan(0);
  });
});
