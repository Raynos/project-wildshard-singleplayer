// oxlint-disable-next-line import/no-nodejs-modules -- Pin independent original policy fixtures.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Validate source-hashed oracle provenance.
import { createHash } from 'node:crypto';
import { afterAll, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { app } from '../../../src/engine/app/runtime';
import type { Animal } from '../../../src/engine/entities/AnimalView';
import type { ThinkCtx } from '../../../src/engine/entities/species/registry';
import { overrideTerrain } from '../../../src/engine/world/Heightfield';
import { SailorBrain } from '../../../src/shards/driftwood-isle/species/sailor';
import { MonkeyBrain } from '../../../src/shards/driftwood-isle/species/monkeyPolicy';
import { DRIFTWOOD_SPECIES } from '../../../src/shards/driftwood-isle/species/install';
import { declaredCreatureRows } from '../../../src/shards/driftwood-isle/runtime/brains';
import { legacySailorDecision } from '../../fixtures/species-oracle/driftwood-sailor';
import { legacyMonkeyDecision } from '../../fixtures/species-oracle/driftwood-monkey';
import sailorProvenance from '../../fixtures/species-oracle/driftwood-sailor-provenance.json' with { type: 'json' };
import monkeyProvenance from '../../fixtures/species-oracle/driftwood-monkey-provenance.json' with { type: 'json' };
import { creature } from '../../fake/creature';

const restoreTerrain = overrideTerrain({ heightAt: () => 0, normalAt: (): [number, number, number] => [0, 1, 0],
  waterLevel: () => -100, streamAt: () => null });
afterAll(restoreTerrain);
function replay(kind: 'sailor' | 'monkey', source: 'original' | 'default' | 'hybrid'): object {
  const shared = app.rng.snapshot(); app.rng.seed(357);
  const row = (source === 'hybrid' ? declaredCreatureRows() : DRIFTWOOD_SPECIES).find(candidate => candidate.kind === kind);
  if (row?.think === undefined) throw new Error(`Missing ${kind} policy`);
  type NativeBrain = SailorBrain<Animal, ThinkCtx> | MonkeyBrain<Animal, ThinkCtx>;
  const captured = new WeakMap<Animal, NativeBrain>();
  const original = (a: Animal): NativeBrain => {
    let brain = captured.get(a);
    if (brain === undefined) {
      brain = kind === 'sailor' ? new SailorBrain(a, legacySailorDecision) : new MonkeyBrain(a, legacyMonkeyDecision);
      captured.set(a, brain);
    }
    return brain;
  };
  const fixture = creature(kind, kind, {}, undefined,
    source === 'original' ? (a, c) => { original(a).think(c); } : row.think,
    source === 'original' ? (a, c) => { original(a).act(c); } : row.act);
  const splashes: number[] = [], throws: number[][] = [];
  fixture.ctx.world = { hold: { x: 0, z: 0, r: 8, guardR: 9, floorAt: () => 1.5 },
    perches: [new Vector3(0, 5, 0), new Vector3(20, 5, 0), new Vector3(35, 7, 0)],
    perchBases: [new Vector3(0, 0, 0), new Vector3(20, 0, 0), new Vector3(35, 0, 0)],
    splash: (_point, strength) => { splashes.push(fixture.frame, strength); },
    throwCoconut: (from, to) => { throws.push([fixture.frame, ...from, ...to]); } };
  const frames: ReturnType<typeof fixture.animal.snapshot>[] = [];
  try {
    for (let tick = 0; tick < 10000; tick++) {
      fixture.ctx.player.set(0, 0, tick < 1000 ? 6 : tick < 3000 ? 1 : tick < 6000 ? 5 : 50);
      fixture.ctx.calm = tick >= 7000;
      fixture.ctx.mayAttack = () => fixture.frame < 1500 || fixture.frame >= 4000;
      fixture.ctx.claim = fixture.ctx.mayAttack;
      fixture.ctx.reach = () => fixture.frame < 2500 || fixture.frame >= 4500;
      if (tick === 3300) fixture.animal.lastHitT = tick / 60;
      fixture.advance(1); frames.push(fixture.animal.snapshot());
    }
    return { frames, throws, splashes, hits: fixture.hits, sounds: fixture.sounds, starts: fixture.starts,
      rng: fixture.ctx.rng.snapshot(), shared: app.rng.snapshot() };
  } finally { app.rng.restore(shared); }
}
it('pins both original decisions independently of the shipping row implementation', () => {
  for (const provenance of [sailorProvenance, monkeyProvenance]) {
    expect(createHash('sha256').update(readFileSync(provenance.fixture)).digest('hex')).toBe(provenance.fixtureHash);
    expect(provenance.sourceHash).toMatch(/^[a-f0-9]{64}$/u);
  }
});
it.each(['sailor', 'monkey'] as const)('keeps default and hybrid %s body/contact/RNG outcomes exact against 10k original frames', kind => {
  const original = replay(kind, 'original');
  expect(replay(kind, 'default')).toEqual(original);
  expect(replay(kind, 'hybrid')).toEqual(original);
});
