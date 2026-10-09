
/**
 * The light the steppe's creatures see by (B10; was skyRig.ts `lightLevel`), renderer-free so the page's weather wiring
 * (world/installWeather.ts) and a renderer-free host (runtime/headless.ts) read one rule.
 */

/** The clock as the light reads it (a DayCycle: the page's or the host's): the sun's elevation, degrees. */
export interface SunClock { readonly sunElevation: number }
const smoothstep = (e0: number, e1: number, x: number): number => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

/** a sky-light level 0..1 (day 1 · dusk ~0.7 · night ~0.4) from the sun's elevation — the stealth `light` factor reads it */
export function lightLevel(clock: SunClock): number {
  const el = clock.sunElevation;
  return 0.4 + 0.3 * smoothstep(-14, -2, el) + 0.3 * smoothstep(-2, 10, el);
}

/** the light a storm leaves (the gust front and the storm proper dim the day to this; night stays darker) */
export const STORM_LIGHT = 0.6;

/** `wildEnv.light`: the hour's light, dimmed by an active storm (creatures/env.ts) */
export function wildLight(clock: SunClock, stormActive: boolean): number { return Math.min(lightLevel(clock), stormActive ? STORM_LIGHT : 1); }
