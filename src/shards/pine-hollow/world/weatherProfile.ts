import type { ProjectileModification } from '@wildshard/engine/combat/ammo';
import { Rng } from '@wildshard/engine/core/rng';
import { Weather, type WeatherProfile } from '@wildshard/engine/world/weather';
import { WET_GRAVITY, WET_DRAG } from '../loadout/ammo';

export type PineWeatherState = 'clear' | 'overcast' | 'rain' | 'clearing';
export const PINE_WEATHER_STATES: readonly PineWeatherState[] = ['clear', 'overcast', 'rain', 'clearing'];
export type PineWeatherMode = 'live' | 'clear' | 'fog' | 'rain';

/** seconds: each phase's length range (the clear one is minutes of play between showers) */
export const PINE_WEATHER_LEN: Record<PineWeatherState, readonly [number, number]> = {
  clear: [15 * 60, 25 * 60], overcast: [75, 105], rain: [180, 360], clearing: [70, 100],
};
/** the first shower comes sooner than the rest (a session should see one) */
const FIRST_CLEAR: readonly [number, number] = [7 * 60, 12 * 60];
/** seconds of full rain to soak the ground; seconds of clear sky to dry it again */
const SOAK_S = 50, DRY_S = 150;

const sm = (e0: number, e1: number, x: number): number => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
const mix = (a: number, b: number, t: number): number => a + (b - a) * t;

/** the dawn ground fog at clock phase p (0..1, PineDayNight's; sunrise at 0.008): 0 by day … 1 from late night into sunrise */
export function dawnFogAt(p: number): number {
  const q = ((p % 1) + 1) % 1;
  if (q >= 0.5) return sm(0.93, 0.965, q);
  return 1 - sm(0.05, 0.14, q);
}


export const PINE_WEATHER: WeatherProfile<PineWeatherState> = {
 states: PINE_WEATHER_STATES, next: { clear: 'overcast', overcast: 'rain', rain: 'clearing', clearing: 'clear' },
 length: PINE_WEATHER_LEN, firstLength: { clear: FIRST_CLEAR }, soak: SOAK_S, dry: DRY_S,
 sampleFixed: true, zeroOutputs: true, forceHold: true, forceAt: 0.5,
 modes: { live: 'none', rain: { hold: 'rain', at: 0.5 }, clear: { hold: 'clear', dry: true }, fog: { hold: 'clear', dry: true } },
 initial: () => ({ overcast: 0, rain: 0, wet: 0, wind: 0, fog: 0 }),
 forceWet: (s,t) => s === 'rain' ? sm(0, SOAK_S, t) : s === 'clearing' ? 1 : 0,
 numbers: ({ state, mode, t, u, dt, prev, clockPhase }) => {
 let wet = prev.wet;

    let overcast = 0, rain = 0, wind = 0;
    if (mode !== 'clear' && mode !== 'fog') {
      switch (state) {
        case 'clear': break;
        case 'overcast':
          overcast = sm(0, 1, u);
          rain = 0.22 * sm(0.75, 1, u);           // the first drops
          wind = 0.35 * sm(0, 1, u);
          break;
        case 'rain':
          overcast = 1;
          rain = mix(0.22, 1, sm(0, 40, t)) * mix(1, 0.7, sm(0.8, 1, u));
          wind = mix(0.35, 0.6, sm(0, 30, t));
          break;
        case 'clearing':
          overcast = 1 - sm(0, 1, u);
          rain = 0.7 * (1 - sm(0, 0.55, u));
          wind = 0.6 * (1 - sm(0, 1, u));
          break;
        default: break;
      }
    }
    
    // wet: soaks with the rain, holds through the clearing, dries in the sun after
    if (mode === 'clear' || mode === 'fog') wet = 0;
    else if (rain > 0.05) wet = Math.min(1, wet + dt * rain / SOAK_S);
    else if (state !== 'clearing') wet = Math.max(0, wet - dt / DRY_S); // the clearing holds it
    // the dawn fog: the clock's, thinned under cloud; held full in 'fog' mode; none in 'clear'
    const fog = mode === 'fog' ? 1 : mode === 'clear' ? 0 : dawnFogAt(clockPhase) * (1 - 0.6 * overcast);
 return { overcast, rain, wet, wind, fog };
 },
};

/** Content adapter only; the transition loop is the engine's Weather. */
export class PineWeather extends Weather<PineWeatherState> {
 constructor(opts: { seed: number; mode?: PineWeatherMode }) {
  super(PINE_WEATHER, new Rng(opts.seed ^ 0x3e7a));
  this.setMode(opts.mode ?? 'live');
 }
 get untilRain(): number { return this.state === 'clear' ? this.phaseLen - this.phaseT + PINE_WEATHER_LEN.overcast[0] : this.state === 'overcast' ? this.phaseLen - this.phaseT : 0; }
}

/** Preserve Pine's authored decimal increments and the dry pitch-bolt row. */
export function wetProjectile(input: ProjectileModification, rain: number): ProjectileModification {
  if (input.ammo.wet === undefined) return input;
  const r = Math.max(0, Math.min(1, rain));
  return { ...input, gravity: input.gravity * (1 + WET_GRAVITY * r), drag: input.drag * (1 + WET_DRAG * r) };
}

