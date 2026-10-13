import { expect, it } from 'vitest';
import { admitSpeciesBrains } from '../src/game/plugin/brain';
import { registerSpecies } from '../src/engine/entities/species/registry';
import { speciesWithLook } from '../src/engine/entities/species/look';
import { SKY_CREATURE_ROWS, SKY_CREATURE_STRIKES, SKY_PAGE_ROWS, SKY_PAGE_HOMES } from '../src/shards/far-reach/data/brains';
import { SKY_CREATURE_LOOKS } from '../src/shards/far-reach/species/bodies';
import { SIGNAL_SPECIES, SIGNAL_STRIKES, SIGNAL_MODULES, SIGNAL_PAGE_ROWS } from '../src/shards/sunscar-dunes/data/brains';
import { speciesBrains } from '../src/sdk/speciesBrains';
import { strike } from '../src/sdk/species';
import { creature } from './fake/creature';

for (const look of SKY_CREATURE_LOOKS) {
  const row = SKY_CREATURE_ROWS.find(value => value.kind === look.kind);
  if (row === undefined) throw new Error('Missing shipping metadata');
  registerSpecies(speciesWithLook(row, look));
}
const sky = () => admitSpeciesBrains(SKY_CREATURE_ROWS, SKY_CREATURE_STRIKES.map(row => strike(row)));
it('keeps both catalogues in original metadata/key order without native fields appearing on Signal rows', () => {
  const before = speciesBrains(SIGNAL_SPECIES, SIGNAL_STRIKES, SIGNAL_MODULES), after = speciesBrains(SIGNAL_SPECIES, SIGNAL_STRIKES, SIGNAL_MODULES);
  const old = SIGNAL_PAGE_ROWS.map(row => ({ ...row, ...before.bind(row.kind) })), next = after.catalogue(SIGNAL_PAGE_ROWS).rows;
  expect(next.map(row => row.kind)).toEqual(old.map(row => row.kind));
  for (const [index, row] of next.entries()) {
    const expected = old[index]; if (expected === undefined) throw new Error('Missing baseline metadata');
    expect(Object.keys(row)).toEqual(Object.keys(expected));
    expect(row.variants).toBe(expected.variants);
    expect('brain' in row).toBe(false); expect('body' in row).toBe(false);
  }
  expect(sky().catalogue(SKY_PAGE_ROWS, { homes: SKY_PAGE_HOMES, held: { shove: () => undefined } }).rows.map(row => row.kind))
    .toEqual(['driftRay', 'skyGoat', 'galeWisp', 'stormRoc']);
});
it('prepares the original held controller quietly and exactly once through its actual binding', () => {
  const before = sky(), after = sky(), oldPushes: number[][] = [], newPushes: number[][] = [];
  const authority = (pushes: number[][]) => ({ shove: (yaw: number, speed: number, lift: number) => { pushes.push([yaw, speed, lift]); } });
  const oldHeld = authority(oldPushes), held = authority(newPushes);
  const row = SKY_PAGE_ROWS.find(value => value.kind === 'stormRoc'); if (row === undefined) throw new Error('Missing held row');
  const old = before.bind('stormRoc', undefined, undefined, oldHeld), next = after.catalogue([row], { held });
  const oldBody = creature('stormRoc', 'storm', {}, undefined, old.think, old.act), bound = next.rows[0];
  if (old.control === undefined || bound === undefined) throw new Error('Missing held authority');
  const newBody = creature('stormRoc', 'storm', {}, undefined, bound.think, bound.act);
  const saved = newBody.animal.snapshot(), rng = newBody.ctx.rng.snapshot();
  const expected = old.control(oldBody.animal), actual = next.prepareHeld('stormRoc', newBody.animal);
  if (actual === null) throw new Error('Missing controller');
  expect(actual.snapshot()).toBe(expected.snapshot());
  expect(newBody.animal.snapshot()).toEqual(saved); expect(newBody.ctx.rng.snapshot()).toEqual(rng); expect(oldPushes).toEqual([]); expect(newPushes).toEqual([]);
  expect(next.prepareHeld('stormRoc', newBody.animal)).toBe(actual); expect(after.held('stormRoc', newBody.animal)).toBe(actual);
  for (let tick = 0; tick < 300; tick++) {
    expected.fighting = actual.fighting = tick >= 5;
    expected.phase = actual.phase = tick < 100 ? 0 : tick < 200 ? 1 : 2;
    for (const body of [oldBody, newBody]) {
      body.ctx.player.set(Math.sin(tick * 0.01) * 9, 50, Math.cos(tick * 0.01) * 9);
      body.advance(1);
    }
    expect(actual.snapshot()).toBe(expected.snapshot());
    expect(newBody.animal.snapshot()).toEqual(oldBody.animal.snapshot());
    expect(newBody.ctx.rng.snapshot()).toEqual(oldBody.ctx.rng.snapshot());
    expect(newPushes).toEqual(oldPushes);
  }
  expect(() => after.catalogue([row], { held }).prepareHeld('stormRoc', newBody.animal)).toThrow('owning controller');
  expect(() => next.prepareHeld('foreign', newBody.animal)).toThrow('declared live body');
});
it('refuses invalid order or missing authority before binding any actual body', () => {
  const brains = sky();
  expect(() => brains.catalogue([...SKY_PAGE_ROWS, ...SKY_PAGE_ROWS])).toThrow('catalogue order');
  const row = SKY_PAGE_ROWS[0]; if (row === undefined) throw new Error('Missing row');
  expect(() => brains.catalogue([{ ...row, kind: 'foreign' }])).toThrow('declares no brain');
  expect(() => brains.catalogue(SKY_PAGE_ROWS)).toThrow('home and body authority');
  expect(() => brains.catalogue(SKY_PAGE_ROWS, { homes: SKY_PAGE_HOMES })).toThrow('home and body authority');
  const catalogue = brains.catalogue(SKY_PAGE_ROWS, { homes: SKY_PAGE_HOMES, held: { shove: () => undefined } });
  expect(catalogue.rows).toHaveLength(4);
});
