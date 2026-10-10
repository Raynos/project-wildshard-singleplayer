import { afterAll, describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { app } from '../../../src/engine/app/runtime';
import { overrideTerrain } from '../../../src/engine/world/Heightfield';
import { declaredCreatureRows } from '../../../src/shards/driftwood-isle/runtime/brains';
import { driftwoodSpeciesBrains } from '../../../src/shards/driftwood-isle/runtime/speciesBrains';
import { DRIFTWOOD_ENEMY_SPECIES } from '../../../src/shards/driftwood-isle/data/enemySpecies';
import { DRIFTWOOD_SPECIES } from '../../../src/shards/driftwood-isle/species/install';
import { creature } from '../../fake/creature';

const restoreTerrain = overrideTerrain({ heightAt: () => 0, normalAt: (): [number, number, number] => [0, 1, 0],
  waterLevel: () => -100, streamAt: () => null });
afterAll(restoreTerrain);
function replay(kind: 'crab' | 'sailor' | 'monkey', declared: boolean): object {
  const shared = app.rng.snapshot(); app.rng.seed(357);
  const row = (declared ? declaredCreatureRows() : DRIFTWOOD_SPECIES).find(candidate => candidate.kind === kind);
  if (row?.think === undefined) throw new Error(`Missing ${kind} policy`);
  const variant = kind === 'crab' ? 'small' : kind;
  const fixture = creature(kind, variant, {}, undefined, row.think, row.act);
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
    if (declared) expect(driftwoodSpeciesBrains.witness(fixture.animal)).toBe(row.kind === 'crab' ? 'skirmisher' : row.kind === 'sailor' ? 'guardian' : 'perch-hunter');
    return { frames, throws, splashes, hits: fixture.hits, sounds: fixture.sounds, starts: fixture.starts,
      rng: fixture.ctx.rng.snapshot(), shared: app.rng.snapshot() };
  } finally { app.rng.restore(shared); }
}

describe('Driftwood species-row decisions and native bodies', () => {
  it('keeps every shipping gameplay field and leaves the unique Captain on its native recipe', () => {
    for (const row of DRIFTWOOD_ENEMY_SPECIES) {
      const legacy = DRIFTWOOD_SPECIES.find(candidate => candidate.kind === row.kind);
      if (legacy === undefined) throw new Error('Missing shipping species');
      const data = Object.fromEntries(Object.entries(row).filter(([key]) => key !== 'brain'));
      const shipping = Object.fromEntries(Object.entries(legacy).filter(([key]) => key !== 'think' && key !== 'act'));
      expect(data).toEqual(shipping);
    }
    expect(declaredCreatureRows().find(row => row.kind === 'captain')).toBe(DRIFTWOOD_SPECIES.find(row => row.kind === 'captain'));
  });
  it.each(['crab', 'sailor', 'monkey'] as const)('matches real shipping %s decisions, body contacts, native motion and shared RNG for 10k frames', kind => {
    expect(replay(kind, true)).toEqual(replay(kind, false));
  });
});
