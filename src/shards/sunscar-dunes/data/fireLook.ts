import { FIRE_STYLE } from './fire';
import fireBook from './fireBook.generated.json' with { type: 'json' };

/**
 * Signal Dunes' fire as SF59 material graphs (SHARD-PLATFORM G382 / G377: the hand-written fire shaders' look, kept: a
 * white-hot flipbook core, a leaning smoke plume, a curling cookfire wisp, ember streaks, a flickering halo and a warm
 * ground pool), the shardfile's `look.materials.fire-*`. Each part is a graph over the fire effect's own quads and points
 * (`world/fireFx.ts` places them): unlit, unfogged, depth-tested without writing depth, animated from the fires'
 * clock (`uTime`, bound to the host field `shared.firetime`: the game's frame time the fires tick on). The colours go
 * out as the old programs wrote them, unconverted (G402: the game renders into the composer's linear target).
 * - glow / lamp glow: a soft spherical billboard (`viewBillboard`) the mesh's scale wide, fading inside its own radius;
 * - pool: the warm disc draped on the sand, drawn over it (`depthBias`);
 * - plume / wisp: a column turned about Y to the camera, widening with height, leaning downwind on the breeze and
 *   swaying; value-noise puffs from the foot's warm colour to the top's;
 * - flame: the same column (it leans little) playing the flipbook (`book`, cross-faded frames, each billboard its own
 *   phase), graded per channel with the core raised low and central, premultiplied so its body covers the sky;
 * - embers: points rising and spreading on the breeze, each a short dash along its own projected motion, cooling.
 */

type GraphInput = string | number | readonly number[];
interface GraphNodeRow { readonly op: string; readonly in?: readonly GraphInput[]; readonly mask?: string; readonly param?: string; readonly name?: string; readonly type?: string }
type Rgb = readonly [number, number, number];
interface Drift { readonly lean: number; readonly widen: number; readonly sway: number }
interface Smoke { readonly drift: Drift; readonly foot: Rgb; readonly top: Rgb; readonly fade: number; readonly alpha: number }

/** One graph's node table and its op helpers (local only: the module exports the finished rows). */
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
  const mul = (a: GraphInput, b: GraphInput): string => op('mul', [a, b]), mix = (a: GraphInput, b: GraphInput, t: GraphInput): string => op('mix', [a, b, t]);
  const smooth = (e0: GraphInput, e1: GraphInput, x: GraphInput): string => op('smoothstep', [e0, e1, x]);
  const swz = (a: string, mask: string): string => op('swizzle', [a], { mask });
  // the fires' clock: the host field the runtime ticks (the game's frame time, as the old programs' uTime)
  const time = op('param', undefined, { param: 'uTime' });
  /** sin(t · rate + phase) */
  const wave = (rate: number, phase = 0): string => op('sin', [phase === 0 ? mul(time, rate) : add(mul(time, rate), phase)]);
  /** the old programs' value noise (sine hash, smoothstep blend) */
  const hash = (p: string): string => op('fract', [mul(op('sin', [op('dot', [p, [127.1, 311.7]])]), 43758.5453)]);
  const valueNoise = (p: string): string => {
    const i = op('floor', [p]), f = op('fract', [p]), u = mul(mul(f, f), sub(3, mul(f, 2))), ux = swz(u, 'x'), uy = swz(u, 'y');
    return mix(mix(hash(i), hash(add(i, [1, 0])), ux), mix(hash(add(i, [0, 1])), hash(add(i, [1, 1])), ux), uy);
  };
  /** the distance from the uv's centre, 0 there, 1 at the quad's edge midpoints */
  const radius = (): string => mul(op('length', [sub(op('uv'), 0.5)]), 2);
  /** the mesh's world scale per axis (its model matrix's column lengths, parents included) */
  const scale = (): string => op('modelScale');
  return { nodes, op, add, sub, mul, mix, smooth, swz, time, wave, valueNoise, radius, scale };
}
type Kit = ReturnType<typeof kit>;

/** the fires' clock param, bound to the host field `shared.firetime` */
const CLOCK = { uTime: { type: 'float', value: 0, bind: { state: 'shared.firetime' } } } as const;
const unlit = (nodes: Readonly<Record<string, GraphNodeRow>>, blend: 'additive' | 'alpha' | 'premultiplied', stages: object, extra: object = {}): object =>
  ({ version: 1, kind: 'material', model: 'unlit', effectState: { blend, fog: false, depthWrite: false, ...extra }, params: CLOCK, nodes, stages });

/** The halo round a fire (and a lamp's brighter one): a billboard facing the camera, the mesh's scale its radius. */
function glowGraph(gain: number): object {
  const k = kit('g'), { op, add, mul, smooth, wave, radius } = k;
  const s = k.swz(k.scale(), 'x'), origin = op('objectOrigin');
  // the quad's metres (±1) turned to face the camera, then the mesh's own scale: viewBillboard is model space at the
  // geometry's size, so the scaled corner is `s` times it
  const offset = k.sub(mul(op('viewBillboard'), s), op('positionLocal'));
  // inside the glow's own radius the halo fades (by the fire's view depth)
  const fade = op('varying', [smooth(mul(s, 0.35), mul(s, 1.1), op('viewDepth', [origin]))]);
  const r = radius(), flick = add(add(0.86, mul(wave(13), 0.08)), mul(wave(29, 1.3), 0.06));
  const g = mul(op('exp', [mul(mul(r, r), -5)]), op('oneMinus', [smooth(0.85, 1, r)]));
  return unlit(k.nodes, 'additive', { 'vertex.offset': { offset }, surface: { colour: mul(FIRE_STYLE.glow.colour, mul(mul(mul(g, gain), flick), fade)) } });
}

/** The warm pool draped on the ground round a fire: a broad wash and a hot centre, flickering, drawn over the sand. */
function poolGraph(): object {
  const k = kit('p'), { add, mul, op, wave } = k, { colour, wide, hot } = FIRE_STYLE.pool;
  const rim = op('max', [0, op('oneMinus', [k.radius()])]), flick = add(add(0.85, mul(wave(11), 0.1)), mul(wave(23), 0.05));
  const body = add(mul(op('pow', [rim, 1.8]), wide), mul(op('pow', [rim, 6]), hot));
  return unlit(k.nodes, 'additive', { surface: { colour: mul(colour, mul(body, flick)) } }, { depthBias: { factor: -2, units: -2 } });
}

/**
 * A column's vertex (the quad x −0.5 … 0.5, y 0 … 1): turned about Y to face the camera, the mesh's x scale wide and its
 * y scale tall, widening by `widen` per unit height, leaning `lean` m per unit height² downwind and swaying.
 * Returns its varyings: the camera's nearness (a camera inside the column sees through it), the billboard's seed and
 * the vertex's distance from the camera.
 */
function column(k: Kit, d: Drift): { offset: string; near: string; seed: string; far: string } {
  const { op, add, sub, mul, swz } = k, [bx, bz] = FIRE_STYLE.breeze;
  const origin = op('objectOrigin'), sc = k.scale(), sx = swz(sc, 'x'), sy = swz(sc, 'y');
  const p = op('positionGeometry'), x = swz(p, 'x'), y = swz(p, 'y');
  const toCam = sub(op('cameraPosition'), origin), tx = swz(toCam, 'x'), tz = swz(toCam, 'z');
  const flat = op('length', [op('combine', [tx, tz])]);
  // right × up faces the camera (or the quad is back-face culled)
  const right = op('normalize', [op('combine', [add(tz, 1e-4), 0, op('negate', [tx])])]);
  const across = mul(right, mul(mul(x, sx), add(1, mul(y, d.widen))));
  const lean = mul(mul(mul(y, y), sy), d.lean), sway = mul(mul(mul(y, sy), d.lean), d.sway);
  const driftX = add(mul(lean, bx), mul(op('sin', [add(mul(k.time, 0.7), mul(y, 3))]), sway));
  const driftZ = add(mul(lean, bz), mul(op('cos', [add(mul(k.time, 0.5), mul(y, 2))]), sway));
  const world = add(across, op('combine', [driftX, mul(y, sy), driftZ]));
  // the world offset back to model space: the transpose over the squared scale is the inverse of rotation × scale
  const local = op('div', [op('worldToLocal', [world]), mul(sc, sc)]);
  return {
    offset: sub(local, op('positionLocal')),
    near: op('varying', [k.smooth(1.2, 3.5, flat)]),
    seed: op('varying', [op('fract', [op('dot', [origin, [3.13, 0.37, 1.71]])])]),
    far: op('varying', [op('length', [sub(op('cameraPosition'), add(origin, world))])]),
  };
}

/** A smoke column: billowing value-noise puffs, the foot's colour to the top's, fading far off and up close. */
function smokeGraph(smoke: Smoke): object {
  const k = kit('s'), { op, add, sub, mul, smooth, swz, valueNoise } = k, v = column(k, smoke.drift);
  const uv = op('uv'), x = swz(uv, 'x'), y = swz(uv, 'y');
  const n = add(mul(valueNoise(op('combine', [mul(x, 3), sub(mul(y, 6), mul(k.time, 0.55))])), 0.65),
    mul(valueNoise(op('combine', [add(mul(x, 7), 1.7), sub(mul(y, 14), mul(k.time, 1.1))])), 0.35));
  // the distance from the axis, frayed by the noise (offset by +0.4: the old program's (n − 0.5) · 0.8, folded into the edge)
  const d = add(mul(op('abs', [sub(x, 0.5)]), 2), mul(n, 0.8));
  // billowing puffs, not a straight slab: the column breaks into clumps as it rises (n + 0.25 (1 − y), folded likewise)
  const puff = smooth(0.1, 0.5, sub(n, mul(y, 0.25)));
  const body = mul(mul(mul(op('oneMinus', [smooth(0.55, 1.3, d)]), smooth(0, 0.06, y)), op('oneMinus', [smooth(0.35, 0.95, y)])), puff);
  const colour = k.mix(smoke.foot, smoke.top, smooth(0, smoke.fade, y));
  const alpha = mul(mul(mul(body, smoke.alpha), op('oneMinus', [smooth(260, 420, v.far)])), v.near);
  return unlit(k.nodes, 'alpha', { 'vertex.offset': { offset: v.offset }, surface: { colour, alpha } });
}

/** The flame: the flipbook on a leaning column, cross-faded, graded, its white-hot core gated by its place. */
function flameGraph(): object {
  const k = kit('f'), { op, add, sub, mul, smooth, swz } = k, v = column(k, FIRE_STYLE.flame.drift);
  const { columns, rows, fps } = FIRE_STYLE.book, frames = columns * rows, { power, tint, core } = FIRE_STYLE.bookGrade;
  const raw = op('uv'), uv = op('clamp', [raw, [0.004, 0.004], [0.996, 0.996]]), ux = swz(uv, 'x'), uy = swz(uv, 'y');
  // cell i at the quad's uv: row 0 is the image's top (the admitted texture is not flipped: v runs down the image)
  const cell = (i: string): string => {
    const col = op('mod', [i, columns]), row = op('floor', [op('div', [i, columns])]);
    return swz(op('texture', [op('combine', [op('div', [add(col, ux), columns]), op('div', [sub(add(row, 1), uy), rows])])], { param: 'book' }), 'xyz');
  };
  const fade = mul(smooth(0.8, 2.6, v.far), op('max', [v.near, 0.25]));
  // each billboard its own phase, the next frame cross-faded in
  const ft = add(mul(k.time, fps), mul(v.seed, frames)), i0 = op('mod', [op('floor', [ft]), frames]), t = op('fract', [ft]);
  const c = k.mix(cell(i0), cell(op('mod', [add(i0, 1), frames])), t);
  const lum = op('max', [swz(c, 'x'), op('max', [swz(c, 'y'), swz(c, 'z')])]);
  // the render is light over black: its coverage from its brightness
  const cover = op('clamp', [mul(lum, 1.7), 0, 1]);
  const rx = swz(raw, 'x'), ry = swz(raw, 'y');
  const coreAt = mul(mul(op('oneMinus', [smooth(0.1, 0.42, ry)]), op('oneMinus', [smooth(0.12, 0.32, op('abs', [sub(rx, 0.5)]))])), smooth(0.3, 0.6, lum));
  const graded = mul(mul(op('pow', [c, power]), tint), add(1, mul(coreAt, core)));
  return { ...unlit(k.nodes, 'premultiplied', { 'vertex.offset': { offset: v.offset }, surface: { colour: mul(graded, fade), alpha: mul(cover, fade) } }),
    params: { ...CLOCK, book: { type: 'texture', value: fireBook.hash } } };
}

/** The embers: points rising and spreading downwind, each a dash along its own projected motion, cooling hot → cool. */
function emberGraph(): object {
  const k = kit('e'), { op, add, sub, mul, swz } = k, [bx, bz] = FIRE_STYLE.breeze, { hot, cool, gain } = FIRE_STYLE.embers;
  const seed = op('attribute', undefined, { name: 'aSeed', type: 'float' }), s = swz(k.scale(), 'x'), origin = op('objectOrigin');
  /** an ember's place (world, from the fire's origin) at its `life` and swirl angle `a` */
  const at = (life: string, a: string): string => {
    const spread = mul(mul(add(1, mul(life, 3)), 0.22), s), blow = mul(mul(mul(life, add(0.6, life)), 4.5), s);
    return op('combine', [add(mul(op('cos', [a]), spread), mul(blow, bx)), mul(mul(life, 6.5), s), add(mul(op('sin', [a]), spread), mul(blow, bz))]);
  };
  const swirl = (t: string): string => add(mul(seed, 40), mul(t, add(1, op('fract', [mul(seed, 3.7)]))));
  const life = op('fract', [add(mul(k.time, add(0.22, mul(op('fract', [mul(seed, 7.13)]), 0.18))), seed)]);
  // now, and 0.02 on (life + 0.02 unwrapped, the swirl at t + 0.02), as the old program's dash
  const now = { p: at(life, swirl(k.time)), life }, next = { p: at(add(life, 0.02), swirl(add(k.time, 0.02))) };
  const offset = sub(op('div', [op('worldToLocal', [now.p]), mul(s, s)]), op('positionLocal'));
  const depth = op('viewDepth', [add(origin, now.p)]);
  const size = mul(op('clamp', [op('div', [mul(mul(sub(1, mul(now.life, 0.6)), 150), add(0.6, op('fract', [mul(seed, 13.1)]))), depth]), 2, 11]),
    op('oneMinus', [k.smooth(35, 60, depth)]));
  // each dash along its own projected motion (screen direction from now to 0.02 s on)
  const dir = op('varying', [op('screenDirection', [add(origin, now.p), add(origin, next.p)])]), vLife = op('varying', [life]);
  const q = sub(op('pointCoord'), 0.5), along = op('dot', [q, dir]);
  const across = op('dot', [q, op('combine', [op('negate', [swz(dir, 'y')]), swz(dir, 'x')])]);
  const a = mul(mul(op('oneMinus', [k.smooth(0.06, 0.16, op('abs', [across]))]), op('oneMinus', [k.smooth(0.25, 0.5, op('abs', [along]))])), op('oneMinus', [k.smooth(0.6, 1, vLife)]));
  return { ...unlit(k.nodes, 'additive', { points: { size }, 'vertex.offset': { offset }, surface: { colour: mul(k.mix(hot, cool, vLife), mul(a, gain)) } }), primitive: 'points' };
}

/** The fire's material graphs by look.materials id (the fire effect's parts). */
export const FIRE_GRAPHS = {
  'fire-flame': flameGraph(),
  'fire-smoke': smokeGraph(FIRE_STYLE.plume),
  'fire-wisp': smokeGraph(FIRE_STYLE.wisp),
  'fire-glow': glowGraph(FIRE_STYLE.glow.gain),
  'fire-lamp-glow': glowGraph(FIRE_STYLE.glow.lampGain),
  'fire-embers': emberGraph(),
  'fire-pool': poolGraph(),
} as const;
