/**
 * A rigged-hull family's row types (SHARD-PLATFORM M3, `riggedHulls`): which generated hull each creature variant wears,
 * each hull's coat recipe, the generator flaps pressed off a hull and the fur a measured coat wears. Pure data and
 * import-free at run time, so a shard's `data/` row names no function.
 */

/** sRGB 0..1. */
export type HullRgb = readonly [number, number, number];

/** The species palettes a hull's coat recolours from (the game's own creature palettes, by species). */
export type HullPalette = 'deer' | 'elk' | 'boar' | 'bear';

/** One hull's coat recipe: the palette, the variant the hull was generated as and the palette's [dark, body, light] keys. */
export interface HullCoatRow {
  /** the species default palette (the variant's `tint` overrides keys of it) */
  readonly palette: HullPalette;
  /** the variant the hull was generated as: [kind, variant id] (its tint, over `palette`, is the atlas's coat) */
  readonly source: readonly [string, string];
  /** the palette keys: [dark, body, light] */
  readonly keys: readonly [string, string, string];
  /**
   * Per variant id, the coat keys' target tones (sRGB): the SOURCE tones are then measured off the atlas itself, so the
   * hull's own tones land exactly on the targets. A `grizzle` entry (the tips' colour) paints silver guard-hair tips over
   * the hump, the shoulders and the back, the legs darker.
   */
  readonly measured?: Readonly<Record<string, Readonly<Record<string, HullRgb>>>>;
}

/**
 * One hull's generator flap: the rump's back plane z(y) = z0 + (y - y0) · slope; every vertex above `yMin` behind it is
 * pressed onto it, keeping `keep` of its depth; `bulge` (m) rounds the pressed patch out into a dome (0 at its rim).
 */
export interface HullFlapRow {
  readonly yMin: number; readonly y0: number; readonly z0: number; readonly slope: number; readonly keep: number; readonly bulge: number;
}

/** A fur sheen and backlit rim (FurStyle) a coat wears over its variant's own. */
export interface HullFurRow { readonly rim: HullRgb; readonly sheenColor: HullRgb }

/** A shard's rigged-hull family. */
export interface RiggedHullsRow {
  /** the log prefix (`[<label>] creature rig …`) */
  readonly label: string;
  /** every hull the family preloads, in order */
  readonly rigs: readonly string[];
  /** `kind:variant` → its hull; a variant missing here stays procedural */
  readonly hulls: Readonly<Record<string, string>>;
  /** per hull, its coat recipe */
  readonly coats: Readonly<Record<string, HullCoatRow>>;
  /** per hull, the generator flap pressed onto its body (its texels take the rump's colour) */
  readonly flaps?: Readonly<Record<string, HullFlapRow>>;
  /** per hull, per variant id, the fur's sheen and rim */
  readonly fur?: Readonly<Record<string, Readonly<Record<string, HullFurRow>>>>;
}
