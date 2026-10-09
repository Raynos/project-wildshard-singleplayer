import { expect, it } from 'vitest';
import { Vector3 } from 'three';
import { PineGustClock } from '../../../src/shards/pine-hollow/runtime/weapons/gustClock';

// Frozen CPU mirror of the shipping wind shader/profile, not a second weather owner.
function shippingWind(x: number, z: number, time: number, boost: number): number {
  let gust = 0.5 + 0.28 * Math.sin(time * 0.11) + 0.16 * Math.sin(time * 0.37 + 1.3) + 0.08 * Math.sin(time * 1.3 + 0.4);
  if (boost > 0) gust += boost * (0.45 - 0.25 * gust);
  gust = Math.min(1, Math.max(0, gust));
  const front = (s: number): number => {
    const f = s - Math.floor(s), w = f + 0.12 * (1 - Math.cos(6.283185307 * f)), c = 0.5 + 0.5 * Math.cos(6.283185307 * w);
    return c * c;
  };
  const along = x * -0.55 + z * 0.83, across = -x * 0.83 + z * -0.55;
  const bend = 22 * Math.sin(across * 0.021 + time * 0.043) + 9 * Math.sin(across * 0.057 - time * 0.031);
  const s = along + bend - time * 11;
  const f = 0.75 * front(s / 150) + 0.25 * front(s / (0.61 * 150) + 0.37);
  const patchy = 0.62 + 0.38 * Math.sin(across * 0.025 + along * 0.004 - time * 0.05);
  return (0.3 + 0.7 * gust) * (0.3 + 0.9 * f * patchy);
}

it('matches the page numeric wind and resumes every sample exactly after a JSON continuation', () => {
  let boost = 0;
  const wind = new PineGustClock(() => boost), restored = new PineGustClock(() => boost);
  let time = 0;
  for (let tick = 0; tick < 1200; tick++) {
    boost = (tick % 127) / 126;
    const dt = tick % 2 === 0 ? 1 / 60 : 1 / 30;
    time += dt; wind.advance(dt);
    const savedJson = JSON.stringify(wind.snapshot());
    restored.restore(JSON.parse(savedJson));
    const x = tick / 3 - 200, z = Math.sin(tick) * 250;
    const out = wind.vecAt(x, z, new Vector3(0, 0.2, 0));
    const speed = 1.2 + 7 * shippingWind(x, z, time, boost);
    expect(out.toArray()).toEqual([-0.55 * speed, 0.2, 0.83 * speed]);
    expect(restored.vecAt(x, z, new Vector3(0, 0.2, 0)).toArray()).toEqual(out.toArray());
    expect(restored.snapshot()).toEqual(wind.snapshot());
  }
});

it('refuses malformed continuation atomically without constructing weather or consuming RNG', () => {
  const wind = new PineGustClock(() => 0);
  wind.advance(1);
  const before = wind.snapshot();
  for (const invalid of [{ ...before, version: 2 }, { ...before, time: -1 }, { ...before, gust: Number.NaN }, { ...before, gust: 2 }, { ...before, weather: {} }]) {
    expect(() => wind.restore(invalid)).toThrow(); expect(wind.snapshot()).toEqual(before);
  }
  expect(() => wind.advance(-1)).toThrow(); expect(wind.snapshot()).toEqual(before);
});
