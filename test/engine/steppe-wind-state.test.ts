import { expect, it } from 'vitest';
import { Wind } from '../../src/engine/world/steppeWind';
import { windStrength } from '../../src/engine/world/windStrength';

const STEP = 1 / 60;
const run = (wind: Wind, from: number, to: number): void => {
  for (let i = from; i < to; i++) {
    if (i === 200) wind.setTarget(16, Math.PI / 4, 0.95, 6);
    if (i === 700) wind.setTarget(5, 1.95, 0.6, 30);
    wind.update(STEP);
  }
};

it('saves and restores a Wind exactly, its strength into its own box, never the world\'s', () => {
  const before = windStrength.value;
  const box = { value: 1 }, whole = new Wind(box);
  run(whole, 0, 900);
  const boxA = { value: 1 }, first = new Wind(boxA);
  run(first, 0, 450);
  const saved = structuredClone(first.snapshot());
  const boxB = { value: 1 }, resumed = new Wind(boxB);
  resumed.restore(saved);
  expect(resumed.snapshot()).toEqual(first.snapshot());
  expect([resumed.dirX, resumed.dirZ, boxB.value]).toEqual([first.dirX, first.dirZ, boxA.value]);
  run(resumed, 450, 900);
  expect(resumed.snapshot()).toEqual(whole.snapshot());
  expect([resumed.dirX, resumed.dirZ, resumed.at(12, -40), boxB.value]).toEqual([whole.dirX, whole.dirZ, whole.at(12, -40), box.value]);
  expect(box.value).not.toBe(1);
  expect(windStrength.value).toBe(before);
  expect(() => { resumed.restore({ ...saved, travel: Number.NaN }); }).toThrow(RangeError);
});
