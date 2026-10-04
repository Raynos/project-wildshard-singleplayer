import { DayCycle, Weather, type DayCycleClock } from '@wildshard/engine';
import type { ShardContext } from '@wildshard/game';

/** Small authored schedules exercise both engine mechanisms without a custom renderer. */
export function createDay(): DayCycle {
  return new DayCycle({ units: 'hour', start: 12,
    schedule: [{ phase: 'day', from: 0, to: 24, minutes: 12 }],
    sun: { maxElevation: 60, azimuthOffset: 35 },
    fixed: { midday: 12, golden: 17, sunset: 18, night: 0 }, presets: { dawn: 6, noon: 12, dusk: 18, night: 0 } });
}
export function installClimate(ctx: ShardContext): { day: DayCycleClock; weather: Weather<'clear' | 'cloudy'> } {
  const builtDay = ctx.app.dayCycle, day = builtDay ?? createDay();
  const weather = new Weather<'clear' | 'cloudy'>({ states: ['clear', 'cloudy'], next: { clear: 'cloudy', cloudy: 'clear' },
    length: { clear: [60, 90], cloudy: [30, 45] }, soak: 0.1, dry: 0.1,
    initial: () => ({ overcast: 0, rain: 0, wet: 0, wind: 0.1, fog: 0 }),
    numbers: ({ state }) => ({ overcast: state === 'cloudy' ? 0.5 : 0, rain: 0, wet: 0, wind: 0.1, fog: 0 }),
    modes: { live: 'none', clear: { hold: 'clear', dry: true } } }, ctx.app.rng.stream('gameplay'));
  ctx.app.registerDayCycle(day, ctx.scope);
  ctx.system({ id: 'template.climate', phase: 'update', run: (dt) => { if (builtDay === null) day.update(dt); weather.update(dt, day); } });
  return { day, weather };
}
