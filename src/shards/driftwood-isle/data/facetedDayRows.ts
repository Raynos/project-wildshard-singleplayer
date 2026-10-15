import type { DayClockStyle } from '@wildshard/sdk/looks/dayClock';
import type { DayLookPreset, DayLookSchema } from '@wildshard/sdk/looks/dayLookPresets';

/**
 * A faceted day's row types (SHARD-PLATFORM M3, look-family rows; the shared day clock `@wildshard/sdk/looks/dayClock` is its
 * clock): the keyed light presets, the keyframes, the arcs, the curves and the backdrop's numbers, all data
 * (data/skyDay.ts is Driftwood's row).
 */

type Rgb = readonly [number, number, number];
/** a colour as data: an sRGB hex number or linear RGB */
export type DayColour = number | Rgb;

/** one keyed light preset, as data */
export interface FacetedDayPresetRow {
  readonly sky: {
    readonly zenith: DayColour; readonly horizon: DayColour; readonly below: DayColour; readonly sunGlow: DayColour;
    readonly cloudLit: DayColour; readonly cloudShade: DayColour; readonly night: number;
  };
  /** the light body (the sun by day, the moon by night): colour, intensity */
  readonly light: DayColour; readonly lightI: number;
  readonly hemiSky: DayColour; readonly hemiGround: DayColour; readonly hemiI: number;
  readonly lift: DayColour; readonly rim: DayColour; readonly fogNear: DayColour; readonly fogSun: DayColour;
  readonly disc: DayColour; readonly cloudShadow: number; readonly dusk: number;
}

/** a faceted day's row: the shared clock's row (presets, keyframes, arcs, curves) and the backdrop's numbers */
export interface FacetedDayStyle extends DayClockStyle<typeof FACETED_DAY_PRESET> {
  readonly presets: Readonly<Record<string, FacetedDayPresetRow>>;
  /** the shadow light turns in steps of this many degrees */
  readonly shadowStepDeg: number;
  /** seconds between environment re-renders */
  readonly envRefresh: number;
  /** the PMREM cube size of the dome's environment */
  readonly envSize: number;
  /** the sun before the clock moves it (normalised) */
  readonly startSun: Rgb;
  /** the planet's lit-side haze: the horizon toward this colour, by this much by day */
  readonly planetHaze: Rgb; readonly planetHazeDay: number;
  /** the disc's scale by night */
  readonly moonDisc: number;
  /** the level's sun intensity this row's `lightI` is relative to */
  readonly sunIBase: number;
}

/** A preset's fields by kind (`dayLookPresets`: the row → its live preset, copied and blended by the clock). */
export const FACETED_DAY_PRESET = {
  sky: { zenith: 'colour', horizon: 'colour', below: 'colour', sunGlow: 'colour', cloudLit: 'colour', cloudShade: 'colour', night: 'number' },
  light: 'colour', lightI: 'number', hemiSky: 'colour', hemiGround: 'colour', hemiI: 'number',
  lift: 'colour', rim: 'colour', fogNear: 'colour', fogSun: 'colour', disc: 'colour', cloudShadow: 'number', dusk: 'number',
} as const satisfies DayLookSchema & Record<keyof FacetedDayPresetRow, unknown>;

/** one live preset (the row's colours as three.js colours) */
export type FacetedDayPreset = DayLookPreset<typeof FACETED_DAY_PRESET>;
