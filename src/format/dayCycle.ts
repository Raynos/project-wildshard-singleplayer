/**
 * The day clock's pure row contracts (DS1.1): the named parts of a day, a schedule segment and a clock row as plain
 * data, the part of the engine's `DayCycleSpec` (`@wildshard/engine/world/dayCycle`) a shard declares in its `data/`.
 * The clock's law is `@wildshard/engine/sim/dayClock`; sun paths, look keys and curves stay engine-side functions.
 */

/** The named parts of a day, in order. */
export type DayClockPhase = 'dawn' | 'day' | 'golden' | 'dusk' | 'night';
/** One schedule segment: the phase, its hours [from, to) (to may pass 24) and its real-time minutes. */
export interface DayClockSegment { phase: DayClockPhase; from: number; to: number; minutes: number }

/**
 * A day clock as a row: its schedule, its start in its units, the units (a uniform 'phase' clock or a scheduled 'hour'
 * clock), the sun's arc (its highest elevation and its azimuth offset, degrees), the fixed time picks and the light
 * presets (each a value in the clock's units), the day's share of a phase clock and whether a pin also pauses it.
 */
export interface DayClockRow {
  readonly schedule: readonly DayClockSegment[];
  readonly start: number;
  /** Uniform clocks retain phase arithmetic; scheduled clocks retain hour arithmetic. */
  readonly units: 'phase' | 'hour';
  readonly sun: { readonly maxElevation: number; readonly azimuthOffset: number };
  readonly fixed: Readonly<Record<'midday' | 'golden' | 'sunset' | 'night', number>>;
  readonly presets: Readonly<Record<'dawn' | 'noon' | 'dusk' | 'night', number>>;
  readonly dayFraction?: number;
  /** Phase clocks historically pin once per frame; hour clocks also pause. */
  readonly pauseOnPin?: boolean;
}
