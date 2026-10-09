/**
 * Nine Dragon Stack's far proxy look (SHARD-PLATFORM SF23 / SF19b, G95), read only by the far baker
 * (scripts/bake/far-proxies.mjs). Nine Dragon is a structure-first shard: it has no landscape and no `terrain.bin`, so its
 * proxy is baked from the skyline below (`farGrid`) instead: a walled city of towers rising toward the centre, four
 * street canyons out to the edge midpoints (where SF51's entries go), a low forecourt along the border at road level,
 * Lantern Square and the Yamen Well's dark shaft at the heart. Its colour is ink facades with a sparse scatter of warm lit
 * windows (a neon sign at the proxy's 10 m vertex spacing smeared a whole facet jade, so the signs stay in the shard). Its
 * one-frame mood is G95 "C: dusk + border fog": a dusk grade and a pale silk-fog band rising at its border, one sky.
 */
type Rgb = readonly [number, number, number];

/** The cell's half size (m) and the forecourt left at road level inside its border. */
const HALF = 250, FORECOURT = 14, STREET = 7, BLOCK = 125 / 6;
/** the Yamen Well's shaft and Lantern Square, in the shard's own plan (layout.ts: WELL, PLAZA) */
const WELL = { x0: -28, x1: 0, z0: -44, z1: 16 } as const, PLAZA = { x0: 0, x1: 22, z0: -26, z1: 20 } as const;

const fract = (v: number): number => v - Math.floor(v);
const hash = (i: number, j: number): number => fract(Math.sin(i * 127.1 + j * 311.7) * 43758.5453);
const inside = (x: number, z: number, r: { x0: number; x1: number; z0: number; z1: number }): boolean => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;

/** The skyline height (m above the road datum) at a cell-local point. */
export function skylineAt(x: number, z: number): number {
  if (inside(x, z, WELL)) return -12;
  const edge = HALF - Math.max(Math.abs(x), Math.abs(z));
  if (edge < FORECOURT) return 0.5;
  if (Math.abs(x) < STREET || Math.abs(z) < STREET) return 3;
  if (inside(x, z, PLAZA)) return 6;
  const bi = Math.floor((x + HALF) / BLOCK), bj = Math.floor((z + HALF) / BLOCK), centre = 1 - Math.max(Math.abs(x), Math.abs(z)) / HALF;
  // the outer blocks step down toward the forecourt, so the city climbs away from the road instead of walling it
  const rise = 0.4 + 0.6 * Math.min(1, (edge - FORECOURT) / 70);
  return (22 + 34 * centre + 52 * hash(bi, bj) ** 1.5) * rise; // a ragged skyline of towers more than one pyramid
}

/** The baked grid the far baker reads in place of `terrain.bin` (res² heights over the cell, no splat). */
export function farGrid(): { res: number; size: number; heights: Float32Array; splat: null } {
  const res = 251, size = HALF * 2, heights = new Float32Array(res * res);
  for (let j = 0; j < res; j++) for (let i = 0; i < res; i++) heights[j * res + i] = skylineAt(-HALF + (i * size) / (res - 1), -HALF + (j * size) / (res - 1));
  return { res, size, heights, splat: null };
}

const INK: Rgb = [0.018, 0.018, 0.027], ROOF: Rgb = [0.03, 0.029, 0.038], GRANITE: Rgb = [0.045, 0.043, 0.05], WINDOW: Rgb = [0.3, 0.17, 0.06];

// toon (faceted Lambert): a rough PBR proxy's grazing-angle sheen washed the tower faces out to pale cliffs
export const farLook = {
  family: 'toon',
  colourAt: (x: number, z: number, h: number, slope: number): [number, number, number] => {
    if (h < 0) return [0.02, 0.02, 0.03];
    const lit = hash(Math.floor(x * 0.37), Math.floor(z * 0.41)), glow = Math.max(0, (lit - 0.8) / 0.2); // a sparse scatter of lit windows: in the grid's daylight a dense one read as tan rock
    if (h < 8) return [GRANITE[0] + 0.5 * WINDOW[0] * glow * glow, GRANITE[1] + 0.5 * WINDOW[1] * glow * glow, GRANITE[2] + 0.5 * WINDOW[2] * glow * glow];
    const base = slope < 0.08 ? ROOF : INK;
    return [base[0] + WINDOW[0] * glow, base[1] + WINDOW[1] * glow, base[2] + WINDOW[2] * glow];
  },
  // G222: its exposed boundary is the stack's granite footing going to ink, never a pale wall
  cliff: { lip: GRANITE, foot: INK },
  haze: { colour: [0.6, 0.56, 0.64], near: 300, far: 2200, max: 0.65 },
  // SF19b / G95 (Jake: "C Dusk + border fog"): under the grid's one sky the stack keeps its dusk through a dusky violet
  // grade on its own pixels and a pale silk fog rising from the strip at its border; no second sky
  grade: { exposure: -0.3, saturation: 1.05, contrast: 1.1, tint: [1.02, 0.88, 1.1] },
  band: { colour: [0.72, 0.68, 0.78], height: 38, opacity: 0.8, own: 0.8 },
} as const;
