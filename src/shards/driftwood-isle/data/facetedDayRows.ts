import type { DayClockRow, DayClockSegment } from '@wildshard/format/dayCycle';
import type { DayLookSchema } from '@wildshard/sdk/looks/dayLookPresets';

/**
 * A faceted day's row types (SHARD-PLATFORM M3, look-family rows; runtime/looks/facetedDay is its clock): the keyed light
 * presets, the keyframes, the arcs, the curves and the backdrop's numbers, all data (data/skyDay.ts is Driftwood's row).
 */

type Rgb = readonly [number, number, number];
/** a colour as data: an sRGB hex number or linear RGB */
export type DayColour = number | Rgb;
type Range = readonly [number, number];

/** one keyed light preset, as data */
export interface FacetedDayPresetRow {
  readonly sky: {
    readonly zenith: DayColour; readonly horizon: DayColour; readonly below: DayColour; readonly sunGlow: DayColour;
    readonly cloudLit: DayColour; readonly cloudShade: DayColour; readonly night: number;
  };
  readonly sunColor: DayColour; readonly sunI: number;
  readonly hemiSky: DayColour; readonly hemiGround: DayColour; readonly hemiI: number;
  readonly lift: DayColour; readonly rim: DayColour; readonly fogNear: DayColour; readonly fogSun: DayColour;
  readonly disc: DayColour; readonly cloudShadow: number; readonly dusk: number;
}

/** a faceted day's row: the clock, presets, keyframes, arcs, curves and the backdrop's numbers */
export interface FacetedDayStyle {
  /** the day's share of the cycle: [0, dayFraction) is the day (sunrise → sunset), the rest the night */
  readonly dayFraction: number;
  /** the start phase with no Time of day pinned */
  readonly start: number;
  readonly schedule: readonly DayClockSegment[];
  /** Settings ▸ Time of day's fixed picks → the phase they park the clock at */
  readonly fixed: DayClockRow['fixed'];
  /** the engine's named light presets → phase */
  readonly namedPhases: DayClockRow['presets'];
  readonly presets: Readonly<Record<string, FacetedDayPresetRow>>;
  /** [phase, preset name], sorted */
  readonly frames: readonly (readonly [number, string])[];
  readonly sun: { readonly rise: number; readonly sweep: number; readonly noon: number; readonly nightRise: number; readonly nightSweep: number; readonly nadir: number };
  readonly moon: { readonly rise: number; readonly sweep: number; readonly base: number; readonly arc: number };
  readonly night: { readonly eve: Range; readonly eveHeight: number; readonly rise: Range; readonly fall: Range };
  /** the light's fade: the sun by its height, the moon in and out by phase */
  readonly fade: { readonly sunY: Range; readonly moonIn: Range; readonly moonOut: Range };
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
  /** the level's sun intensity this row's `sunI` is relative to */
  readonly sunIBase: number;
}

/** A preset's fields by kind (`dayLookPresets`: the row → its live preset, copied and blended by the clock). */
export const FACETED_DAY_PRESET = {
  sky: { zenith: 'colour', horizon: 'colour', below: 'colour', sunGlow: 'colour', cloudLit: 'colour', cloudShade: 'colour', night: 'number' },
  sunColor: 'colour', sunI: 'number', hemiSky: 'colour', hemiGround: 'colour', hemiI: 'number',
  lift: 'colour', rim: 'colour', fogNear: 'colour', fogSun: 'colour', disc: 'colour', cloudShadow: 'number', dusk: 'number',
} as const satisfies DayLookSchema & Record<keyof FacetedDayPresetRow, unknown>;
