import { DayCycle, type DayCycleSpec, type ScheduleSeg } from '#engine/world/dayCycle';

export const DEFAULT_SCHEDULE: ScheduleSeg[] = [
  { phase: 'dawn', from: 4.5, to: 7, minutes: 2.5 },
  { phase: 'day', from: 7, to: 16.5, minutes: 10 },
  { phase: 'golden', from: 16.5, to: 18, minutes: 3 },
  { phase: 'dusk', from: 18, to: 19.75, minutes: 3.5 },
  { phase: 'night', from: 19.75, to: 28.5, minutes: 7 },
];


export const NALATI_DAY: DayCycleSpec = {
 units: 'hour', start: 16, schedule: DEFAULT_SCHEDULE, sun: { maxElevation: 58, azimuthOffset: 0 }, pauseOnPin: true,
 fixed: { midday: 12, golden: 17.1, sunset: 17.85, night: 22.5 }, presets: { dawn: 5.6, noon: 12, dusk: 18.15, night: 22.5 },
};
export interface DayClockOpts { start?: number; schedule?: ScheduleSeg[]; maxElevation?: number; azimuthOffset?: number }
export function steppeClock(opts: DayClockOpts = {}): DayCycle {
 return new DayCycle({ ...NALATI_DAY, start: opts.start ?? 16, schedule: opts.schedule ?? DEFAULT_SCHEDULE, sun: { maxElevation: opts.maxElevation ?? 58, azimuthOffset: opts.azimuthOffset ?? 0 } });
}
export function clockForSun(sun: { azimuth: number; elevation: number }, opts: Omit<DayClockOpts, 'start' | 'azimuthOffset'> = {}): DayCycle {
 const maxEl = opts.maxElevation ?? 58;
 const x = Math.PI - Math.asin(Math.min(1, Math.max(-1, sun.elevation / maxEl)));
 const hour = 6 + x * 12 / Math.PI, az = 90 + (hour - 6) * 15;
 return steppeClock({ ...opts, start: hour, azimuthOffset: sun.azimuth - az });
}
