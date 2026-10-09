import * as v from 'valibot';
import { TickScheduler } from '@wildshard/engine/app/scheduler';
import { PineWeather, type PineWeatherMode } from '../world/weatherProfile';
import { PineGustClock } from './weapons/gustClock';

const INVALID_PHASE = new RangeError('Invalid weather day phase');
const Time = v.object({ time: v.number() });
const Saved = v.strictObject({ version: v.literal(1), weather: v.unknown(), wind: v.unknown(),
  cadence: v.pipe(v.string(), v.maxLength(16384)), boost: v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(1)),
});

/** One weather owner and its projectile wind, with the page's weather cadence. The caller supplies each world-frame
 * delta and day phase. No callback or setting is installed here; page/render versus native input clocks remain explicit. */
export class PineAir {
  readonly weather: PineWeather;
  readonly wind: PineGustClock;
  private cadence = TickScheduler.isolated();
  private publishedBoost = 0;
  private readonly system = { id: 'pine.weather', phase: 'update' as const, tick: 'weather', run: (): void => undefined };

  constructor(options: { seed: number; mode?: PineWeatherMode }) {
    this.weather = new PineWeather(options);
    this.wind = new PineGustClock(() => this.publishedBoost);
  }

  /** The early forest update reads the previous published boost. The later weather system publishes its new value. */
  step(dt: number, dayPhase: number): void {
    if (!Number.isFinite(dayPhase)) throw INVALID_PHASE;
    this.cadence.beginFrame(dt);
    const due = this.cadence.systemDt(this.system, dt);
    this.wind.advance(dt);
    if (due > 0) this.weather.update(due, dayPhase);
    this.publishedBoost = this.weather.wind;
  }

  snapshot(): { version: 1; weather: ReturnType<PineWeather['captureWeather']>; wind: ReturnType<PineGustClock['snapshot']>; cadence: string; boost: number } {
    return { version: 1, weather: this.weather.captureWeather(), wind: this.wind.snapshot(), cadence: this.cadence.captureIsolated(this.system), boost: this.publishedBoost };
  }

  /** All three continuations validate before any live state changes; neither validation nor commit draws RNG. */
  prepareRestore(value: unknown): () => void {
    const saved = v.parse(Saved, value);
    const weather = this.weather.prepareWeatherRestore(saved.weather), wind = this.wind.prepareRestore(saved.wind);
    const cadence = TickScheduler.isolated();
    cadence.restoreIsolated(this.system, saved.cadence);
    if (v.parse(Time, saved.wind).time !== v.parse(Time, JSON.parse(saved.cadence)).time) {
      throw new RangeError('Incompatible weather wind clock');
    }
    return () => { weather(); wind(); this.cadence = cadence; this.publishedBoost = saved.boost; };
  }
  restore(value: unknown): void { this.prepareRestore(value)(); }
}
