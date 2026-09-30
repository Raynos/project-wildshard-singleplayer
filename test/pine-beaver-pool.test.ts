// E322 F-L6: Pine Hollow's beaver pool (BEAVER_POOL in src/chunks/pineHollowLayout.ts, src/world/BeaverPool.ts). The
// terrain holds it (a bowl behind the dam, a riffle keeping the pond at its level), its water follows the drain, the
// creek still never runs uphill, and the dam's two levers stay on dry ground at the full level.
import { afterEach, describe, expect, it } from 'vitest';
import { PINE_HOLLOW } from '../src/chunks/pine-hollow';
import {
  BEAVER_DAM, BEAVER_POOL, CREEK, CREEK_BED, POND, beaverPoolLevel, creekBedAt, creekSpan, creekSurfaceAt, inBeaverPool,
} from '../src/chunks/pineHollowLayout';

const T = PINE_HOLLOW.terrain;
const { dam } = creekSpan();

/** the creek's line at arc length `s` */
function at(s: number): { x: number; z: number } {
  let acc = 0;
  for (let i = 0; i + 1 < CREEK.length; i++) {
    const a = CREEK[i], b = CREEK[i + 1];
    if (!a || !b) continue;
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (s <= acc + l) { const u = (s - acc) / l; return { x: a[0] + (b[0] - a[0]) * u, z: a[1] + (b[1] - a[1]) * u }; }
    acc += l;
  }
  throw new Error('past the creek');
}

afterEach(() => { beaverPoolLevel.y = BEAVER_POOL.full; });

describe('the beaver pool', () => {
  it('leaves the pond as it was: its level, and the riffle holds it', () => {
    expect(T.waterLevel()).toBe(POND.level);
    expect(BEAVER_POOL.full).toBe(POND.level);
    // the riffle's crest is under the pond's water, the drained pool's level under the crest
    expect(BEAVER_POOL.crest).toBeLessThan(POND.level);
    expect(BEAVER_POOL.drained).toBeLessThan(BEAVER_POOL.crest - 0.5);
  });

  it('is a basin: more than 120 m² under the full line, deepest > 0.6 m, and it drains to a bed the sluice empties', () => {
    let area = 0, deep = 0;
    for (let x = -165; x <= -110; x += 0.5) for (let z = 45; z <= 100; z += 0.5) {
      if (!inBeaverPool(x, z)) continue;
      const h = T.heightAt(x, z);
      if (h < BEAVER_POOL.full) { area += 0.25; deep = Math.max(deep, BEAVER_POOL.full - h); }
    }
    expect(area).toBeGreaterThan(120);
    expect(deep).toBeGreaterThan(0.6);
    // the channel falls from the riffle's back to the sluice, and the sluice's floor holds nothing above the drained level
    for (let s = BEAVER_POOL.riffle; s < dam; s += 0.5) expect(creekBedAt(s + 0.5)).toBeLessThanOrEqual(creekBedAt(s) + 1e-9);
    // drained, the pool stands on the sheet through the sluice (which starts CREEK_WATER.lead = 1 m before the crest)
    expect(creekBedAt(dam - 1) + 0.1).toBeLessThanOrEqual(BEAVER_POOL.drained + 1e-9);
    expect(CREEK_BED.sill).toBeLessThan(BEAVER_POOL.drained);
  });

  it('its water follows the level: wading depth over the pool, dry once drained', () => {
    const mid = at(BEAVER_POOL.centre + 2);
    const stream = T.streamAt;
    if (!stream) throw new Error('pine hollow has no streamAt');
    expect(stream(mid.x, mid.z)).toBe(BEAVER_POOL.full);
    beaverPoolLevel.y = BEAVER_POOL.drained;
    const w = stream(mid.x, mid.z);
    expect(w).not.toBeNull();
    // at most the trickle's few cm over the channel's bed
    expect((w ?? 0) - T.heightAt(mid.x, mid.z)).toBeLessThan(0.12);
  });

  it('the creek never runs uphill, full or drained', () => {
    for (const level of [BEAVER_POOL.full, BEAVER_POOL.drained]) {
      beaverPoolLevel.y = level;
      let prev = Infinity;
      for (let s = BEAVER_POOL.riffle; s < dam + 40; s += 0.25) {
        const y = creekSurfaceAt(s);
        expect(y).toBeLessThanOrEqual(prev + 1e-9);
        prev = y;
      }
    }
  });

  it("keeps the sluice's levers on dry banks at the full level", () => {
    const d0 = CREEK[BEAVER_DAM.at - 1], d1 = CREEK[BEAVER_DAM.at + 1];
    if (!d0 || !d1) throw new Error('no dam segment');
    const l = Math.hypot(d1[0] - d0[0], d1[1] - d0[1]), fx = (d1[0] - d0[0]) / l, fz = (d1[1] - d0[1]) / l;
    for (const side of [1, -1]) {
      const x = BEAVER_DAM.x + fz * side * 4.6 - fx * 1.2, z = BEAVER_DAM.z - fx * side * 4.6 - fz * 1.2;
      expect(T.heightAt(x, z)).toBeGreaterThan(BEAVER_POOL.full + 0.1);
    }
  });
});
