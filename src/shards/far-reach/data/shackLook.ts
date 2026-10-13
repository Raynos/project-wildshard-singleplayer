/**
 * The weathered-timber surfaces of Sky Reach's small buildings (E392, round 18; SHARD-PLATFORM G382: one SF59 material
 * graph per kind, the shardfile's `look.materials.shack-<kind>`): each draws a baked shack part from the metre coordinates
 * on its faces (the `aShk` attribute: u along, v up, a seed) over its vertex colour. The geometry is built at bake time
 * (`generators/shackKit.ts`, SHARD-PLATFORM SF72); the client only draws it.
 * - `plank`: vertical boards (~24 cm), each its own tone and length, dark seams and butt joints, grain, rain streaks;
 * - `shingle`: staggered rows of wooden shingles with ragged butts, a shadow under each row, moss toward the eave;
 * - `stone`: coursed rubble blocks with mortar, bevelled edges, mixed warm and cool stones, moss at the foot;
 * - `beam`: trim and posts, the grain running along the piece's longest side, the odd check.
 */

import { SKY_PAINTER_GRAPH } from './skyLook';

/** The graph rows a pattern is written in: a node's op, inputs (node ids or literals) and its own fields. */
type GraphInput = string | number | readonly number[];
interface GraphNodeRow { readonly op: string; readonly in?: readonly GraphInput[]; readonly mask?: string; readonly name?: string; readonly type?: string }

/**
 * One shack kind's graph: `pattern` writes its colour from the face coordinates (`q` the metres along / up, `sd` the
 * part's seed, `y` the height above the part's foot, `c` the vertex colour) with the shared hash and value noise; the
 * kind's standard material keeps its roughness, lit by the painted light (data/skyLook.ts). Local helpers only: the module exports the finished rows.
 */
function shackGraph(roughness: number, pattern: (k: Kit) => string): { readonly version: 1; readonly kind: 'material'; readonly model: 'standard'; readonly nodes: Readonly<Record<string, GraphNodeRow>>; readonly stages: { readonly surface: { readonly colour: string; readonly roughness: number; readonly metalness: number }; readonly lighting: typeof SKY_PAINTER_GRAPH.lighting } } {
  const nodes: Record<string, GraphNodeRow> = {};
  let next = 0;
  const op = (name: string, inputs?: readonly GraphInput[], extra?: Omit<GraphNodeRow, 'op' | 'in'>): string => {
    const id = `n${String(next++)}`;
    nodes[id] = { op: name, ...(inputs === undefined ? {} : { in: inputs }), ...extra };
    return id;
  };
  const kit = makeKit(op);
  const colour = pattern(kit);
  return { version: 1, kind: 'material', model: 'standard', nodes: { ...SKY_PAINTER_GRAPH.nodes, ...nodes }, stages: { surface: { colour, roughness, metalness: 0 }, lighting: SKY_PAINTER_GRAPH.lighting } };
}

interface Kit {
  readonly q: string; readonly qx: string; readonly qy: string; readonly sd: string; readonly y: string; readonly c: string;
  readonly add: (a: GraphInput, b: GraphInput) => string; readonly sub: (a: GraphInput, b: GraphInput) => string;
  readonly mul: (...v: readonly GraphInput[]) => string; readonly div: (a: GraphInput, b: GraphInput) => string;
  readonly min: (a: GraphInput, b: GraphInput) => string; readonly floor: (a: GraphInput) => string; readonly fract: (a: GraphInput) => string;
  readonly fwidth: (a: GraphInput) => string; readonly mix: (a: GraphInput, b: GraphInput, t: GraphInput) => string;
  readonly smooth: (e0: GraphInput, e1: GraphInput, x: GraphInput) => string; readonly clamp: (x: GraphInput, lo: GraphInput, hi: GraphInput) => string;
  readonly step: (e: GraphInput, x: GraphInput) => string; readonly dot: (a: GraphInput, b: GraphInput) => string;
  readonly vec2: (a: GraphInput, b: GraphInput) => string;
  /** the sine hash of a vec2 (GLSL `shkH`) */
  readonly hash: (p: string) => string;
  /** the value noise over the hash, smoothstep-blended (GLSL `shkN`) */
  readonly noise: (p: string) => string;
  /** the graph's own gradient noise remapped to 0 … 1 (cheaper in nodes; not the same field as `noise`) */
  readonly soft: (p: string) => string;
}
function makeKit(op: (name: string, inputs?: readonly GraphInput[], extra?: Omit<GraphNodeRow, 'op' | 'in'>) => string): Kit {
  const add = (a: GraphInput, b: GraphInput): string => op('add', [a, b]), sub = (a: GraphInput, b: GraphInput): string => op('sub', [a, b]);
  const mul = (...v: readonly GraphInput[]): string => { let out = op('mul', [v[0] ?? 1, v[1] ?? 1]); for (const x of v.slice(2)) out = op('mul', [out, x]); return out; };
  const floor = (a: GraphInput): string => op('floor', [a]), fract = (a: GraphInput): string => op('fract', [a]);
  const mix = (a: GraphInput, b: GraphInput, t: GraphInput): string => op('mix', [a, b, t]);
  const hash = (p: string): string => fract(mul(op('sin', [op('dot', [p, [127.1, 311.7]])]), 43758.5453));
  const noise = (p: string): string => {
    const i = floor(p), f = fract(p), u = mul(f, f, sub(3, mul(f, 2))), ux = op('swizzle', [u], { mask: 'x' }), uy = op('swizzle', [u], { mask: 'y' });
    return mix(mix(hash(i), hash(add(i, [1, 0])), ux), mix(hash(add(i, [0, 1])), hash(add(i, [1, 1])), ux), uy);
  };
  const shk = op('varying', [op('attribute', undefined, { name: 'aShk', type: 'vec3' })]);
  const q = op('swizzle', [shk], { mask: 'xy' });
  return {
    q, qx: op('swizzle', [shk], { mask: 'x' }), qy: op('swizzle', [shk], { mask: 'y' }), sd: op('swizzle', [shk], { mask: 'z' }),
    y: op('varying', [op('swizzle', [op('positionGeometry')], { mask: 'y' })]), c: op('vertexColour'),
    add, sub, mul, div: (a, b) => op('div', [a, b]), min: (a, b) => op('min', [a, b]), floor, fract, fwidth: (a) => op('fwidth', [a]), mix,
    smooth: (e0, e1, x) => op('smoothstep', [e0, e1, x]), clamp: (x, lo, hi) => op('clamp', [x, lo, hi]), step: (e, x) => op('step', [e, x]),
    dot: (a, b) => op('dot', [a, b]), vec2: (a, b) => op('combine', [a, b]), hash, noise,
    soft: (p) => add(mul(op('noise', [p]), 0.5), 0.5),
  };
}

/** planks: vertical boards (~24 cm), each its own tone and length; seams and butt joints; grain; rain streaks; dark at the sill */
const PLANK = shackGraph(0.88, (k) => {
  const bx = k.div(k.qx, 0.24), bi = k.floor(bx), fx = k.fract(bx);
  const len = k.add(2.4, k.mul(1.8, k.hash(k.vec2(bi, k.add(k.sd, 1)))));
  const by = k.add(k.div(k.qy, len), k.hash(k.vec2(bi, k.add(k.sd, 3.1)))), si = k.floor(by), fy = k.fract(by);
  const t = k.hash(k.vec2(k.add(k.mul(bi, 1.7), k.mul(si, 5.3)), k.sd));
  const ax = k.fwidth(bx), ay = k.fwidth(by);
  const seam = k.mul(k.smooth(0, k.add(0.05, ax), fx), k.smooth(1, k.sub(0.95, ax), fx));
  const butt = k.mul(k.smooth(0, k.add(0.01, ay), fy), k.smooth(1, k.sub(0.99, ay), fy));
  const grain = k.mul(k.add(0.84, k.mul(0.16, k.soft(k.vec2(k.add(k.mul(fx, 5), k.mul(bi, 7)), k.mul(k.qy, 1.4))))),
    k.add(0.93, k.mul(0.07, k.soft(k.vec2(k.add(k.mul(fx, 28), bi), k.mul(k.qy, 0.6))))));
  const rnd = k.add(0.88, k.mul(0.12, k.smooth(0, 0.3, k.min(fx, k.sub(1, fx)))));
  const streak = k.add(0.74, k.mul(0.26, k.soft(k.vec2(k.mul(k.qx, 1.7), k.add(k.mul(k.qy, 0.12), k.sd)))));
  const silver = k.smooth(0.35, 0.9, k.soft(k.vec2(k.add(k.mul(k.qx, 0.6), k.sd), k.mul(k.qy, 0.4))));
  const grime = k.mix(0.7, 1, k.smooth(0.9, 1.7, k.y));
  const raw = k.mul(k.c, k.mix(0.72, 1.12, t), grain, rnd, streak, grime);
  const board = k.mix(raw, k.mul(k.dot(raw, [0.33, 0.33, 0.33]), [1.02, 1, 0.97], 1.08), k.mul(silver, 0.45));
  // seams fade out where a board spans only a few pixels (else the far wall reads as zebra stripes)
  const near = k.clamp(k.sub(1.6, k.mul(ax, 4)), 0, 1);
  return k.mul(board, k.mix(1, k.mix(0.38, 1, k.mul(seam, butt)), near));
});

/** shingles: staggered rows from the eave up, ragged butts, a shadow under each row's butt, moss toward the eave */
const SHINGLE = shackGraph(0.88, (k) => {
  const r0 = k.div(k.qy, 0.3), row = k.floor(r0);
  const sx = k.add(k.add(k.div(k.qx, 0.33), k.mul(k.hash(k.vec2(row, k.sd)), 0.9)), k.mul(row, 0.5)), si = k.floor(sx), fx = k.fract(sx);
  const r = k.add(r0, k.mul(k.sub(k.hash(k.vec2(si, k.add(row, k.sd))), 0.5), 0.16)), ri = k.floor(r), fr = k.fract(r);
  const t = k.hash(k.vec2(k.mul(si, 1.3), k.add(k.mul(ri, 2.1), k.sd)));
  const ax = k.fwidth(sx);
  const gap = k.mul(k.smooth(0, k.add(0.05, ax), fx), k.smooth(1, k.sub(0.95, ax), fx));
  const near = k.clamp(k.sub(1.6, k.mul(ax, 4)), 0, 1);
  const shade = k.mix(1, k.mul(k.mix(1, 0.6, k.smooth(0.6, 1, fr)), k.add(1, k.mul(0.12, k.sub(1, k.smooth(0, 0.12, fr))))), k.mix(0.5, 1, near));
  const grain = k.add(0.88, k.mul(0.12, k.soft(k.vec2(k.add(k.mul(fx, 6), si), k.mul(k.qy, 8)))));
  const sh = k.mul(k.c, k.mix(0.72, 1.14, t), k.add(0.9, k.mul(0.2, k.soft(k.add(k.vec2(k.mul(k.qx, 0.5), k.mul(k.qy, 0.35)), k.sd)))), grain, shade, k.mix(1, k.mix(0.5, 1, gap), near));
  const moss = k.add(k.mul(k.smooth(0.6, 0.9, k.soft(k.add(k.mul(k.q, 0.9), k.sd))), k.sub(1, k.smooth(0.2, 1.6, k.qy)), 0.6), k.mul(0.3, k.step(0.95, t)));
  return k.mix(sh, k.mul([0.16, 0.19, 0.08], shade), k.clamp(moss, 0, 0.6));
});

/** stone: coursed blocks of mixed tone, mortar, bevelled edges, speckle, grime and moss at the foot */
const STONE = shackGraph(0.95, (k) => {
  const ch = 0.36, r = k.div(k.qy, ch), ri = k.floor(r), fr = k.fract(r);
  const L = k.add(0.5, k.mul(0.38, k.hash(k.vec2(ri, k.sd))));
  const s = k.add(k.div(k.qx, L), k.hash(k.vec2(k.mul(ri, 3.1), k.add(k.sd, 2)))), si = k.floor(s), fs = k.fract(s);
  const t = k.hash(k.vec2(si, k.add(ri, k.mul(k.sd, 2))));
  const d = k.min(k.mul(k.min(fr, k.sub(1, fr)), ch), k.mul(k.min(fs, k.sub(1, fs)), L));
  const mortar = k.smooth(0.01, k.add(0.035, k.mul(k.fwidth(k.qx), 1.5)), d);
  const bevel = k.mix(0.72, 1, k.smooth(0.015, 0.11, d));
  const hue = k.mix([1.04, 0.97, 0.88], [0.88, 0.92, 1], k.hash(k.vec2(k.add(si, 7), ri)));
  const speck = k.add(0.86, k.mul(0.14, k.soft(k.mul(k.q, 11)), k.soft(k.add(k.mul(k.q, 3), 5))));
  const st = k.mix([0.22, 0.2, 0.19], k.mul(k.c, hue, k.mix(0.62, 1.18, t), bevel, speck), mortar);
  const foot = k.sub(1, k.smooth(0, 0.7, k.y));
  const moss = k.mul(foot, k.smooth(0.35, 0.7, k.soft(k.add(k.mul(k.q, 2.3), k.sd))));
  return k.mix(k.mul(st, k.sub(1, k.mul(0.3, foot))), [0.17, 0.22, 0.07], k.mul(moss, 0.8));
});

/** beams: trim and posts, the grain along the piece, a tone per piece, the odd check (crack) */
const BEAM = shackGraph(0.88, (k) => {
  const g = k.noise(k.vec2(k.add(k.mul(k.qx, 0.9), k.mul(k.sd, 3)), k.add(k.mul(k.qy, 22), k.mul(k.sd, 13))));
  const g2 = k.soft(k.vec2(k.mul(k.qx, 4), k.mul(k.qy, 55)));
  const check = k.smooth(0.88, 0.96, k.noise(k.vec2(k.add(k.mul(k.qx, 0.45), k.sd), k.mul(k.qy, 36))));
  return k.mul(k.c, k.add(0.78, k.mul(0.28, g)), k.add(0.92, k.mul(0.08, g2)), k.sub(1, k.mul(0.5, check)), k.mix(0.85, 1.12, k.hash(k.vec2(k.sd, 1))));
});

/** Each kind's material graph (`look.materials.shack-<kind>`). */
export const SHACK_GRAPHS = { plank: PLANK, shingle: SHINGLE, stone: STONE, beam: BEAM } as const;
