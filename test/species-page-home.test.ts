import { afterAll, expect, it } from 'vitest';
import { admitSpeciesBrains } from '../src/game/plugin/brain';
import { registerSpecies } from '../src/engine/entities/species/registry';
import { speciesWithLook } from '../src/engine/entities/species/look';
import { overrideTerrain } from '../src/engine/world/Heightfield';
import { SKY_SPECIES_BRAINS } from '../src/shards/far-reach/data/brains';
import { RAM_DATA, DIVE_DATA, BURST_DATA } from '../src/shards/far-reach/data/strikes';
import { SKY_GOAT_LOOK } from '../src/shards/far-reach/species/skyGoat';
import { DRIFT_RAY_LOOK } from '../src/shards/far-reach/species/driftRay';
import { GALE_WISP_LOOK } from '../src/shards/far-reach/species/galeWisp';
import { strike } from '../src/sdk/species';
import { creature } from './fake/creature';

for (const look of [SKY_GOAT_LOOK, DRIFT_RAY_LOOK, GALE_WISP_LOOK]) {
  const row = SKY_SPECIES_BRAINS.find(value => value.kind === look.kind);
  if (row === undefined) throw new Error('Missing authored body');
  registerSpecies(speciesWithLook(row, look));
}
const restoreTerrain = overrideTerrain({ heightAt: () => 0, normalAt: (): [number, number, number] => [0, 1, 0], waterLevel: () => -100, streamAt: () => null });
afterAll(restoreTerrain);
const HOME = { x: 0, z: 0, r: 7, y: 3 };
function fixture(kind: string, next: boolean) {
  const brains = admitSpeciesBrains(SKY_SPECIES_BRAINS, [RAM_DATA, DIVE_DATA, BURST_DATA].map(row => strike(row)));
  const pushes: number[][] = [], shove = (yaw: number, speed: number, lift: number): void => { pushes.push([yaw, speed, lift]); };
  let actual = HOME;
  // Independent original page adapters, with their actual home and shove authorities.
  const bound = next ? brains.bind(kind, undefined, () => HOME, { shove }) : brains.bind(kind, (_actor, decision) => {
    if (decision.archetype === 'ram-grazer') return {
      think: context => { decision.policy.think({ ...context, home: actual }); },
      act: context => { decision.policy.act({ ...context, home: actual }); },
    };
    if (decision.archetype === 'orbit-diver') return {
      think: context => { decision.policy.think(context); }, act: context => { decision.policy.act(context); },
    };
    if (decision.archetype === 'burst-flyer') return {
      think: context => { decision.policy.think({ ...context, shove }); },
      act: context => { decision.policy.act({ ...context, shove }); },
    };
    throw new Error('Missing original page adapter');
  }, () => actual);
  const body = creature(kind, kind === 'skyGoat' ? 'cloud' : kind === 'driftRay' ? 'dusk' : 'gale', {}, undefined, bound.think, bound.act);
  body.animal.position.set(kind === 'skyGoat' ? 0 : 7, kind === 'skyGoat' ? 0 : 3, 0);
  return { ...body, brains, pushes, home: (home: typeof HOME): void => { actual = home; if (next) brains.home(kind, body.animal, home); } };
}

it.each(['skyGoat', 'driftRay', 'galeWisp'])('keeps the actual %s page body, RNG, contacts and home authority exact', kind => {
  const before = fixture(kind, false), after = fixture(kind, true);
  for (const body of [before, after]) body.home({ ...HOME, r: 12 });
  for (let tick = 0; tick < 900; tick++) {
    for (const body of [before, after]) {
      body.ctx.player.set(Math.sin(tick * 0.01) * 3, 0, 2);
      body.ctx.playerSpeed = tick > 150 ? 3 : 0;
      body.ctx.calm = tick >= 400 && tick < 450;
      if (tick === 300) body.home({ ...HOME, x: 2, r: 15 });
      if (tick === 600) body.animal.restore(body.animal.snapshot());
      body.advance(1);
    }
    expect(after.animal.snapshot()).toEqual(before.animal.snapshot());
    expect(after.ctx.rng.snapshot()).toEqual(before.ctx.rng.snapshot());
  }
  expect(after.hits).toEqual(before.hits); expect(after.starts).toEqual(before.starts);
  expect(after.pushes).toEqual(before.pushes); expect(after.sounds).toEqual(before.sounds);
  expect(after.brains.witness(after.animal)).not.toBeNull();
  expect(() => after.brains.home('foreign', after.animal, HOME)).toThrow('declared finite');
  expect(() => after.brains.home(kind, after.animal, { ...HOME, r: Number.NaN })).toThrow('declared finite');
});

it('refuses a burst without its trusted player impulse before constructing a body', () => {
  const brains = admitSpeciesBrains(SKY_SPECIES_BRAINS, [RAM_DATA, DIVE_DATA, BURST_DATA].map(row => strike(row)));
  expect(() => brains.bind('galeWisp', undefined, () => HOME)).toThrow('trusted home and body authority');
});
