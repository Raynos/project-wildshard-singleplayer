import type { GraphIr, GraphNode, GraphRef } from '@wildshard/format/materialGraph';

/**
 * Driftwood's toon cascade (E150) as SF59 material graphs (SHARD-PLATFORM W2 C2; the shardfile's `look.materials`,
 * compiled by the runtime and drawn on runtime/looks/cascade.ts's three meshes): the curtain, the plunge pool's foam rings
 * and the foam puffs. All three are unlit, alpha-blended, fogged and write no depth; each shades with the day's sun the
 * fog holds (`atmosphereSunDirection` / `atmosphereSunColour`), lit `0.35 + 0.75 × sun`, as the GLSL programs did.
 *
 * - `curtain`: three toon bands across the pleats (the face normal against the sun), glassy cyan pouring into deeper teal
 *   down each drop in hard bands, bright streak dashes scrolling down seven lanes, a crisp white roll at every brink with a
 *   pale band below it, scalloped foam where a drop lands on the next shelf, the last metre churning white and a thin white
 *   rim at the sides. Reads `uv` (across, down the whole cascade) and `aStep` (the fraction down a terrace, the terrace).
 * - `pool`: the churn at the core (a white disc with a scalloped rim) and three faceted (9-sided) rings spreading out,
 *   thinning, each dashed on a few of the polygon's sides. Reads the disc's own `uv` (its centre at 0.5, 0.5).
 * - `puffs`: each puff a 20-face ball posed in the vertex stage from `aCentre` and `aInfo` (radius, seed, kind: 0 foam at
 *   the foot, 1 foam on a landing, 2 spray; outward heading): foam boils up from nothing, drifts out and sinks back; spray
 *   is thrown up, shrinking away; toon-lit in two bands (sunlit white, a pale-blue shade), the spray paler.
 */

/** the shelf's share of each terrace (the flat run before the drop): runtime/looks/cascade.ts builds the rows on it */
export const CASCADE_SHELF = 0.28;
/** the look.materials ids the cascade's three meshes wear */
export const CASCADE_LOOKS = { curtain: 'driftwood-cascade-curtain', pool: 'driftwood-cascade-pool', puffs: 'driftwood-cascade-puffs' } as const;

/** One graph's node table and its builders (ids `w0`, `w1`, …). */
function kit(): {
  nodes: Record<string, GraphNode>; op: (name: string, inputs?: readonly GraphRef[], extra?: Omit<GraphNode, 'op' | 'in'>) => string;
  add: (a: GraphRef, b: GraphRef) => string; sub: (a: GraphRef, b: GraphRef) => string; mul: (a: GraphRef, b: GraphRef) => string; div: (a: GraphRef, b: GraphRef) => string;
  mix: (a: GraphRef, b: GraphRef, t: GraphRef) => string; swz: (a: GraphRef, mask: string) => string; one: (a: GraphRef) => string;
  edge: (e: GraphRef, x: GraphRef) => string; hash: (n: GraphRef) => string; lit: (c: GraphRef) => string;
} {
  const nodes: Record<string, GraphNode> = {};
  let next = 0;
  const op = (name: string, inputs?: readonly GraphRef[], extra?: Omit<GraphNode, 'op' | 'in'>): string => {
    const id = `w${String(next++)}`; nodes[id] = { op: name, ...(inputs === undefined ? {} : { in: inputs }), ...extra }; return id;
  };
  const add = (a: GraphRef, b: GraphRef): string => op('add', [a, b]), sub = (a: GraphRef, b: GraphRef): string => op('sub', [a, b]);
  const mul = (a: GraphRef, b: GraphRef): string => op('mul', [a, b]), div = (a: GraphRef, b: GraphRef): string => op('div', [a, b]);
  const swz = (a: GraphRef, mask: string): string => op('swizzle', [a], { mask });
  return { nodes, op, add, sub, mul, div, swz, mix: (a, b, t) => op('mix', [a, b, t]), one: (a) => op('oneMinus', [a]),
    // a hard edge, one screen pixel of anti-aliasing
    edge: (e, x) => { const w = mul(op('fwidth', [x]), 0.75); return op('smoothstep', [sub(e, w), add(e, w), x]); },
    // the programs' sine hash
    hash: (n) => op('fract', [mul(op('sin', [mul(n, 127.1)]), 43758.5453)]),
    // lit by the day's sun as the fog holds it
    lit: (c) => mul(c, add(0.35, mul(op('atmosphereSunColour'), 0.75))) };
}

const EFFECT = { blend: 'alpha', depthWrite: false } as const;

/** The curtain: `uv` across and down the cascade, `aStep` (fraction down a terrace, terrace), the faceted normal. */
function curtainGraph(): GraphIr {
  const k = kit(), { op, add, sub, mul, mix, swz, one, edge } = k;
  const uv = op('uv'), u = swz(uv, 'x'), v = swz(uv, 'y'), step = op('attribute', undefined, { name: 'aStep', type: 'vec2' });
  const f = swz(step, 'x'), terrace = swz(step, 'y'), t = op('time');
  const lit = op('abs', [op('dot', [op('normalWorld'), op('atmosphereSunDirection')])]);
  const facet = op('select', [op('gt', [lit, 0.55]), 1, op('select', [op('gt', [lit, 0.25]), 0.86, 0.74])]); // three toon bands across the pleats
  const d = op('clamp', [k.div(sub(f, CASCADE_SHELF), 1 - CASCADE_SHELF), 0, 1]); // how far down this terrace's drop
  // the body: glassy cyan where it pours, deeper teal down the drop, in hard bands
  let col = mix([0.5, 0.88, 0.94], [0.24, 0.72, 0.84], edge(0.22, d));
  col = mix(col, [0.15, 0.56, 0.72], edge(0.62, d));
  // streaks: a few lanes of bright dashes scrolling down, longer and more of them toward the foot of each drop
  const x = mul(u, 7), h = k.hash(add(op('floor', [x]), mul(terrace, 13)));
  const inLane = one(edge(add(0.09, mul(0.08, h)), op('abs', [sub(sub(op('fract', [x]), 0.5), mul(sub(h, 0.5), 0.3))])));
  const p = op('fract', [add(sub(mul(v, 6), mul(t, add(1.1, mul(0.5, h)))), mul(h, 7))]);
  const dash = one(edge(add(0.22, mul(0.3, d)), p));
  const streak = mul(mul(inLane, dash), op('step', [0.3, add(h, mul(d, 0.4))]));
  col = mix(col, [0.93, 0.99, 1], streak);
  // the brink: a crisp white roll where the shelf tips over, a pale band just below it
  const brink = one(edge(0.035, op('abs', [sub(f, CASCADE_SHELF + 0.01)])));
  col = mix(col, [0.8, 0.97, 1], mul(one(edge(0.1, op('abs', [sub(f, CASCADE_SHELF + 0.08)]))), 0.5));
  col = mix(col, [1, 1, 1], brink);
  // where a drop lands on the next shelf: scalloped foam, bobbing
  const scallop = add(add(0.16, mul(0.05, op('sin', [add(add(mul(u, 40), mul(terrace, 2)), mul(t, 5))]))), mul(0.03, op('sin', [sub(mul(u, 17), mul(t, 3))])));
  const landing = mul(op('step', [0.5, terrace]), one(edge(scallop, f)));
  col = mix(col, [0.97, 1, 1], landing);
  // the last metre of the last drop churns white into the pool
  col = mix(col, [0.95, 1, 1], edge(add(0.955, mul(0.02, op('sin', [add(mul(u, 30), mul(t, 6))]))), v));
  // the sides: a hard cut with a thin white rim
  const e = mul(op('abs', [sub(u, 0.5)]), 2);
  col = mix(col, [0.9, 0.98, 1], edge(0.88, e));
  const alpha = mul(one(edge(0.985, e)), mix(0.95, 1, op('max', [streak, op('max', [brink, landing])])));
  return { version: 1, kind: 'material', model: 'unlit', doubleSided: true, effectState: EFFECT, nodes: k.nodes,
    stages: { surface: { colour: k.lit(mul(col, facet)), alpha } } };
}

/** The pool's foam rings on its disc (`uv` 0 … 1 across, the centre at 0.5; the disc lies flat, its v toward −z). */
function poolGraph(): GraphIr {
  const k = kit(), { op, add, sub, mul, mix, swz, one, edge } = k;
  const uv = op('uv'), lx = sub(mul(swz(uv, 'x'), 2), 1), ly = sub(1, mul(swz(uv, 'y'), 2)), t = op('time');
  const seg = (2 * Math.PI) / 9, ang = op('atan', [ly, lx]), r = op('length', [op('combine', [lx, ly])]);
  const rp = mul(r, op('cos', [sub(op('mod', [add(ang, 0.3), seg]), seg * 0.5)])); // the distance to a 9-sided polygon: faceted rings
  const side = op('floor', [k.div(add(ang, Math.PI), seg)]);
  // the churn at the core: a white disc with a scalloped rim
  const core = one(edge(add(0.3, mul(0.05, op('sin', [add(mul(ang, 7), mul(t, 4))]))), rp));
  // three rings spreading out, thinning as they go, each broken into dashes on a few of the polygon's sides
  let ring: GraphRef = 0, pale: GraphRef = 0;
  for (let i = 0; i < 3; i++) {
    const clock = add(mul(t, 0.42), i / 3), ph = op('fract', [clock]);
    const rad = mix(0.3, 0.95, ph), th = mix(0.055, 0.012, ph);
    const on = op('step', [0.28, k.hash(add(add(side, i * 11), mul(op('floor', [clock]), 3)))]);
    const band = mul(one(edge(th, op('abs', [sub(rp, rad)]))), on);
    ring = op('max', [ring, mul(band, op('step', [ph, 0.6]))]);
    pale = op('max', [pale, mul(band, op('step', [0.6, ph]))]);
  }
  const foam = op('max', [core, ring]);
  const alpha = mul(op('max', [foam, mul(pale, 0.75)]), one(edge(0.98, rp)));
  return { version: 1, kind: 'material', model: 'unlit', doubleSided: true, effectState: EFFECT, nodes: k.nodes,
    stages: { surface: { colour: k.lit(mix([0.75, 0.93, 0.98], [0.97, 1, 1], foam)), alpha } } };
}

/** The foam puffs, posed in the vertex stage (world metres: the mesh stands at the origin). */
function puffsGraph(): GraphIr {
  const k = kit(), { op, add, mul, mix, swz, one } = k;
  const centre = op('attribute', undefined, { name: 'aCentre', type: 'vec3' }), info = op('attribute', undefined, { name: 'aInfo', type: 'vec4' });
  const r = swz(info, 'x'), seed = swz(info, 'y'), kind = swz(info, 'z'), ox = op('cos', [swz(info, 'w')]), oz = op('sin', [swz(info, 'w')]), t = op('time');
  const spray = op('gt', [kind, 1.5]), landing = op('gt', [kind, 0.5]);
  // spray: a chunk thrown up off the churn, shrinking away as it rises and drifts out, then again at the foot
  const lifeS = op('fract', [add(mul(t, 0.35), seed)]);
  const atS = add(centre, op('combine', [mul(mul(ox, lifeS), 0.8), mul(op('sin', [mul(lifeS, 2.2)]), 1.2), mul(mul(oz, lifeS), 0.8)]));
  const sizeS = mul(r, one(lifeS));
  // foam: each ball boils up from nothing, drifts a little outward and sinks back
  const lifeF = op('fract', [add(mul(t, op('select', [landing, 0.9, 0.62])), seed)]), swell = op('sin', [mul(lifeF, Math.PI)]);
  const drift = mul(lifeF, op('select', [landing, 0.25, 0.55]));
  const atF = add(centre, op('combine', [mul(ox, drift), mul(mul(0.12, swell), r), mul(oz, drift)]));
  const sizeF = mul(r, add(0.12, mul(0.95, swell)));
  const position = add(op('select', [spray, atS, atF]), mul(op('positionGeometry'), op('select', [spray, sizeS, sizeF])));
  const mist = op('varying', [op('select', [spray, 1, 0])]), alpha = op('varying', [op('select', [spray, 0.9, 1])]);
  // two toon bands: sunlit white, a pale-blue shade; the spray is paler
  const ndl = op('dot', [op('normalWorld'), op('atmosphereSunDirection')]);
  const col = mix(op('select', [op('gt', [ndl, 0.15]), [0.98, 1, 1], [0.64, 0.84, 0.93]]), [1, 1, 1], mul(mist, 0.7));
  return { version: 1, kind: 'material', model: 'unlit', effectState: EFFECT, nodes: k.nodes,
    stages: { 'vertex.position': { position }, surface: { colour: k.lit(col), alpha } } };
}

/** The cascade's three graphs by look.materials id. */
export const CASCADE_GRAPHS: Readonly<Record<string, GraphIr>> = {
  [CASCADE_LOOKS.curtain]: curtainGraph(), [CASCADE_LOOKS.pool]: poolGraph(), [CASCADE_LOOKS.puffs]: puffsGraph(),
};
