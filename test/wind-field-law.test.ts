import { describe, expect, it } from 'vitest';
import { clockGust, fieldGustAt } from '../src/engine/world/windField';

// Frozen CPU mirror from world/wind.ts before extraction; the render wrapper and native world supply their own clock.
function shippingField(x: number, z: number, t: number, gust: number): number {
  const front = (s: number): number => {
    const f = s - Math.floor(s), w = f + 0.12 * (1 - Math.cos(6.283185307 * f));
    const c = 0.5 + 0.5 * Math.cos(6.283185307 * w); return c * c;
  };
  const along = x * -0.55 + z * 0.83, across = -x * 0.83 + z * -0.55;
  const bend = 22 * Math.sin(across * 0.021 + t * 0.043) + 9 * Math.sin(across * 0.057 - t * 0.031);
  const s = along + bend - t * 11;
  const f = 0.75 * front(s / 150) + 0.25 * front(s / (0.61 * 150) + 0.37);
  const patchy = 0.62 + 0.38 * Math.sin(across * 0.025 + along * 0.004 - t * 0.05);
  return (0.3 + 0.7 * gust) * (0.3 + 0.9 * f * patchy);
}

describe('explicit-clock numeric wind law', () => {
  it('matches the shipping clock and CPU shader mirror over weather boosts and negative/front-boundary positions', () => {
    const field = { x: -0.55, z: 0.83, frontLength: 150, frontSpeed: 11, secondaryLength: 0.61 * 150 };
    for (let tick = 0; tick < 1200; tick++) for (const boost of [0, 0.2, 0.7, 1]) {
      const t = tick / 60;
      let g = 0.5 + 0.28 * Math.sin(t * 0.11) + 0.16 * Math.sin(t * 0.37 + 1.3) + 0.08 * Math.sin(t * 1.3 + 0.4);
      if (boost > 0) g += boost * (0.45 - 0.25 * g);
      g = Math.min(1, Math.max(0, g));
      expect(clockGust(t, boost)).toBe(g);
      const x = -250 + tick % 501, z = 250 - tick * 0.35;
      expect(fieldGustAt(x, z, t, g, field)).toBe(shippingField(x, z, t, g));
    }
  });

  it('has no ambient clock and accepts a different authored front without changing the shared law', () => {
    const field = { x: 1, z: 0, frontLength: 90, frontSpeed: 4, secondaryLength: 30 };
    expect(fieldGustAt(10, -20, 5, 0.6, field)).toBe(fieldGustAt(10, -20, 5, 0.6, field));
    expect(fieldGustAt(10, -20, 5, 0.6, field)).not.toBe(fieldGustAt(10, -20, 6, 0.6, field));
  });
});
