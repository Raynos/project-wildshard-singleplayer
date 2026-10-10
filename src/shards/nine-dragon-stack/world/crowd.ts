// Dome B (E169): the crowd's colourways. The walker and the sitter are models (models/crowd.ts: the TRELLIS casts, their
// colourways and levels); this file deals the figures out to the colourways (`dealCrowd`); the SDK's figure crowd
// (@wildshard/sdk/cull/figureCrowd) culls them per figure with the levels in data/lod.ts.
import type { BufferGeometry, Matrix4 } from 'three';

/**
 * E281, umbrella variety: the targets' crowd is a mix of black, dark blue, oxblood and paper umbrellas, about a
 * quarter each; the variants handed in are mostly the dark-coat walker's black one. When the crowd is built, the
 * dark-umbrella walker's figures are dealt out by a hash of where they stand (so the deal is stable): a quarter keep
 * black, a quarter go to a copy whose umbrella is `BLUE_UMBRELLA` (one more geometry and two meshes, once per crowd),
 * and the rest join the variants already added with an oxblood umbrella and with a paper one (no geometry at all).
 */
export const BLUE_UMBRELLA = 0x34507e;
const SHARE = { blue: 0.25, oxblood: 0.5, paper: 0.72 } as const;

interface Tone { lum: number; chroma: number; r: number; g: number; b: number }
/** the umbrella's mean linear colour, luminance and chroma (vertices above `above` m), or null without an umbrella */
function umbrellaTone(g: BufferGeometry, above = 1.8): Tone | null {
  const pos = g.getAttribute('position'), col = g.getAttribute('color');
  let n = 0, lum = 0, chroma = 0, sr = 0, sg = 0, sb = 0;
  for (let i = 0; i < col.count; i++) {
    if (pos.getY(i) <= above) continue;
    const r = col.getX(i), gg = col.getY(i), b = col.getZ(i);
    lum += 0.2126 * r + 0.7152 * gg + 0.0722 * b;
    chroma += Math.max(r, gg, b) - Math.min(r, gg, b);
    sr += r; sg += gg; sb += b;
    n++;
  }
  return n === 0 ? null : { lum: lum / n, chroma: chroma / n, r: sr / n, g: sg / n, b: sb / n };
}
const isBlack = (t: Tone | null): boolean => t !== null && t.lum < 0.06 && t.chroma < 0.03;
const isOxblood = (t: Tone | null): boolean => t !== null && t.chroma > 0.05 && t.g < t.r * 0.2 && t.b < t.r * 0.2;
const isPaper = (t: Tone | null): boolean => t !== null && t.chroma > 0.05 && t.g > t.r * 0.25 && t.g < t.r * 0.75 && t.b < t.r * 0.3;

/** a stable 0..1 hash of a figure's standing point */
const spot = (m: Matrix4): number => {
  const e = m.elements;
  const h = Math.sin(e[12] * 12.9898 + e[14] * 78.233) * 43758.5453;
  return h - Math.floor(h);
};

/** a figure's colourway (models/crowd.ts): the coat's ramp, and the umbrella's dye when it is not the ramp's own */
export type WalkerPick = 'dark' | 'light' | 'oxblood' | 'paper' | 'blue';
export type SitterPick = 'dark' | 'light';

/**
 * The crowd's colourways (E281), as the old `Crowd.add` / `build` dealt them — now the placement of the walker and sitter
 * models (world/build.ts): the walkers by their index (seven in ten dark coats, one red and one ochre oil-paper umbrella
 * in ten), the sitters two dark coats to one light; then the black-umbrella figures dealt by a hash of where they stand
 * (see BLUE_UMBRELLA): a quarter keep black, a quarter go blue, the rest join the oxblood and the paper ones. The tones
 * come from the colourways' own geometry (`geo`), as before. Each colourway's figures in the order the old deal left them,
 * the colourways in the order it built them (blue after the rest).
 */
export function dealCrowd(walkers: readonly Matrix4[], sitters: readonly Matrix4[], geo: { walker: (p: WalkerPick) => BufferGeometry; sitter: (p: SitterPick) => BufferGeometry }): { walkers: [WalkerPick, Matrix4[]][]; sitters: [SitterPick, Matrix4[]][] } {
  type Part = { walker: true; pick: WalkerPick; mats: Matrix4[] } | { walker: false; pick: SitterPick; mats: Matrix4[] };
  const all: Part[] = [
    { walker: true, pick: 'dark', mats: walkers.filter((_, i) => i % 10 < 7 && i % 10 !== 2) },
    { walker: true, pick: 'light', mats: walkers.filter((_, i) => i % 10 >= 7 && i % 10 !== 8) },
    { walker: true, pick: 'oxblood', mats: walkers.filter((_, i) => i % 10 === 2) },
    { walker: true, pick: 'paper', mats: walkers.filter((_, i) => i % 10 === 8) },
    { walker: false, pick: 'dark', mats: sitters.filter((_, i) => i % 3 !== 1) },
    { walker: false, pick: 'light', mats: sitters.filter((_, i) => i % 3 === 1) },
  ];
  // (an empty colourway was never added, so the tones only look at the ones with figures)
  const parts = all.filter((p) => p.mats.length > 0);
  const tones = parts.map((p) => umbrellaTone(p.walker ? geo.walker(p.pick) : geo.sitter(p.pick)));
  const black = parts[tones.findIndex(isBlack)];
  const oxblood = parts[tones.findIndex(isOxblood)], paper = parts[tones.findIndex(isPaper)];
  const blue: Matrix4[] = [];
  // (the blue copy is the black walker's umbrella dyed: the walker model's 'blue' colourway is the dark walker's)
  const dealt = black !== undefined && black.walker && black.pick === 'dark';
  if (dealt) {
    const keep: Matrix4[] = [];
    for (const m of black.mats) {
      const h = spot(m);
      if (h < SHARE.blue) blue.push(m);
      else if (h < SHARE.oxblood && oxblood !== undefined) oxblood.mats.push(m);
      else if (h < SHARE.paper && paper !== undefined) paper.mats.push(m);
      else keep.push(m);
    }
    black.mats = keep;
  }
  const out: { walkers: [WalkerPick, Matrix4[]][]; sitters: [SitterPick, Matrix4[]][] } = { walkers: [], sitters: [] };
  for (const p of parts) {
    if (p.mats.length === 0) continue;
    if (p.walker) out.walkers.push([p.pick, p.mats]); else out.sitters.push([p.pick, p.mats]);
  }
  if (dealt && blue.length > 0) out.walkers.push(['blue', blue]);
  return out;
}
