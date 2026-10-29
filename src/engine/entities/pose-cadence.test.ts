import { afterEach, expect, test } from 'vitest';
import { isDev, setDev } from '../core/devMode';
import { poseEvery, setPoseRate } from './poseCadence';

const previous = isDev();
afterEach(() => { setDev(previous); });

test('FC11: bones pose every frame within 30 m, every 2nd to 70 m, every 4th beyond; Developer keeps the old rate', () => {
  setDev(false);
  expect([0, 29.9, 30, 69.9, 70, 139].map((d) => poseEvery(d * d))).toEqual([1, 1, 2, 2, 4, 4]);
  setDev(true); setPoseRate('every');
  expect(poseEvery(100 * 100)).toBe(1);
  setDev(false);
  expect(poseEvery(100 * 100)).toBe(4); // the public build never reads a Developer pick
  setDev(true); setPoseRate('stepped');
  expect(poseEvery(100 * 100)).toBe(4);
});
