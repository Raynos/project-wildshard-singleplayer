/**
 * PineWeather — Pine Hollow's weather as a seeded state machine (PINE-HOLLOW-REMASTER PH-L10; Jake's PH-U8: "dawn ground
 * fog + rain", no thunderstorms, no snow). The shape of Nalati's `Weather` (a phase clock and the 0..1 numbers every other
 * system reads), without its storm, lightning or DayClock.
 *
 *   clear (15–25 min) → overcast (75–105 s) → rain (3–6 min) → clearing (70–100 s) → clear
 *
 * No rendering here: `PineWeatherFX.ts` draws the rain, the puddles and the rings; `src/pinehollow/weather.ts` wires the
 * numbers into the clock (PineDayNight.mod), the fog, the wind, the wet PBR, the ambience and the animals.
 *
 *   const w = new PineWeather({ seed, mode });   // mode: 'live' | 'clear' (the before: no weather at all) | 'fog' | 'rain'
 *   w.update(dt, clockPhase)                     // every frame; the phase is PineDayNight.phase (the dawn fog follows it)
 *   w.state · overcast · rain · wet · wind · fog  // 0..1 each ('fog' = the dawn ground fog)
 *   w.force('rain', 0.5)                         // `?weather=rain&weatherT=0.5`: jump into a phase (and hold it)
 *
 * THE DAWN FOG is a function of the clock alone: it gathers in the last of the night (phase 0.93 → 0.965), lies through
 * sunrise and burns off by mid-morning (0.05 → 0.14 ≈ 1–3 min after the sun is up). A cloud deck thins it (fog forms under
 * a clear sky). `mode 'fog'` holds it full whatever the hour (the captures).
 */
import { Rng } from '../core/rng';

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

export interface PineWeatherOpts { seed: number; mode?: PineWeatherMode }

export class PineWeather {
  state: PineWeatherState = 'clear';
  /** seconds into the phase / its length */
  phaseT = 0;
  phaseLen: number;
  mode: PineWeatherMode;
  /** a forced phase (`?weather=rain`) does not run on */
  hold = false;

  // ── the outputs (recomputed every update) ──
  /** 0 clear … 1 a full grey deck overhead */
  overcast = 0;
  /** 0 … 1 heavy rain */
  rain = 0;
  /** 0 … 1 soaked (lags the rain, dries after it): the wet PBR and the puddles */
  wet = 0;
  /** 0 … 1 the wind the weather adds to wind.ts's gusts */
  wind = 0;
  /** 0 … 1 the dawn ground fog */
  fog = 0;

  private readonly rng: Rng;

  constructor(opts: PineWeatherOpts) {
    this.rng = new Rng(opts.seed ^ 0x3e7a);
    this.mode = opts.mode ?? 'live';
    this.phaseLen = this.rng.range(FIRST_CLEAR[0], FIRST_CLEAR[1]);
    this.setMode(this.mode);
  }

  /** the live pick (Settings ▸ Debug ▸ Weather): 'clear' turns the weather off (the before), 'rain' holds a shower */
  setMode(m: PineWeatherMode, at = 0.5): void {
    this.mode = m;
    if (m === 'rain') this.force('rain', at);
    else if (m === 'clear' || m === 'fog') { this.enter('clear'); this.hold = true; this.wet = 0; this.outputs(0, 0); }
    else this.hold = false;
  }

  /** jump into a phase, `at` 0..1 of the way through it (and hold it there) */
  force(s: PineWeatherState, at = 0.5): void {
    this.enter(s);
    this.phaseT = this.phaseLen * Math.min(0.999, Math.max(0, at));
    this.hold = true;
    // the ground is as wet as it would be by now
    this.wet = s === 'rain' ? sm(0, SOAK_S, this.phaseT) : s === 'clearing' ? 1 : 0;
    this.outputs(0, 0);
  }

  /** seconds until the next shower starts (0 while one is on) */
  get untilRain(): number {
    if (this.state === 'clear') return this.phaseLen - this.phaseT + PINE_WEATHER_LEN.overcast[0];
    if (this.state === 'overcast') return this.phaseLen - this.phaseT;
    return 0;
  }

  update(dt: number, clockPhase: number): void {
    if (dt <= 0) { this.outputs(0, clockPhase); return; }
    if (!this.hold) {
      this.phaseT += dt;
      if (this.phaseT >= this.phaseLen) {
        const i = PINE_WEATHER_STATES.indexOf(this.state);
        this.enter(PINE_WEATHER_STATES[(i + 1) % PINE_WEATHER_STATES.length] ?? 'clear');
      }
    }
    this.outputs(dt, clockPhase);
  }

  private enter(s: PineWeatherState): void {
    this.state = s;
    this.phaseT = 0;
    const [a, b] = PINE_WEATHER_LEN[s];
    this.phaseLen = this.rng.range(a, b);
  }

  private outputs(dt: number, clockPhase: number): void {
    const t = this.phaseT, u = this.phaseLen > 0 ? t / this.phaseLen : 0;
    let overcast = 0, rain = 0, wind = 0;
    if (this.mode !== 'clear' && this.mode !== 'fog') {
      switch (this.state) {
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
    this.overcast = overcast; this.rain = rain; this.wind = wind;
    // wet: soaks with the rain, holds through the clearing, dries in the sun after
    if (this.mode === 'clear' || this.mode === 'fog') this.wet = 0;
    else if (rain > 0.05) this.wet = Math.min(1, this.wet + dt * rain / SOAK_S);
    else if (this.state !== 'clearing') this.wet = Math.max(0, this.wet - dt / DRY_S); // the clearing holds it
    // the dawn fog: the clock's, thinned under cloud; held full in 'fog' mode; none in 'clear'
    this.fog = this.mode === 'fog' ? 1 : this.mode === 'clear' ? 0 : dawnFogAt(clockPhase) * (1 - 0.6 * overcast);
  }
}
