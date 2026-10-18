// Nine Dragon's painted surfaces as data (SHARD-PLATFORM M3, look-family rows): the texture array's layers, the
// explicit surfaces, the flagstone layout, the paint's uniforms as rows and its GLSL, spliced into the world programs by
// look/style.ts (`@{paint}`) for the SDK shader family (@wildshard/game/systems/looks/shaderFamily). look/paint.ts loads the
// array; the lab's notes are there.
import type { UniformRows } from '@wildshard/game/plugin/shaderFamily';

/** the array layers, in order; `scale` = the ratio's storage scale (texprep.py spec.json `scale`) */
export const LAYERS = [
  { name: 'flag', scale: 2.5, alpha: true },
  { name: 'flag2', scale: 2.5, alpha: true },
  { name: 'stone', scale: 2, alpha: false },
  { name: 'panel', scale: 2, alpha: false },
  { name: 'concrete', scale: 2, alpha: false },
  { name: 'tiles', scale: 3, alpha: false },
  { name: 'lacquer', scale: 2, alpha: false },
  { name: 'wood', scale: 2.5, alpha: false },
  { name: 'poster', scale: 1, alpha: true },
] as const;

/** Look.surf: an explicit surface (flag bits × 4096); 0 = by kind */
export const SURF = { auto: 0, none: 1, stone: 2, concrete: 3, lacquer: 4, wood: 5, poster: 6 } as const;

/**
 * The flagstone layout, shared by the ground's joints (style.ts STONES_GLSL `stone()`), the streak cards and the paint's
 * per-stone windows: courses `rh` deep, stones `l0 … l0 + lr` long in a running bond. Dome B's ask (round 10): the
 * square's slabs 0.6–0.9 m (they were 0.82 × 1.05–1.6 m).
 */
export const FLAG = { rh: 0.62, l0: 0.64, lr: 0.28, bond: 1.1 } as const;
const f = (x: number): string => x.toFixed(3);
/** GLSL: the stone a point lies in — xy = its id (column, course), zw = its local metres */
export const FLAG_GLSL = /* glsl */ `
vec4 flagCell(vec2 p) {
  float r = floor(p.y / ${f(FLAG.rh)});
  float off = h11(r * 3.7) * ${f(FLAG.bond)};
  float L = ${f(FLAG.l0)} + ${f(FLAG.lr)} * h11(r * 9.1 + 2.0);
  float cx = floor((p.x + off) / L);
  return vec4(cx, r, p.x + off - cx * L, p.y - r * ${f(FLAG.rh)});
}
float flagLen(float r) { return ${f(FLAG.l0)} + ${f(FLAG.lr)} * h11(r * 9.1 + 2.0); }
`;

/** the paint uniforms as rows (look/paint.ts adds the array itself, uPaint) */
export const PAINT_UNIFORMS = {
  /** x: master (0 = the round-8 flat washes), y: flagstones, z: walls (stone / concrete / panel), w: wood, lacquer, tiles */
  uPaintK: { v4: [1, 1, 1, 1] },
  /** x: 2nd-scale detail on walls, y: grime ink tint, z: posters, w: puddle depth from the flag cavity */
  uPaintK2: { v4: [0.5, 0.5, 1, 1] },
  /** the hue the paint's darks lean to: a slate blue-grey (the codex edits paint wet stone's darks blue, not brown) */
  uPaintInk: { rgb: 0x2c3a52 },
} as const satisfies UniformRows;

