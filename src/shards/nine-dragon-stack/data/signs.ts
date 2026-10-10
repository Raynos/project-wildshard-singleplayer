// Nine Dragon's signs as rows on the SDK sign system (@wildshard/sdk/looks/signs): hand-bent neon calligraphy and
// lightboxes in the mono atlas, gold-lettered plaques, paper strips, banners, the talisman and the blade's etch in the
// colour atlas; the SDF neon's look; the atlases' sizes per tier. Real words (麵 牙科 火鍋 茶 藥房 旅館 …) in a Kai /
// Song regular script.
import type { NeonTextLook } from '@wildshard/sdk/looks/neonText';
import type { SignAtlasLayout, SignSegment, SignStep, SignStyleRow } from '@wildshard/sdk/looks/signs';

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
