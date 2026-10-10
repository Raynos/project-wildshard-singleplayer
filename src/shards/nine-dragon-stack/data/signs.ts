// Nine Dragon authoring row shapes; these declarations have no runtime dependency.
/** Nine Dragon’s authored SignModelParams row shape. */
export interface SignModelParams<S extends string = string> {
  readonly style: S;
  readonly text: string;
  /** mono styles: the neon / lightbox tint; colour styles: the characters' colour */
  readonly color: string;
  readonly vertical: boolean;
  /** colour styles: the ground (paper, lacquer) */
  readonly ink?: string;
  /** character height, metres */
  readonly size: number;
  /** both faces (a blade sign hanging out from a wall) */
  readonly blade: boolean;
  readonly board?: number;
  readonly gain?: number;
}
/** Nine Dragon’s authored SignVariantRow row shape. */
export interface SignVariantRow<S extends string = string> {
  readonly id: string;
  readonly label: string;
  readonly params: Partial<SignModelParams<S>>;
}
/** Nine Dragon’s authored SignModelRow row shape. */
export interface SignModelRow {
  readonly key: string;
  /** the styles drawn as SDF calligraphy when the look has it */
  readonly calligraphyStyles: readonly string[];
  /** a calligraphy copy's gain is gain / calligraphyGain × tubeGain (its default gain draws the tubes at tubeGain) */
  readonly calligraphyGain: number;
  readonly tubeGain: number;
  /** styles whose words run along y (the blade's etch): their face's up is +x */
  readonly sideways: readonly string[];
  readonly neonDepth: number;
  readonly bladeDepth: number;
  readonly depth: number;
  /** how far an atlas sign's board stands off its face */
  readonly standoff: number;
  /** the variant a style is shown as (a style with no entry: the variant of its own name) */
  readonly variantOf: Readonly<Record<string, string>>;
  readonly pieces: { readonly atlas: string; readonly neon: string };
}
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
// Nine Dragon authoring row shapes; these declarations have no runtime dependency.
/** Nine Dragon’s authored NeonTextLook row shape. */
export interface NeonTextLook {
  /** 0 brush fill ... 1 monoline tube */
  readonly mono: number;
  /** tube radius, rim width, fill thicken, seam darkness and width, halo reach (all em) and halo gain */
  readonly tubeRadius: number; readonly rim: number; readonly thicken: number; readonly seam: number; readonly seamWidth: number;
  readonly haloReach: number; readonly haloGain: number;
  /** the board's frame tube: inset, tube radius, corner radius (m); the board's lift by its own light */
  readonly frameInset: number; readonly frameRadius: number; readonly frameCorner: number; readonly boardLift: number;
  /** the board's colour (sRGB hex) */
  readonly board: number;
  /** the full glow gain */
  readonly gain: number;
}
// Nine Dragon's signs as rows on the SDK sign system (@wildshard/sdk/looks/signs): hand-bent neon calligraphy and
// lightboxes in the mono atlas, gold-lettered plaques, paper strips, banners, the talisman and the blade's etch in the
// colour atlas; the SDF neon's look; the atlases' sizes per tier. Real words (麵 牙科 火鍋 茶 藥房 旅館 …) in a Kai /
// Song regular script.

export const KAI = '"LXGW WenKai TC", "Kaiti TC", "STKaiti", "BiauKai", "Songti TC", serif';
export const SONG = '"Noto Serif TC", "Songti TC", "STSong", "PMingLiU", serif';
/** the neon calligraphy's glyph font (a brush regular script) */
export const KAI_STACK = '"LXGW WenKai TC", "Kaiti TC", "STKaiti", "BiauKai", "Songti TC", "PingFang TC", serif';

export type SignStyle = 'tube' | 'box' | 'plaque' | 'paper' | 'talisman' | 'etch' | 'banner';
export const SIGN_STYLE_IDS: readonly SignStyle[] = ['tube', 'box', 'plaque', 'paper', 'talisman', 'etch', 'banner'];

const COLOR = { spec: 'color' } as const;

/** the talisman's five brush waves across the strip */
const waves: SignSegment[] = [0, 1, 2, 3, 4].flatMap((i): SignSegment[] => {
  const yy = 0.08 + i * 0.2;
  return [{ m: [{ w: 0.12 }, { h: yy }] }, { c: [{ w: 0.4 }, { h: yy, u: -0.2 }, { w: 0.6 }, { h: yy, u: 0.2 }, { w: 0.88 }, { h: yy }] }];
});

/** the blade's etch (1000 × 80 reference px): a circuit line and seven cloud scrolls (祥云), silver on nothing */
const etch: SignStep[] = [
  { op: 'path', paint: COLOR, width: { px: 3 }, path: [
    { m: [{ px: 20 }, { h: 0.5 }] }, { l: [{ w: 1, px: -20 }, { h: 0.5 }] },
    { m: [{ px: 40 }, { h: 0.28 }] }, { l: [{ w: 0.45 }, { h: 0.28 }] }, { l: [{ w: 0.5 }, { h: 0.4 }] },
  ] },
  ...[0, 1, 2, 3, 4, 5, 6].flatMap((i): SignStep[] => {
    const ccx = 90 + i * 128, ccy = i % 2 === 0 ? 0.64 : 0.38;
    const curls = [0, 1, 2].map((k): SignStep => ({ op: 'path', paint: COLOR, width: { px: 2.5 },
      path: [{ a: [{ px: ccx + k * 20 }, { h: ccy }, { px: 13 - k * 3 }, Math.PI * (0.2 + k * 0.1), Math.PI * (1.9 - k * 0.1)] }] }));
    curls.push({ op: 'path', paint: COLOR, width: { px: 2.5 },
      path: [{ m: [{ px: ccx - 28 }, { h: ccy, px: 14 }] }, { q: [{ px: ccx + 18 }, { h: ccy, px: 24 }, { px: ccx + 64 }, { h: ccy, px: 10 }] }] });
    return curls;
  }),
];

export const SIGN_STYLES: Readonly<Record<SignStyle, SignStyleRow>> = {
  // a neon tube: the halo soaks out of the tube, the tube itself is near white; the tint comes from the vertex. With
  // the SDF calligraphy set, drawn by it instead
  tube: { mono: true, calligraphy: true, gain: 4.4, board: 0x17191e, steps: [
    { op: 'shadow', color: '#ffffff', blur: 0.07 },
    { op: 'glyphs', paint: '#9a9a9a', weight: 900, size: 0.84, font: KAI },
    { op: 'frame', paint: '#d0d0d0', inset: 0.1, width: 0.035, radius: 0.08 },
    { op: 'shadow', color: '#ffffff', blur: 0 },
    { op: 'glyphs', paint: '#ffffff', weight: 900, size: 0.84, font: KAI },
    { op: 'glyphs', paint: '#ffffff', weight: 900, size: 0.84, font: KAI, stroke: 0.035 },
    { op: 'frame', paint: '#ffffff', inset: 0.1, width: 0.014, radius: 0.08 },
  ] },
  // a lightbox: the tinted panel glows, the characters are the dark board showing through
  box: { mono: true, gain: 2.2, board: 0x1d1f25, steps: [
    { op: 'fill', paint: '#e6e6e6', inset: { u: 0.06 } },
    { op: 'glyphs', paint: '#000000', weight: 900, size: 0.8, font: SONG },
    { op: 'frame', paint: '#000000', inset: 0.15, width: 0.03, radius: 0 },
  ] },
  plaque: { mono: false, gain: 1.5, board: 0x1d1f25, steps: [
    { op: 'fill', paint: { spec: 'ink', fallback: '#15110e' } },
    { op: 'glyphs', paint: COLOR, weight: 900, size: 0.78, font: SONG },
    { op: 'frame', paint: COLOR, inset: 0.08, width: 0.05 },
    { op: 'frame', paint: COLOR, inset: 0.16, width: 0.015 },
  ] },
  paper: { mono: false, gain: 1.0, board: 0x1d1f25, steps: [
    { op: 'fill', paint: { spec: 'ink', fallback: '#b8321f' } },
    { op: 'glyphs', paint: COLOR, weight: 700, size: 0.78, font: KAI },
  ] },
  banner: { mono: false, gain: 1.0, board: 0x1d1f25, steps: [
    { op: 'fill', paint: { spec: 'ink', fallback: '#b8321f' } },
    { op: 'glyphs', paint: COLOR, weight: 700, size: 0.78, font: KAI },
    { op: 'frame', paint: COLOR, inset: 0.08, width: 0.02 },
  ] },
  talisman: { mono: false, gain: 1.0, board: 0x1d1f25, steps: [
    { op: 'fill', paint: '#e9c65a' },
    { op: 'glyphs', paint: '#b3261a', weight: 700, size: 0.7, font: KAI },
    { op: 'path', paint: '#b3261a', width: { u: 0.03 }, path: waves },
    { op: 'frame', paint: '#b3261a', inset: 0.06, width: 0.03 },
  ] },
  etch: { mono: false, up: 'x', face: { kind: 'fixed', w: 12.5, h: 1, px: [1000, 80] }, gain: 1.0, board: 0x1d1f25, steps: etch },
};

/** the colour atlas's glyph unit and a fixed face's scale per tier (the mono sizes are tier.ts `signLayout`) */
export const SIGN_COLOUR: Readonly<Record<'phone' | 'desktop', Pick<SignAtlasLayout, 'colourUnit' | 'colourScale'>>> = {
  phone: { colourUnit: 36, colourScale: 0.5 },
  desktop: { colourUnit: 72, colourScale: 1 },
};

/** the SDF neon calligraphy's look */
export const NEON_LOOK: NeonTextLook = {
  mono: 0, tubeRadius: 0.05, rim: 0.024, thicken: 0.022, seam: 0.0, seamWidth: 0.008, haloReach: 0.12, haloGain: 0.22,
  frameInset: 0.075, frameRadius: 0.016, frameCorner: 0.04, boardLift: 0.035, board: 0x34333a, gain: 4.2,
};

/** the sign model (models/signs.ts, @wildshard/sdk/looks/signModel): the calligraphy styles and their gain scale (a tube's
 *  default 4.4 draws the SDF tubes at 4.2), the etch runs sideways, the boards' depths (neon 9 cm, a blade 12 cm, else
 *  10 cm, standing 3 cm off the face), the variant each style is shown as, the two drawn pieces */
export const SIGN_MODEL = {
  key: 'nds:sign', calligraphyStyles: ['tube'], calligraphyGain: 4.4, tubeGain: 4.2, sideways: ['etch'],
  neonDepth: 0.09, bladeDepth: 0.12, depth: 0.1, standoff: 0.03,
  variantOf: { tube: 'neon', box: 'lightbox' }, pieces: { atlas: 'nds-signs', neon: 'nds-signs-neon' },
} as const satisfies SignModelRow;

/** the sign model's defaults: a red neon calligraphy sign */
export const SIGN_DEFAULTS = { style: 'tube', text: '重慶小麵', color: '#ff3b30', vertical: false, size: 0.5, blade: false, gain: 5 } as const satisfies SignModelParams<SignStyle>;

/** a variant per style, each with words the fragment hangs (their atlas cells are drawn) */
export const SIGN_VARIANTS = [
  { id: 'neon', label: 'Neon calligraphy (重慶小麵)', params: { style: 'tube', text: '重慶小麵', color: '#ff3b30', vertical: false, size: 0.5, gain: 5 } },
  { id: 'lightbox', label: 'Lightbox (九記牛腩麵)', params: { style: 'box', text: '九記牛腩麵', color: '#fff1dc', vertical: false, size: 0.34, board: 0xa8261a, gain: 2.0 } },
  { id: 'plaque', label: 'Plaque (福德祠)', params: { style: 'plaque', text: '福德祠', color: '#f0c86a', vertical: false, size: 0.13, gain: 1.3 } },
  { id: 'paper', label: 'Paper strip (牛腩麵)', params: { style: 'paper', text: '牛腩麵', color: '#f3e7cf', ink: '#b8261a', vertical: true, size: 0.13, gain: 1.15 } },
  { id: 'banner', label: 'Banner (麵)', params: { style: 'banner', text: '麵', color: '#b8261a', ink: '#efe8d8', vertical: true, size: 0.72, blade: true, gain: 1.35 } },
] as const satisfies readonly SignVariantRow<SignStyle>[];
