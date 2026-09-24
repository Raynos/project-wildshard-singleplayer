// src/world/PineDayNight.ts — Pine Hollow's day / night clock (PH-L2): the sun's path, the night curve, the named phases
// and the sky key table.
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { PINE_PHASES, pineMoonAt, pineNightAt, pineSunAt } from '../src/world/PineDayNight';
import { PINE_SKY_KEYS } from '../src/world/pineSkyKeys';

const DAY = 20 / 24;
const deg = (r: number): number => (r * 180) / Math.PI;
/** compass azimuth of a direction (0 = north = +Z, 90 = east = −X) */
const azimuth = (v: THREE.Vector3): number => ((deg(Math.atan2(-v.x, v.z)) % 360) + 360) % 360;

describe('the sun and the moon', () => {
  const v = new THREE.Vector3();
  it('rises in the north-east, stands 52° up in the south at noon, sets where the old fixed sunset was (NW, 306°)', () => {
    pineSunAt(0, v); expect(v.y).toBeCloseTo(0, 5); expect(azimuth(v)).toBeCloseTo(54, 3);
    pineSunAt(DAY / 2, v); expect(deg(Math.asin(v.y))).toBeCloseTo(52, 3); expect(azimuth(v)).toBeCloseTo(180, 3);
    pineSunAt(DAY - 1e-9, v); expect(v.y).toBeCloseTo(0, 5); expect(azimuth(v)).toBeCloseTo(306, 3);
  });
  it('stays under the horizon all night, and every direction is a unit vector', () => {
    for (let p = 0; p < 1; p += 0.01) {
      pineSunAt(p, v); expect(v.length()).toBeCloseTo(1, 6);
      if (p > DAY + 0.001) expect(v.y).toBeLessThan(0);
      pineMoonAt(p, v); expect(v.length()).toBeCloseTo(1, 6); expect(v.y).toBeGreaterThan(0.4); // the moon is always ≥ 26° up
    }
  });
  it('the sunset key lands near the old fixed sunset (≈ 6° up, NW)', () => {
    pineSunAt(PINE_PHASES.sunset, v);
    expect(deg(Math.asin(v.y))).toBeGreaterThan(4); expect(deg(Math.asin(v.y))).toBeLessThan(9);
    expect(azimuth(v)).toBeGreaterThan(290);
  });
});

describe('the night curve', () => {
  it('is 0 all day, 1 at the night key, and never leaves [0, 1]', () => {
    for (let p = 0; p < DAY - 0.02; p += 0.01) expect(pineNightAt(p)).toBe(0);
    expect(pineNightAt(PINE_PHASES.night)).toBeCloseTo(1, 6);
    for (let p = 0; p < 1; p += 0.001) { const n = pineNightAt(p); expect(n).toBeGreaterThanOrEqual(0); expect(n).toBeLessThanOrEqual(1); }
  });
});

describe('the sky keys', () => {
  it('every key names a Poly Haven pure sky, its sun on the set\'s common heading, a sane paint radius', () => {
    for (const k of Object.values(PINE_SKY_KEYS)) {
      expect(k.id).toMatch(/^qwantani_[a-z_0-9]+_puresky$/);
      expect(Math.abs(k.sunU - 0.6)).toBeLessThan(0.02);
      expect(k.paint).toBeGreaterThanOrEqual(0); expect(k.paint).toBeLessThanOrEqual(20);
    }
  });
  it('the named phases are in [0, 1) and in day / night order', () => {
    for (const p of Object.values(PINE_PHASES)) { expect(p).toBeGreaterThanOrEqual(0); expect(p).toBeLessThan(1); }
    expect(PINE_PHASES.sunrise).toBeLessThan(PINE_PHASES.morning);
    expect(PINE_PHASES.golden).toBeLessThan(PINE_PHASES.sunset);
    expect(PINE_PHASES.sunset).toBeLessThan(DAY);
    expect(PINE_PHASES.night).toBeGreaterThan(DAY);
  });
});
