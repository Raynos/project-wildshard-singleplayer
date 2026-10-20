import { expect, test } from 'vitest';
import * as v from 'valibot';
import { ArenaFightPageSchema } from '../src/game/boss/arenaRoom';
import { ArenaBossProfileSchema } from '../src/format/bossProfiles';
import layout from '../src/shards/nalati-grasslands/data/kurganLayout.generated.json' with { type: 'json' };
import king from '../src/shards/nalati-grasslands/data/goldenKing.generated.json' with { type: 'json' };
import strikes from '../src/shards/nalati-grasslands/data/strikeProfiles.generated.json' with { type: 'json' };

const page = v.parse(v.object({ page: ArenaFightPageSchema }), king).page;

function positive(value: number, maximum: number): void {
  expect(Number.isFinite(value)).toBe(true);
  expect(value).toBeGreaterThan(0); expect(value).toBeLessThanOrEqual(maximum);
}

test('Kurgan phases descend through bounded health thresholds and share the encounter frame', () => {
  const fight = king.profile.fight, thresholds = king.encounter.phases.map(phase => phase.at);
  expect(thresholds.length).toBeGreaterThan(1); expect(thresholds.length).toBeLessThanOrEqual(8);
  expect(thresholds[0]).toBe(1);
  thresholds.forEach((at, index) => {
    positive(at, 1);
    if (index > 0) {
      const previous = thresholds[index - 1];
      if (previous === undefined) throw new Error('Missing previous Kurgan phase');
      expect(at).toBeLessThan(previous);
    }
  });
  expect(fight.phases.map(phase => phase.at)).toEqual(thresholds);
  expect(v.parse(ArenaBossProfileSchema, page.profile).fight.phases.map(phase => phase.at)).toEqual(thresholds);
  expect(fight.origin).toEqual(layout.DUNGEON); positive(fight.bounds, layout.CH);
  expect(layout.NICHES.length).toBeGreaterThan(0); expect(layout.STREAMS.length).toBeGreaterThan(0);
  expect(fight.adds.spots).toEqual(layout.NICHES); expect(fight.pour.spots).toEqual(layout.STREAMS);
  positive(layout.CH, 250); expect(layout.CHECKPOINT.z).toBeGreaterThan(layout.CH);
  expect(layout.CHECKPOINT.z).toBeLessThan(layout.DROMOS_END);
  for (const point of [...layout.NICHES, ...layout.STREAMS]) {
    expect(Math.abs(point.x)).toBeLessThan(layout.CH); expect(Math.abs(point.z)).toBeLessThan(layout.CH);
  }
});

test('Kurgan hazards and cuts retain finite damage, timing and their declared strike bindings', () => {
  const fight = king.profile.fight;
  expect(strikes.cuts.length).toBeGreaterThanOrEqual(Math.max(...fight.attacks.combo.count));
  expect(page.cuts).toEqual(strikes.cuts);
  expect(strikes.cuts.map(cut => cut.damage)).toEqual(king.tuning.strikeDamage);
  expect(fight.attacks.combo.cuts.map(cut => cut.damage)).toEqual(king.tuning.strikeDamage);
  expect(page.hazards).toMatchObject({ sunburst: strikes.sunburst, sand: strikes.sand, beam: strikes.beam });
  expect([fight.rings.damage, fight.pour.damage, fight.sweep.damage]).toEqual([strikes.sunburst.damage, strikes.sand.damage, strikes.beam.damage]);
  for (const strike of [...strikes.cuts, ...Object.values(page.hazards)]) {
    positive(strike.damage, 1000);
    for (const seconds of [strike.windup, strike.active, strike.recover, strike.cooldown]) {
      expect(Number.isFinite(seconds)).toBe(true); expect(seconds).toBeGreaterThanOrEqual(0); expect(seconds).toBeLessThanOrEqual(60);
    }
  }
  for (const cut of strikes.cuts) { positive(cut.shape.radius, fight.bounds); positive(cut.shape.halfAngle, Math.PI); }
  positive(fight.rings.speed, 100); positive(fight.rings.max, 250);
  positive(fight.pour.hitRadius, fight.bounds); positive(fight.sweep.hitRadius, fight.bounds);
});

test('Kurgan keeps its named reward on the pedestal and respawns at its checkpoint', () => {
  expect(king.reward).toMatchObject({ tier: 'LEGENDARY', name: 'THE GOLDEN BOW', prompt: 'TAKE THE GOLDEN BOW' });
  const [x, y, z] = page.reward;
  expect(x).toBeCloseTo(layout.DUNGEON.x + layout.PEDESTAL.x);
  expect(z).toBeCloseTo(layout.DUNGEON.z + layout.PEDESTAL.z);
  expect(y).toBeCloseTo(layout.DUNGEON.y + layout.PEDESTAL.h + 0.02);
  expect(page.respawn).toEqual([layout.DUNGEON.x + layout.CHECKPOINT.x, layout.DUNGEON.y, layout.DUNGEON.z + layout.CHECKPOINT.z]);
});
