import { expect, test } from 'vitest';
import { AmbientFlock } from '../src/engine/ai/ambientFlock';
import { parseAmbientFlock, parseAmbientLife } from '../src/format/ambientLife';
import { GULL_FLOCK } from '../src/shards/driftwood-isle/generators/gullsLook';
import { PINE_LIFE } from '../src/shards/pine-hollow/generators/ambientLife';
import { PineVisitors } from '../src/shards/pine-hollow/runtime/life/visitors';

const pine = parseAmbientLife(PINE_LIFE);
const eye = { x: 0, y: 1.7, z: 0, light: 0.8, fx: 0, fz: 1 };
test('Driftwood gulls and Pine guide ravens fly their shipped formation rows', () => {
  for (const row of [parseAmbientFlock(GULL_FLOCK), pine.guide.flock]) {
    const flock = new AmbientFlock(row, [{ x: 80, y: 2, z: -200 }, { x: -80, y: 2, z: -200 }], () => 0);
    expect(flock.guide(eye, 150, 150)).toBe(true);
    expect(flock.birds.filter(b => b.state === 6)).toHaveLength(row.guide?.formation.length ?? 0);
    for (let i = 0; i < 1800; i++) flock.update(1 / 60, eye);
    expect(flock.birds.every(b => [b.x, b.y, b.z, b.yaw, b.pitch, b.flap].every(Number.isFinite))).toBe(true);
    expect(flock.birds.some(b => b.state === 6)).toBe(false);
    if (row.wheeling === null) expect(flock.birds.every(b => b.state === 0)).toBe(true);
    else expect(flock.birds.some(b => b.state !== 0)).toBe(true);
  }
});

test('Pine scavenge and visit modes belong to counted custom code', () => {
  expect(() => new AmbientFlock(pine.scavenger.flock)).toThrow('content owner');
  const ravens = new PineVisitors(pine.scavenger.flock, [], () => 0);
  const site = ravens.gather(60, 40, 0.8, 2);
  expect(site).toBeGreaterThanOrEqual(0);
  expect(ravens.siteVisit(site)).toBe(1);
  for (let i = 0; i < 600; i++) ravens.update(1 / 60, eye);
  expect(ravens.birds.filter(b => b.state !== 0)).toHaveLength(2);
  ravens.release(site, eye);
  for (let i = 0; i < 1200; i++) ravens.update(1 / 60, eye);
  expect(ravens.siteVisit(site)).toBe(3);
  expect(ravens.birds.every(b => b.state === 0)).toBe(true);
  const owl = new PineVisitors(pine.sentinel.flock, [{ x: 40, y: 10, z: 30 }], () => 0);
  expect(owl.visitAt(40, 30, 20, eye)).toBe(true);
  for (let i = 0; i < 2400; i++) owl.update(1 / 60, eye);
  expect(owl.birds[0]?.state).toBe(10);
  for (let i = 0; i < 1200; i++) owl.update(1 / 60, { ...eye, light: 0 });
  expect(owl.birds[0]?.state).toBe(0);
});
