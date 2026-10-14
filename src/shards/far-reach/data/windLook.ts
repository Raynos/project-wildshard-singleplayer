import type { EffectFieldRow } from '@wildshard/sdk/looks/effectField';
import { UPDRAFT } from './layout';

/**
 * Sky Reach's visible wind (style bible §7, loop 3; drawn on @wildshard/sdk/looks/effectField): the fan's GUST, a cone of
 * streaks with tumbling petals, and the updraft's column, a soft spiral of streaks with rising leaves up the ramp.
 */

/** The GUST: how many streaks and petals, how long they live, how far they fly; warm streaks and blossom petals. */
export const GUST_FX: GustRow = {
  streaks: 30, petals: 14, life: 0.6, speed: 20, start: 1.0, spread: 1.7,
  tint: 0xeaf8ff, warm: 0xffe6c4, petalColours: [0xffd4dc, 0xfff1e0, 0xffc6a8, 0xf5b8d0],
  streakName: 'far.gust.streaks', petalName: 'far.gust.petals',
};

/** The updraft's spiral round the ramp. Round 2 (council: the streaks crossing the glass ramp read as cracks): fewer,
 *  fainter, wider round the ramp. */
export const UPDRAFT_FX: UpdraftRow = {
  streaks: 24, leaves: 14, radius: 3.3, turns: 6, rate: 0.1,
  tint: 0xcdeeff, leafColours: [0xb9c868, 0xd9c060, 0x93b552, 0xf0d488],
  streakName: 'far.updraft.streaks', leafName: 'far.updraft.leaves',
};

/** The updraft column's axis (the ramp's line 2.2 m up): its foot and its aim (foot to top), where its fields stand. */
export const UPDRAFT_AXIS = { at: [UPDRAFT.x0, UPDRAFT.y + 2.2, UPDRAFT.z0], aim: [UPDRAFT.x1 - UPDRAFT.x0, UPDRAFT.y1 - UPDRAFT.y, UPDRAFT.z1 - UPDRAFT.z0] } as const;
const AXIS_LENGTH = Math.hypot(...UPDRAFT_AXIS.aim);

/**
 * The wind's seeded effect fields (@wildshard/sdk/looks/effectField), each drawn in its WIND_LOOKS graph: the GUST's
 * streaks and petals are bursts (hidden between them; a little longer than their life, for the copies' start delays), the
 * updraft's streaks and leaves loop.
 */
export const WIND_FIELDS = {
  gustStreaks: { name: GUST_FX.streakName, shape: 'streak', count: GUST_FX.streaks, life: GUST_FX.life + 0.1 },
  gustPetals: { name: GUST_FX.petalName, shape: 'flake', count: GUST_FX.petals, palette: GUST_FX.petalColours, life: GUST_FX.life + 0.28 },
  updraftStreaks: { name: UPDRAFT_FX.streakName, shape: 'streak', count: UPDRAFT_FX.streaks },
  updraftLeaves: { name: UPDRAFT_FX.leafName, shape: 'flake', count: UPDRAFT_FX.leaves, palette: UPDRAFT_FX.leafColours },
} as const satisfies Record<string, EffectFieldRow>;

type GraphInput = string | number | readonly number[];
interface GraphNodeRow { readonly op: string; readonly in?: readonly GraphInput[]; readonly mask?: string; readonly name?: string; readonly type?: string }
/** an sRGB hex colour as linear RGB (the graphs' colours are linear, as the old instance colours were) */
const linear = (hex: number): readonly number[] => [16, 8, 0].map((shift) => { const c = ((hex >> shift) & 255) / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });

/** One graph's node table and its vector helpers (local only: the module exports the finished graphs). */
function kit(prefix: string) {
  const nodes: Record<string, GraphNodeRow> = {}, seen = new Map<string, string>();
  let next = 0;
  /** a node; the same op on the same inputs is one node */
  const op = (name: string, inputs?: readonly GraphInput[], extra?: Omit<GraphNodeRow, 'op' | 'in'>): string => {
    const row: GraphNodeRow = { op: name, ...(inputs === undefined ? {} : { in: inputs }), ...extra }, key = JSON.stringify(row), known = seen.get(key);
    if (known !== undefined) return known;
    const id = `${prefix}${String(next++)}`;
    nodes[id] = row; seen.set(key, id);
    return id;
  };
  const add = (a: GraphInput, b: GraphInput): string => op('add', [a, b]), sub = (a: GraphInput, b: GraphInput): string => op('sub', [a, b]);
  const mul = (a: GraphInput, b: GraphInput): string => op('mul', [a, b]), swz = (a: string, mask: string): string => op('swizzle', [a], { mask });
  const vec = (x: GraphInput, y: GraphInput, z: GraphInput): string => op('combine', [x, y, z]);
  const attr = (name: string, type: string): string => op('attribute', undefined, { name, type });
  /** the copy's j-th random number (0 … 1) from its seed (four to a hash) */
  const rnd = (seed: string, j: number): string => {
    const g = Math.floor(j / 4), lane = [0, 1, 2, 3].map((n) => g * 4 + n);
    return swz(op('fract', [mul(op('sin', [add(mul(seed, lane.map((n) => 12.9898 + n * 7.31)), lane.map((n) => n * 1.731))]), 43758.5453)]), 'xyzw'.charAt(j % 4));
  };
  /** 1 while 0 < k < 1, else 0 (a copy outside its life collapses) */
  const live = (k: string): string => mul(op('step', [1e-4, k]), op('oneMinus', [op('step', [1, k])]));
  const cross = (a: string, b: string): string => sub(mul(swz(a, 'yzx'), swz(b, 'zxy')), mul(swz(a, 'zxy'), swz(b, 'yzx')));
  /** `v` turned by `angle` about the unit `axis` (Rodrigues) */
  const turn = (v: string, axis: string, angle: string): string => {
    const c = op('cos', [angle]), s = op('sin', [angle]);
    return add(add(mul(v, c), mul(cross(axis, v), s)), mul(axis, mul(op('dot', [axis, v]), op('oneMinus', [c]))));
  };
  /** a streak vertex: the shape's crossed quads laid along `dir` from `at`, `width` wide and `length` long */
  const streak = (at: string, dir: string, ref: readonly [number, number, number], width: GraphInput, length: GraphInput): string => {
    const g = op('positionLocal'), r = op('normalize', [cross(vec(...ref), dir)]), u = cross(dir, r);
    return add(add(at, mul(add(mul(r, swz(g, 'x')), mul(u, swz(g, 'y'))), width)), mul(dir, mul(op('negate', [swz(g, 'z')]), length)));
  };
  return { nodes, op, add, sub, mul, swz, vec, attr, rnd, live, turn, streak };
}
type Kit = ReturnType<typeof kit>;
/** a streak's surface: bright in the middle of its length and width, tapering to nothing; its tint and fade carried over */
function streakSurface(k: Kit, tint: GraphInput, fade: string): object {
  const { op, mul, swz } = k, uv = op('uv'), u = swz(uv, 'x'), v = swz(uv, 'y');
  const along = mul(op('smoothstep', [0, 0.35, u]), op('oneMinus', [op('smoothstep', [0.55, 1, u])])), across = op('oneMinus', [op('abs', [k.sub(mul(v, 2), 1)])]);
  return { colour: typeof tint === 'string' ? op('varying', [tint]) : tint, alpha: mul(mul(op('varying', [fade]), along), across) };
}
const STREAK = { model: 'unlit', doubleSided: true, effectState: { fog: false, depthWrite: false, singlePass: true } } as const;
const FLAKE = { model: 'unlit', doubleSided: true, effectState: { depthWrite: false } } as const;
const TAU = Math.PI * 2;

/** The GUST's streaks: speed lines from a patch round the origin out along the gust (local −z), curling a little round it. */
function gustStreakGraph(): object {
  const k = kit('g'), { op, add, sub, mul, vec, swz, rnd } = k, g = GUST_FX, burst = k.attr('aBurst', 'vec2');
  const seed = op('fract', [add(k.attr('aSeed', 'float'), swz(burst, 'y'))]), r = (j: number): string => rnd(seed, j);
  const a = mul(r(1), TAU), rr = mul(op('pow', [r(2), 0.5]), 0.16), d0 = op('normalize', [vec(mul(op('negate', [op('cos', [a])]), rr), mul(op('sin', [a]), rr), -1)]);
  const a2 = mul(r(3), TAU), r2 = add(0.35, mul(r(4), g.spread * 0.5)), start = vec(mul(op('negate', [op('cos', [a2])]), r2), mul(mul(op('sin', [a2]), r2), 0.7), 0);
  const t = op('max', [0, sub(swz(burst, 'x'), mul(r(9), 0.1))]), kk = mul(t, 1 / g.life), live = k.live(kk);
  const spin = mul(mul(sub(r(5), 0.5), 1.2), kk), c = op('cos', [spin]), s = op('sin', [spin]), dx = swz(d0, 'x'), dy = swz(d0, 'y');
  const d = vec(sub(mul(dx, c), mul(dy, s)), add(mul(dx, s), mul(dy, c)), swz(d0, 'z'));
  const dist = add(g.start, mul(mul(mul(g.speed, add(0.75, mul(r(6), 0.5))), t), sub(1, mul(kk, 0.45))));
  const length = mul(add(1, mul(3.2, op('sin', [mul(op('min', [1, mul(kk, 1.6)]), Math.PI * 0.5)]))), live);
  const width = mul(mul(add(0.05, mul(r(7), 0.07)), add(1, kk)), live);
  const offset = sub(k.streak(add(start, mul(d, dist)), d, [0, 1, 0], width, length), op('positionLocal'));
  const fade = mul(mul(mul(op('min', [1, mul(kk, 8)]), op('pow', [op('oneMinus', [kk]), 1.3])), 0.8), live);
  const tint = op('mix', [linear(g.tint), linear(g.warm), op('step', [r(8), 0.3])]);
  return { version: 1, kind: 'material', ...STREAK, nodes: k.nodes, stages: { 'vertex.offset': { offset }, surface: streakSurface(k, tint, fade) } };
}

/** The GUST's petals: tumbling out in a wider cone than the streaks, falling as they slow. */
function gustPetalGraph(): object {
  const k = kit('p'), { op, add, sub, mul, vec, swz, rnd } = k, g = GUST_FX, burst = k.attr('aBurst', 'vec2'), i = k.attr('aIndex', 'float');
  const seed = op('fract', [add(k.attr('aSeed', 'float'), swz(burst, 'y'))]), r = (j: number): string => rnd(seed, j);
  const a = mul(r(11), TAU), rr = mul(op('pow', [r(12), 0.5]), 0.5), d = op('normalize', [vec(mul(op('negate', [op('cos', [a])]), rr), mul(op('sin', [a]), rr), -1)]);
  const t = op('max', [0, sub(swz(burst, 'x'), mul(r(14), 0.08))]), kk = mul(t, 1 / (g.life + 0.2));
  const fall = op('worldToLocal', [vec(0, mul(mul(t, t), -1.2), 0)]);
  const at = add(mul(d, add(g.start + 0.6, mul(mul(g.speed, add(0.35, mul(r(13), 0.25))), t))), fall);
  const axis = op('normalize', [vec(op('sin', [i]), 1, op('cos', [mul(i, 1.7)]))]), size = mul(mul(add(0.035, mul(r(15), 0.03)), op('oneMinus', [mul(kk, kk)])), k.live(kk));
  const offset = sub(add(at, k.turn(mul(op('positionLocal'), size), axis, mul(mul(sub(r(16), 0.5), 14), t))), op('positionLocal'));
  return { version: 1, kind: 'material', ...FLAKE, nodes: k.nodes, stages: { 'vertex.offset': { offset }, surface: { colour: k.attr('aTint', 'vec3'), alpha: 0.95 } } };
}

/** A point of the updraft's helix (local −z its axis) at climb `f` (0 … 1), angle `angle` and radius `r`. */
function helix(k: Kit, f: string, angle: string, r: GraphInput): string {
  return k.vec(k.mul(k.op('cos', [angle]), r), k.mul(k.op('sin', [angle]), r), k.mul(f, -AXIS_LENGTH));
}

/** The updraft's streaks: a soft spiral climbing the column. */
function updraftStreakGraph(): object {
  const k = kit('u'), { op, add, sub, mul } = k, u = UPDRAFT_FX, i = k.attr('aIndex', 'float');
  const f = op('fract', [add(mul(i, 1 / u.streaks), mul(op('time'), u.rate))]), angle = add(mul(f, u.turns * TAU), mul(i, 2.39996));
  const r = mul(u.radius, add(0.8, mul(0.3, op('sin', [mul(i, 1.7)]))));
  const p = helix(k, f, angle, r), p2 = helix(k, add(f, 0.012), add(angle, 0.55), r), dir = op('normalize', [sub(p2, p)]);
  const offset = sub(k.streak(p2, dir, [0, 0, 1], 0.07, 2.4), op('positionLocal'));
  return { version: 1, kind: 'material', ...STREAK, nodes: k.nodes, stages: { 'vertex.offset': { offset }, surface: streakSurface(k, linear(u.tint), mul(op('sin', [mul(f, Math.PI)]), 0.42)) } };
}

/** The updraft's leaves: rising the other way round the column, tumbling, growing in and out. */
function updraftLeafGraph(): object {
  const k = kit('l'), { op, add, sub, mul, vec } = k, u = UPDRAFT_FX, i = k.attr('aIndex', 'float'), time = op('time');
  const f = op('fract', [add(mul(i, 1 / u.leaves), mul(time, u.rate * 0.8))]), angle = add(mul(f, -u.turns * 1.4 * TAU), mul(i, 1.3));
  const axis = op('normalize', [vec(op('sin', [mul(i, 3.1)]), 1, op('cos', [i]))]), spin = mul(time, add(3, op('mod', [i, 3])));
  const size = mul(0.26, op('min', [1, mul(op('sin', [mul(f, Math.PI)]), 3)]));
  const offset = sub(add(helix(k, f, angle, u.radius * 1.1), k.turn(mul(op('positionLocal'), size), axis, spin)), op('positionLocal'));
  return { version: 1, kind: 'material', ...FLAKE, nodes: k.nodes, stages: { 'vertex.offset': { offset }, surface: { colour: k.attr('aTint', 'vec3'), alpha: 0.95 } } };
}

/**
 * The wind's looks (SF59 graphs, the shardfile's `look.materials.*`; one per WIND_FIELDS row): each moves its field's
 * copies on the GPU from their seeds and the burst's clock (the GUST) or the frame time (the updraft). The streaks are
 * unlit, alpha-blended, unfogged and write no depth; the petals and leaves are fogged and write no depth.
 */
export const WIND_GRAPHS = {
  'wind-gust-streak': gustStreakGraph(), 'wind-gust-petal': gustPetalGraph(),
  'wind-updraft-streak': updraftStreakGraph(), 'wind-updraft-leaf': updraftLeafGraph(),
} as const;
/** each WIND_FIELDS row's look id */
export const WIND_LOOKS = { gustStreaks: 'wind-gust-streak', gustPetals: 'wind-gust-petal', updraftStreaks: 'wind-updraft-streak', updraftLeaves: 'wind-updraft-leaf' } as const satisfies Record<keyof typeof WIND_FIELDS, keyof typeof WIND_GRAPHS>;

/** A gust's rows: how many streaks and petals, how long they live, how far they fly; the colours and the meshes' names. */
export interface GustRow {
  readonly streaks: number;
  readonly petals: number;
  readonly life: number;
  readonly speed: number;
  readonly start: number;
  readonly spread: number;
  /** a streak's tint (sRGB hex), and the warm one's (drawn by about 3 in 10) */
  readonly tint: number;
  readonly warm: number;
  /** the petals' colours (sRGB hex), in turn */
  readonly petalColours: readonly number[];
  readonly streakName: string;
  readonly petalName: string;
}

/** An updraft's rows: its streaks and leaves round a helix of `radius` with `turns` turns, climbing at `rate` per second. */
export interface UpdraftRow {
  readonly streaks: number;
  readonly leaves: number;
  readonly radius: number;
  readonly turns: number;
  readonly rate: number;
  /** the streaks' tint (sRGB hex) */
  readonly tint: number;
  /** the leaves' colours (sRGB hex), in turn */
  readonly leafColours: readonly number[];
  readonly streakName: string;
  readonly leafName: string;
}
