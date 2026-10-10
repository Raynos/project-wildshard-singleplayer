import { Color } from 'three';
import { expect, it } from 'vitest';
import { AnimalManager } from '../../../src/engine/entities/AnimalManager';
import { HerdShelter } from '../../../src/game/systems/species/herdShelter';
import { PINE_HERD_SHELTER } from '../../../src/shards/pine-hollow/data/weatherLook';
import { PineRainShelter, type PineShelterTree } from '../../../src/shards/pine-hollow/runtime/rainShelter';
import { legacyActor } from '../../fake/legacyActor';

const trees: readonly PineShelterTree[] = [[2, 5, 0.9, 20, 0.5], [10, 7, 1, 34, 0.9], [-42, -30, 2, 35, 0.8], [0, 0, 1, 19.99, 1]];
const herds = () => ['deer', 'elk', 'boar', 'bear', 'deer'].map((kind, i) => ({ kind, cx: i === 4 ? 210 : i * 8, cz: i * 4, members: [] }));
const rainAt = (tick: number) => tick < 200 ? 0 : tick < 700 ? 0.3 : tick < 1400 ? 0.31 : tick < 1700 ? 0.05 : tick < 8100 ? 0.049 : 0.9;

it('matches the shipping page shelter every frame, including strict thresholds, crown priority, return hold and no-tree herds', () => {
  const pageHerds = herds(), nativeHerds = herds();
  const animals = legacyActor(AnimalManager.prototype, { herds: pageHerds });
  const forest = trees.map(([x, z, r, height]) => ({ x, y: 0, z, r, height, rot: 0, scale: 1, variant: 0, tint: new Color() }));
  const page = new HerdShelter(animals, forest, (x, z) => trees.find(tree => tree[0] === x && tree[1] === z)?.[4] ?? 0, PINE_HERD_SHELTER);
  const native = new PineRainShelter(() => nativeHerds, trees);
  for (let tick = 0; tick < 10000; tick++) {
    const dt = tick % 3 === 0 ? 1 / 30 : 1 / 60, rain = rainAt(tick);
    page.update(dt, rain); native.update(dt, rain);
    expect(nativeHerds).toEqual(pageHerds);
    for (let herd = 0; herd <= nativeHerds.length; herd++) expect(native.wanderGoal(herd, rain)).toEqual(page.wanderGoal(herd, rain));
  }
});

it('restores rain and drying continuations onto fresh herd identities and refuses invalid state atomically', () => {
  const a = herds(), first = new PineRainShelter(() => a, trees);
  first.update(1 / 60, 1);
  first.update(13, 0);
  const b = a.map(herd => ({ ...herd })), second = new PineRainShelter(() => b, trees);
  second.restore(first.snapshot());
  const before = second.snapshot();
  expect(() => second.restore({ ...before, shelters: before.shelters.slice(1) })).toThrow('Incompatible');
  expect(second.snapshot()).toEqual(before);
  const invalid = before.shelters.map(shelter => shelter === null ? null : { ...shelter, hold: Number.NaN });
  expect(() => second.restore({ ...before, shelters: invalid })).toThrow();
  expect(second.snapshot()).toEqual(before);
  for (let tick = 0; tick < 6500; tick++) {
    const rain = tick < 4700 ? 0 : 1;
    first.update(1 / 60, rain); second.update(1 / 60, rain);
    expect(second.snapshot()).toEqual(first.snapshot()); expect(b).toEqual(a);
  }
});
