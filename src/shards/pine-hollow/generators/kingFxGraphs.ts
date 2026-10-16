// Pine Hollow's kingFx look graphs, built at build time (SHARD-PLATFORM W2c): emitted into
// data/lookMaterials.generated.json by ./lookMaterials.ts; the ids and rows the play code reads stay in ../data/kingFxLook.ts.
import type { GraphIr, GraphNode, GraphRef } from '@wildshard/format/materialGraph';
import { KING_FX_LOOKS } from '../data/kingFxLook';

/** One graph's node table, its builders and the old shaders' value noise (ids `<prefix>0`, `<prefix>1`, …). */
function kit(prefix: string) {
  const nodes: Record<string, GraphNode> = {};
  let next = 0;
  const op = (name: string, inputs?: readonly GraphRef[], extra?: Omit<GraphNode, 'op' | 'in'>): string => {
    const id = `${prefix}${String(next++)}`; nodes[id] = { op: name, ...(inputs === undefined ? {} : { in: inputs }), ...extra }; return id;
  };
  const add = (a: GraphRef, b: GraphRef): string => op('add', [a, b]), sub = (a: GraphRef, b: GraphRef): string => op('sub', [a, b]);
  const mul = (a: GraphRef, b: GraphRef): string => op('mul', [a, b]), mix = (a: GraphRef, b: GraphRef, t: GraphRef): string => op('mix', [a, b, t]);
  const smooth = (e0: GraphRef, e1: GraphRef, x: GraphRef): string => op('smoothstep', [e0, e1, x]);
  const swz = (a: GraphRef, mask: string): string => op('swizzle', [a], { mask });
  const vec2 = (x: GraphRef, y: GraphRef): string => op('combine', [x, y]);
  /** fract(sin(dot(p, (127.1, 311.7))) × 43758.5453), the old programs' hash */
  const hash = (p: string): string => op('fract', [mul(op('sin', [op('dot', [p, [127.1, 311.7]])]), 43758.5453)]);
  /** the old programs' value noise (n21: the hash at the cell corners, smoothstep blended) */
  const noise = (p: string): string => {
    const i = op('floor', [p]), f = op('fract', [p]), u = mul(mul(f, f), sub(3, mul(f, 2))), ux = swz(u, 'x'), uy = swz(u, 'y');
    return mix(mix(hash(i), hash(add(i, [1, 0])), ux), mix(hash(add(i, [0, 1])), hash(add(i, [1, 1])), ux), uy);
  };
  const param = (name: string): string => op('param', undefined, { param: name });
  return { nodes, op, add, sub, mul, mix, smooth, swz, vec2, noise, param, time: op('time'), uv: op('uv') };
}

function fogGraph(): GraphIr {
  const k = kit('f'), { op, add, sub, mul, smooth, swz, vec2, noise, time, uv } = k;
  const u = swz(uv, 'x'), v = swz(uv, 'y');
  const p = vec2(add(mul(u, 48), mul(time, 0.35)), sub(mul(v, 4), mul(time, 0.18)));
  const n = add(mul(noise(p), 0.6), mul(noise(add(mul(p, 2.3), 7.1)), 0.4));
  const a = mul(mul(smooth(0, 0.06, v), op('oneMinus', [smooth(0.25, 1, v)])), add(0.55, mul(n, 0.45)));
  return { version: 1, kind: 'material', model: 'unlit', doubleSided: true, effectState: { blend: 'alpha', depthWrite: false, fog: false, singlePass: true },
    params: { colour: { type: 'vec3', value: [0.2, 0.22, 0.26], min: 0, max: 4 }, alpha: { type: 'float', value: 0, min: 0, max: 1 } },
    nodes: k.nodes, stages: { surface: { colour: mul(k.param('colour'), add(0.85, mul(n, 0.3))), alpha: op('clamp', [mul(a, k.param('alpha')), 0, 1]) } } };
}

function flameGraph(): GraphIr {
  const k = kit('l'), { op, add, sub, mul, mix, smooth, swz, vec2, noise, time, uv } = k;
  // the noise reads |x| and each flame's own phase (its origin), so every quad is mirror-symmetric about the axis: the
  // crossed quads' tips meet there and the fire reads as one tongue from any side
  const y = swz(uv, 'x'), x = mul(sub(swz(uv, 'y'), 0.5), 2), ax = op('abs', [x]), origin = op('objectOrigin');
  const phase = op('varying', [add(mul(swz(origin, 'x'), 0.7), mul(swz(origin, 'z'), 0.5))]);
  const fl = noise(vec2(add(mul(ax, 1.5), phase), sub(mul(y, 4), mul(time, 6))));
  const w = mul(op('oneMinus', [y]), add(0.75, mul(fl, 0.25)));
  const a = mul(mul(op('oneMinus', [smooth(mul(w, 0.4), w, ax)]), op('oneMinus', [smooth(0.55, 1, add(y, mul(fl, 0.25)))])), smooth(0, 0.08, y));
  const core = mul(op('oneMinus', [smooth(0, 0.5, y)]), op('oneMinus', [smooth(0, 0.6, ax)]));
  const colour = mix(k.param('colour'), [1.6, 1.3, 0.8], core);
  return { version: 1, kind: 'material', model: 'unlit', doubleSided: true, effectState: { blend: 'additive', depthWrite: false, fog: false, singlePass: true },
    params: { colour: { type: 'vec3', value: [2.6, 1.1, 0.3], min: 0, max: 4 }, alpha: { type: 'float', value: 0, min: 0, max: 1 } },
    nodes: k.nodes, stages: { surface: { colour: mul(colour, op('clamp', [mul(a, k.param('alpha')), 0, 1])), alpha: 1 } } };
}

/** The fight's effect graphs by look.materials id. */
export const KING_FX_GRAPHS: Readonly<Record<string, GraphIr>> = { [KING_FX_LOOKS.fog]: fogGraph(), [KING_FX_LOOKS.flame]: flameGraph() };
