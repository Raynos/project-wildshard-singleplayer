// src/world/wind.ts — the forest's gust field (PH-L6): the CPU mirror of the GLSL `windGustAt` every pine, grass clump
// and fern samples. A front must be bounded (no NaN / blow-ups into the vertex shaders), smooth, and travel downwind.
import { describe, expect, it } from 'vitest';
import { FRONT_LEN, FRONT_SPEED, WIND_DIR, WIND_FIELD_GLSL, windGustAt } from '../src/world/wind';

/** the strongest point of the field along the wind line through the origin, searched over one front length */
function crest(t: number, from: number): number {
  let best = from, bestG = -1;
  for (let a = from; a < from + FRONT_LEN; a += 0.25) {
    const g = windGustAt(WIND_DIR.x * a, WIND_DIR.z * a, t, 0.5);
    if (g > bestG) { bestG = g; best = a; }
  }
  return best;
}

describe('windGustAt (the shared gust front)', () => {
  it('stays finite and in [0.09, 1.2] everywhere, at every gust level', () => {
    for (let i = 0; i < 4000; i++) {
      const x = ((i * 37) % 500) - 250, z = ((i * 91) % 500) - 250, t = i * 0.73, gust = (i % 11) / 10;
      const g = windGustAt(x, z, t, gust);
      expect(Number.isFinite(g)).toBe(true);
      expect(g).toBeGreaterThanOrEqual(0.09 - 1e-9);
      expect(g).toBeLessThanOrEqual(1.2 + 1e-9);
    }
  });

  it('is smooth: a metre or a frame apart it barely changes (no seams where a front wraps)', () => {
    for (let i = 0; i < 2000; i++) {
      const x = ((i * 53) % 500) - 250, z = ((i * 29) % 500) - 250, t = i * 1.37;
      const g = windGustAt(x, z, t, 0.6);
      expect(Math.abs(windGustAt(x + 1, z, t, 0.6) - g)).toBeLessThan(0.08);
      expect(Math.abs(windGustAt(x, z, t + 1 / 30, 0.6) - g)).toBeLessThan(0.05);
    }
  });

  it('has fronts: a strong band and a lull along the wind line', () => {
    let lo = Infinity, hi = -Infinity;
    for (let a = -250; a < 250; a += 1) { const g = windGustAt(WIND_DIR.x * a, WIND_DIR.z * a, 100, 0.5); lo = Math.min(lo, g); hi = Math.max(hi, g); }
    expect(hi - lo).toBeGreaterThan(0.25);
  });

  it('the front rolls downwind at about FRONT_SPEED', () => {
    const t0 = 40, dt = 2, c0 = crest(t0, -60);
    const c1 = crest(t0 + dt, c0 - 10);
    const speed = (c1 - c0) / dt;
    expect(speed).toBeGreaterThan(FRONT_SPEED * 0.6);
    expect(speed).toBeLessThan(FRONT_SPEED * 1.4);
  });

  it('a stronger global gust means stronger wind everywhere', () => {
    for (let i = 0; i < 200; i++) {
      const x = i * 2.3 - 200, z = i * -1.7 + 90, t = i * 0.9;
      expect(windGustAt(x, z, t, 0.9)).toBeGreaterThan(windGustAt(x, z, t, 0.2));
    }
  });

  it('the GLSL declares the shared uniforms and the helpers the forest shaders call', () => {
    for (const s of ['uniform float uWindTime', 'uniform float uGust', 'vec2 windDirXZ()', 'float windGustAt( vec2 p )']) expect(WIND_FIELD_GLSL).toContain(s);
  });
});
