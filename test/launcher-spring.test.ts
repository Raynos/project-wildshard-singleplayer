import {expect, test} from 'vitest';
import {advanceLauncherSpring, type LauncherSpringState} from '../src/game/weapons/launcherSpring';
import {CROSSBOW_ROWS} from '../src/shards/pine-hollow/generators/crossbowRows';

test('60 Hz draw and velocity are bit-identical through shots and reloads', () => {
  const before: LauncherSpringState = {draw: 1, velocity: -40}, after = {...before};
  for (let frame = 0; frame < 18000; frame++) {
    const reloading = frame % 180 < 100, target = reloading ? (frame % 100) / 100 : 1;
    const [k, c] = reloading ? CROSSBOW_ROWS.launcher.string.reloadSpring : CROSSBOW_ROWS.launcher.string.spring;
    if (k === undefined || c === undefined) throw new Error('Missing original Pine spring');
    if (frame % 180 === 101) before.velocity = after.velocity = CROSSBOW_ROWS.launcher.string.release;
    const dt = 1 / 60;
    before.velocity += (-(before.draw - target) * k - before.velocity * c) * dt;
    before.draw += before.velocity * dt;
    advanceLauncherSpring(after, target, k, c, dt);
    expect(Object.is(after.draw, before.draw)).toBe(true);
    expect(Object.is(after.velocity, before.velocity)).toBe(true);
  }
});

test('the actual Pine release at 21 Hz exceeds the old channel limit but now settles', () => {
  const [k, c] = CROSSBOW_ROWS.launcher.string.spring;
  if (k === undefined || c === undefined) throw new Error('Missing original Pine spring');
  const before = {draw: 1, velocity: CROSSBOW_ROWS.launcher.string.release}, after = {...before}, dt = 1 / 21;
  for (let frame = 0; frame < 300; frame++) {
    before.velocity += (-(before.draw - 1) * k - before.velocity * c) * dt;
    before.draw += before.velocity * dt;
    advanceLauncherSpring(after, 1, k, c, dt);
    expect(Number.isFinite(after.draw)).toBe(true);
    expect(Math.abs(after.draw)).toBeLessThan(1e12);
  }
  expect(Math.abs(before.draw)).toBeGreaterThan(1e12);
  expect(after.draw).toBeCloseTo(1, 12); expect(after.velocity).toBeCloseTo(0, 12);
});
