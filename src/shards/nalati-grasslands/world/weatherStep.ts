import { installWeatherContinuation, installWeatherReactions, type WeatherReactions } from '@wildshard/game/plugin/weather';
import type { Scope } from '@wildshard/engine/app/scope';
import type { SimHost } from '@wildshard/engine/sim';
import { parseWeatherProgram, parseWeatherReactions, type WeatherProgram, type WeatherReactionRows } from '@wildshard/format/weatherProgram';
import type { PageWildEnvironment as WildEnv } from '@wildshard/game/population/pageGroups';
import { wildLight, type SunClock } from '../look/wildLight';
import * as v from 'valibot';

/**
 * The steppe weather's rules, renderer-free: the page's wiring (world/installWeather.ts) and the renderer-free host
 * (runtime/headless.ts) both run the admitted program and its reactions (generators/weatherDecision.mjs: the storm's bolts,
 * GET LOW and the wind it asks for, at 10 Hz on @wildshard/game/plugin/weather WeatherReactions), struck at the points
 * each one supplies (the page's spruces, the host's baked ones) and sheltered by the yurts.
 */
const reactions = new WeakMap<WeatherProgram, WeatherReactionRows>();
/** Decode the admitted phase rows and their reactions as one weather owner. */
export function readWeatherProgram(input: unknown): WeatherProgram {
  const rows = v.parse(v.object({ weather: v.unknown(), reactions: v.unknown() }), input), program = parseWeatherProgram(rows.weather);
  reactions.set(program, parseWeatherReactions(rows.reactions, program)); return program;
}

/** The storm on the level's seed: struck at `points` ([x, z, top]), never inside or beside a yurt (`yurts`: [x, z, r]). */
export function steppeStorm(seed: number, program: WeatherProgram, points: readonly (readonly [number, number, number])[],
  yurts: readonly (readonly [number, number, number])[], owner: { readonly host: SimHost } | { readonly scope: Scope }): WeatherReactions {
  const rows = reactions.get(program); if (rows === undefined) throw new Error('Weather reactions were not admitted');
  const air = installWeatherContinuation('host' in owner ? owner.host : { seed }, program, { phase: 0 }, undefined);
  return installWeatherReactions(air, { ...rows, points: points.map(p => [p[0], p[1], p[2]]), shelter: { ...rows.shelter, circles: yurts.map(y => [y[0], y[1], y[2]]) } }, owner);
}

/** What the creatures read from the hour and the storm: the light (dimmed by an active storm) and whether one is on. */
export function stormEnv(env: Pick<WildEnv, 'light' | 'storm'>, clock: SunClock, weather: WeatherReactions): void {
  env.light = wildLight(clock, weather.stormActive);
  env.storm = weather.stormActive;
}

/** What the creatures read from the wind: the way the air moves (unit) and its strength 0..1 (10 m/s and up is 1). */
export function windEnv(env: Pick<WildEnv, 'wind'>, wind: { readonly speed: number; readonly dirX: number; readonly dirZ: number }): void {
  env.wind.x = wind.dirX; env.wind.z = wind.dirZ; env.wind.strength = Math.min(1, wind.speed / 10);
}

/** The yurts as shelter circles, from the POI colliders (Yurt.ts: two crossed squares of half-width 0.93 R per yurt). */
export function yurtsOf(colliders: readonly { readonly x: number; readonly z: number; readonly hw: number; readonly hd: number; readonly yTop: number; readonly yBottom: number }[]): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (const c of colliders) {
    if (Math.abs(c.hw - c.hd) > 0.01 || c.hw < 2.2 || c.hw > 3.6 || c.yTop - c.yBottom < 2.5) continue;
    if (out.some(([x, z]) => Math.abs(x - c.x) < 0.1 && Math.abs(z - c.z) < 0.1)) continue;
    out.push([c.x, c.z, c.hw / 0.93]);
  }
  return out;
}
