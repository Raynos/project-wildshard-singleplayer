// src/world/PineWeather.ts (PINE-HOLLOW-REMASTER PH-L10): the showers' state machine and the dawn fog's clock.
import { describe, expect, it } from 'vitest';
import { PineWeather, dawnFogAt, PINE_WEATHER_LEN } from '../src/world/PineWeather';

/** run `secs` of weather in 1 s steps at a fixed clock phase; the states seen, in order (no repeats) */
function run(w: PineWeather, secs: number, phase = 0.4): string[] {
  const seen: string[] = [w.state];
  for (let t = 0; t < secs; t++) { w.update(1, phase); if (seen[seen.length - 1] !== w.state) seen.push(w.state); }
  return seen;
}

describe('the dawn fog', () => {
  it('lies from the last of the night through sunrise and burns off by mid-morning', () => {
    expect(dawnFogAt(0.4167)).toBe(0);          // noon
    expect(dawnFogAt(0.85)).toBe(0);            // dusk
    expect(dawnFogAt(0.9)).toBe(0);             // night
    expect(dawnFogAt(0.975)).toBe(1);           // just before sunrise
    expect(dawnFogAt(0.008)).toBe(1);           // sunrise
    expect(dawnFogAt(0.085)).toBeGreaterThan(0.2); // the morning key: thinning
    expect(dawnFogAt(0.085)).toBeLessThan(0.8);
    expect(dawnFogAt(0.15)).toBe(0);            // mid-morning: gone
    expect(dawnFogAt(1.008)).toBe(dawnFogAt(0.008)); // wraps
  });
  it('is thinned by a cloud deck, held by ?weather=fog, off in clear', () => {
    const live = new PineWeather({ seed: 1 });
    live.update(0.1, 0.0); expect(live.fog).toBe(1);
    live.force('rain', 0.5); live.update(0.1, 0.0); expect(live.fog).toBeCloseTo(0.4, 5);
    const fog = new PineWeather({ seed: 1, mode: 'fog' });
    fog.update(0.1, 0.4167); expect(fog.fog).toBe(1); expect(fog.rain).toBe(0);
    const clear = new PineWeather({ seed: 1, mode: 'clear' });
    clear.update(0.1, 0.0); expect(clear.fog).toBe(0);
  });
});

describe('the showers', () => {
  it('cycle clear → overcast → rain → clearing → clear, a shower 3–6 min, the next 15–25 min later', () => {
    const w = new PineWeather({ seed: 7 });
    expect(w.state).toBe('clear');
    expect(w.phaseLen).toBeGreaterThanOrEqual(7 * 60);  // the first one comes sooner
    expect(w.phaseLen).toBeLessThanOrEqual(12 * 60);
    const seen = run(w, 3 * 3600);
    expect(seen.slice(0, 5)).toEqual(['clear', 'overcast', 'rain', 'clearing', 'clear']);
    expect(PINE_WEATHER_LEN.rain).toEqual([180, 360]);
    expect(PINE_WEATHER_LEN.clear).toEqual([15 * 60, 25 * 60]);
  });
  it('raining: overcast, wind up, the ground soaks; after it the ground dries', () => {
    const w = new PineWeather({ seed: 3 });
    w.force('rain', 0.5);
    expect(w.state).toBe('rain');
    expect(w.overcast).toBe(1);
    expect(w.rain).toBeGreaterThan(0.9);
    expect(w.wet).toBe(1);
    expect(w.wind).toBeGreaterThan(0.5);
    w.hold = false;
    run(w, 600); // through the clearing
    expect(w.rain).toBe(0);
    expect(w.overcast).toBe(0);
    expect(w.wet).toBeLessThan(1);
    run(w, 400);
    expect(w.wet).toBe(0);
  });
  it('holds a forced phase, and clear mode never rains', () => {
    const w = new PineWeather({ seed: 5, mode: 'rain' });
    run(w, 2000);
    expect(w.state).toBe('rain');
    const c = new PineWeather({ seed: 5, mode: 'clear' });
    const seen = run(c, 4 * 3600);
    expect(seen).toEqual(['clear']);
    expect(c.rain + c.overcast + c.wet).toBe(0);
  });
  it('is deterministic per seed', () => {
    const a = new PineWeather({ seed: 11 }), b = new PineWeather({ seed: 11 });
    run(a, 5000); run(b, 5000);
    expect([a.state, a.phaseT, a.rain]).toEqual([b.state, b.phaseT, b.rain]);
  });
});
