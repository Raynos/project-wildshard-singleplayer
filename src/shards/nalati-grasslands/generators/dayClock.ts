import type { DayClockRow } from '@wildshard/format/dayCycle';
import { NALATI_MANIFEST_ROWS } from './manifestRows';

/** The page and native clock's initial sun alignment, resolved from the authored manifest at build time. */
export function nalatiDayClockRow(): DayClockRow {
 const sun = NALATI_MANIFEST_ROWS.sky.sun, maxEl = 58;
 const x = Math.PI - Math.asin(Math.min(1, Math.max(-1, sun.elevation / maxEl)));
 const hour = 6 + x * 12 / Math.PI, az = 90 + (hour - 6) * 15;
 return { units: 'hour', start: hour, sun: { maxElevation: maxEl, azimuthOffset: sun.azimuth - az },
 schedule: [
  { phase: 'dawn', from: 4.5, to: 7, minutes: 2.5 },
  { phase: 'day', from: 7, to: 16.5, minutes: 10 },
  { phase: 'golden', from: 16.5, to: 18, minutes: 3 },
  { phase: 'dusk', from: 18, to: 19.75, minutes: 3.5 },
  { phase: 'night', from: 19.75, to: 28.5, minutes: 7 },
 ], pauseOnPin: true,
 fixed: { midday: 12, golden: 17.1, sunset: 17.85, night: 22.5 }, presets: { dawn: 5.6, noon: 12, dusk: 18.15, night: 22.5 },
 };
}
