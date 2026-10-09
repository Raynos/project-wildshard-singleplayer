import type { WildEnv } from '../creatures/env';
import { wildLight, type SunClock } from '../look/wildLight';
import { SteppeStorm, type Exposed, type LightningWorld } from './Weather';

/**
 * The steppe weather's simulation rules, renderer-free (SF72): what the page's wiring (world/installWeather.ts, every frame)
 * and a renderer-free host (runtime/headless.ts, every fixed step) both run — the storm built on the level's seed, one frame
 * of its state machine with the Storm Titan's held storm and the wind it asks for, and what the creatures read from the
 * weather and the wind (creatures/env.ts `light`, `storm`, `wind`). The look, the effects, the HUD and the audio stay on the
 * page.
 */

/**
 * The storm's wind heading (Wind.dir convention: the way it blows, yaw-style): out of the NW toward the SE. Steppe storms
 * ride in from the north-west; it also keeps the shelf cloud off the late sun (WSW), as in storm-1.
 */
export const STORM_HEADING = Math.PI / 4;

/** The wind as the weather reads and steers it (the engine's steppe Wind, world/steppeWind.ts: the page's one, or a host's). */
export interface SteppeWindPort {
  readonly speed: number; readonly dir: number; readonly gustiness: number; readonly dirX: number; readonly dirZ: number;
  setTarget: (speed: number, dir: number, gustiness?: number, seconds?: number) => void;
}

/** The storm on the level's seed, coming FROM the opposite of its heading. */
export function steppeStorm(seed: number, world: LightningWorld): SteppeStorm {
  const weather = new SteppeStorm({ seed, world });
  weather.stormFrom = Math.atan2(Math.cos(STORM_HEADING), Math.sin(STORM_HEADING));
  return weather;
}

/** The wind's calm (the prevailing wind when the weather was wired) and the speed the storm last asked of it (null: none). */
export interface StormWind { readonly calm: { readonly speed: number; readonly dir: number; readonly gust: number }; asked: number | null }
/** The calm of `wind` as it stands now, nothing asked yet. */
export function stormWind(wind: SteppeWindPort): StormWind { return { calm: { speed: wind.speed, dir: wind.dir, gust: wind.gustiness }, asked: null }; }

/**
 * One frame of the storm (after the page sets `weather.hold` and steps its clock): the state machine; while the Storm Titan
 * holds it (`titanHeld`) the storm that called him rages on; then the wind — the gust front swings it round to the storm's
 * own heading (building and after keep the calm heading), and once the storm stops asking it eases back to the calm.
 */
export function stepStorm(weather: SteppeStorm, ask: StormWind, wind: SteppeWindPort, dt: number, titanHeld: boolean): void {
  weather.update(dt);
  if (titanHeld && weather.state === 'storm' && weather.phaseLeft < 30) weather.phaseT = weather.phaseLen - 30;   // it rages on
  if (weather.windSpeed !== null) {
    const dir = weather.state === 'building' ? ask.calm.dir : weather.state === 'after' ? ask.calm.dir : STORM_HEADING;
    wind.setTarget(weather.windSpeed, dir, weather.windGustiness, weather.state === 'gust' ? 6 : 10);
    ask.asked = weather.windSpeed;
  } else if (ask.asked !== null) {
    wind.setTarget(ask.calm.speed, ask.calm.dir, ask.calm.gust, 30);
    ask.asked = null;
  }
}

/** What the creatures read from the hour and the storm: the light (dimmed by an active storm) and whether one is on. */
export function stormEnv(env: Pick<WildEnv, 'light' | 'storm'>, clock: SunClock, weather: SteppeStorm): void {
  env.light = wildLight(clock, weather.stormActive);
  env.storm = weather.stormActive;
}

/** What the creatures read from the wind: the way the air moves (unit) and its strength 0..1 (10 m/s and up is 1). */
export function windEnv(env: Pick<WildEnv, 'wind'>, wind: SteppeWindPort): void {
  env.wind.x = wind.dirX; env.wind.z = wind.dirZ; env.wind.strength = Math.min(1, wind.speed / 10);
}

/** A yurt's footprint as the lightning reads it: its centre and radius (a step beside it, `r + 1.5` m, is shelter too). */
export interface YurtCircle { readonly x: number; readonly z: number; readonly r: number }
/** The yurts, from the POI colliders (Yurt.ts: two crossed squares of half-width 0.93 R per yurt). */
export function yurtsOf(colliders: readonly { readonly x: number; readonly z: number; readonly hw: number; readonly hd: number; readonly yTop: number; readonly yBottom: number }[]): YurtCircle[] {
  const out: YurtCircle[] = [];
  for (const c of colliders) {
    if (Math.abs(c.hw - c.hd) > 0.01 || c.hw < 2.2 || c.hw > 3.6 || c.yTop - c.yBottom < 2.5) continue;
    if (out.some((y) => Math.abs(y.x - c.x) < 0.1 && Math.abs(y.z - c.z) < 0.1)) continue;
    out.push({ x: c.x, z: c.z, r: c.hw / 0.93 });
  }
  return out;
}
/** Inside or right beside a yurt: no lightning reaches (x, z). */
export function yurtShelters(yurts: readonly YurtCircle[], x: number, z: number): boolean { return yurts.some((y) => (y.x - x) ** 2 + (y.z - z) ** 2 < (y.r + 1.5) ** 2); }

/**
 * The lightning's exposed trees around (x, z): every trunk of `near` (a forest's 16 m cell query, engine TreeGrid `nearby`,
 * in its order) within r, scored by its top (`top`), carrying `ref` (the page's live tree; a host passes none, so an armed
 * strike on a tree stays a saveable plain value).
 */
export function exposeTrees<T extends { readonly x: number; readonly z: number }>(near: readonly T[], top: (t: T) => number, ref: (t: T) => unknown, x: number, z: number, r: number, out: Exposed[]): void {
  for (const t of near) if ((t.x - x) ** 2 + (t.z - z) ** 2 <= r * r) out.push({ x: t.x, z: t.z, top: top(t), kind: 'tree', ref: ref(t) });
}
