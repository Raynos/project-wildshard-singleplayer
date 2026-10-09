import type { WildEnv } from '../creatures/env';
import { wildLight, type SunClock } from '../look/wildLight';
import { SteppeStorm, type LightningWorld } from './Weather';

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
