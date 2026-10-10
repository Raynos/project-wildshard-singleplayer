// Nine Dragon authoring row shapes; these declarations have no runtime dependency.
/** Nine Dragon’s authored SignLen row shape. */
export interface SignLen { readonly px?: number; readonly w?: number; readonly h?: number; readonly u?: number }
/** Nine Dragon’s authored SignPaint row shape. */
export type SignPaint = string | { readonly spec: 'color' } | { readonly spec: 'ink'; readonly fallback: string };
/** Nine Dragon’s authored SignSegment row shape. */
export type SignSegment =
  | { readonly m: readonly [SignLen, SignLen] }
  | { readonly l: readonly [SignLen, SignLen] }
  | { readonly q: readonly [SignLen, SignLen, SignLen, SignLen] }
  | { readonly c: readonly [SignLen, SignLen, SignLen, SignLen, SignLen, SignLen] }
  /** an arc: centre x, y, radius, start and end angle (radians) */
  | { readonly a: readonly [SignLen, SignLen, SignLen, number, number] };
/** Nine Dragon’s authored SignStep row shape. */
export type SignStep =
  /** fill the cell (inset on every side) */
  | { readonly op: 'fill'; readonly paint: SignPaint; readonly inset?: SignLen }
  /** the text, one glyph per cell slot: filled, or stroked when `stroke` (line width, × unit) is set */
  | { readonly op: 'glyphs'; readonly paint: SignPaint; readonly weight: number; readonly size: number; readonly font: string; readonly stroke?: number }
  /** a rectangle frame inset on every side (× unit); `radius` makes it a rounded-rect path, else a stroked rect */
  | { readonly op: 'frame'; readonly paint: SignPaint; readonly inset: number; readonly width: number; readonly radius?: number }
  /** the canvas shadow for the steps after it (`blur` × unit; 0 turns it off) */
  | { readonly op: 'shadow'; readonly color: string; readonly blur: number }
  /** one stroked path */
  | { readonly op: 'path'; readonly paint: SignPaint; readonly width: SignLen; readonly path: readonly SignSegment[] };
/** Nine Dragon’s authored SignFace row shape. */
export type SignFace = { readonly kind: 'glyphs' } | { readonly kind: 'fixed'; readonly w: number; readonly h: number; readonly px: readonly [number, number] };
/** Nine Dragon’s authored SignStyleRow row shape. */
export interface SignStyleRow {
  /** the mono atlas (tinted per vertex, glows) or the colour atlas */
  readonly mono: boolean;
  /** routed to the attached neon calligraphy (`SignBuilder.calligraphy`) when one is set */
  readonly calligraphy?: boolean;
  /** the face's up axis: 'y' (a wall sign) or 'x' (lettering laid along a blade) */
  readonly up?: 'x' | 'y';
  readonly face?: SignFace;
  /** default glow gain and board colour */
  readonly gain: number;
  readonly board: number;
  readonly steps: readonly SignStep[];
}
/** Nine Dragon’s authored SignAtlasLayout row shape. */
export interface SignAtlasLayout {
  readonly mw: number; readonly mh: number; readonly cw: number; readonly ch: number; readonly unit: number; readonly pad: number;
  readonly colourUnit: number;
  /** a fixed face's colour cell is its reference px × this (its steps are drawn in reference px) */
  readonly colourScale: number;
}
