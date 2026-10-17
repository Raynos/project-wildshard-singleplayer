import type { DayClockRow, DayClockSegment } from './dayCycle';

type Range = readonly [number, number];
/** A preset's fields: each a colour, a number, a name, or a nested group. */
export interface DayLookSchema { readonly [field: string]: 'colour' | 'number' | 'name' | DayLookSchema }
/** A colour as data: an sRGB hex number, or linear RGB. */
export type DayLookColour = number | readonly [number, number, number];
/** A preset as data. */
export type DayLookRow<S extends DayLookSchema> = {
  readonly [K in keyof S]: S[K] extends 'colour' ? DayLookColour : S[K] extends 'number' ? number : S[K] extends 'name' ? string : S[K] extends DayLookSchema ? DayLookRow<S[K]> : never;
};

type NumberField<S extends DayLookSchema> = { [K in keyof S]: S[K] extends 'number' ? K : never }[keyof S] & string;
/** Numeric preset fields that supply optional day curves. */
export interface DayClockReads<S extends DayLookSchema> {
  readonly dusk?: NumberField<S>;
  readonly lamps?: NumberField<S>;
}

/** A keyed day clock's row: the shard's own row type extends this. */
export interface DayClockStyle<S extends DayLookSchema> {
  /** the day's share of the cycle (sunset's phase) */
  readonly dayFraction: number;
  /** the start phase when nothing pins one */
  readonly start: number;
  readonly schedule: readonly DayClockSegment[];
  /** Settings ▸ Time of day's picks → the phase they park the clock at */
  readonly fixed: DayClockRow['fixed'];
  /** the engine's named light presets → phase */
  readonly namedPhases: DayClockRow['presets'];
  /** `?tod=` names → phase (a number always works) */
  readonly phases?: Readonly<Record<string, number>>;
  readonly presets: Readonly<Record<string, DayLookRow<S>>>;
  /** keyframes over the phase (sorted; wraps 1 → 0): a phase and the preset it holds */
  readonly frames: readonly (readonly [number, string])[];
  readonly sun: { readonly rise: number; readonly sweep: number; readonly noon: number; readonly nightRise: number; readonly nightSweep: number; readonly nadir: number };
  readonly moon: { readonly rise: number; readonly sweep: number; readonly base: number; readonly arc: number };
  readonly night: { readonly eve?: { readonly span: Range; readonly height: number }; readonly rise: Range; readonly fall: Range };
  readonly fade: { readonly sunY: Range; readonly moonIn: Range; readonly moonOut: Range };
  /** the dusk curve from the sun's height (1 → 0 over these heights, never under the night); otherwise the selected dusk field */
  readonly dusk?: Range;
  /** the dawn curve: its phase and the distance window it fades over (none: 0) */
  readonly dawn?: { readonly at: number; readonly width: Range };
}

