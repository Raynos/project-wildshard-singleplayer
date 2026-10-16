// SHARD-PLATFORM W2c (build-time look graphs): data/poolLook.ts's SF59 material graphs, built only at build time and emitted
// as JSON (generators/lookMaterials.ts → data/lookMaterials.generated.json, the shardfile's `look.materials`); play code
// reads the ids and rows in data/poolLook.ts, never these builders.
import type { GraphIr, GraphNode, GraphRef } from '@wildshard/format/materialGraph';
import { POOL_LOOK, SHRINE_POOL_LOOK } from '../data/poolLook';

/** #0a2540 and #2aa7b0 as linear RGB */
const DEEP = [0.003035, 0.018500, 0.051269] as const, TEAL = [0.023153, 0.386429, 0.434154] as const;

interface Ops {
  readonly op: (name: string, inputs?: readonly GraphRef[], extra?: Omit<GraphNode, 'op' | 'in'>) => string;
  readonly add: (a: GraphRef, b: GraphRef) => string; readonly mul: (a: GraphRef, b: GraphRef) => string;
  readonly sin: (a: GraphRef) => string; readonly swz: (a: GraphRef, mask: string) => string;
}

/** a flat-shaded, alpha-blended toon water graph whose colour `body` builds from the world position and the frame clock */
function waterGraph(alpha: number, roughness: number, body: (o: Ops, wp: string, t: string) => string): GraphIr {
  const nodes: Record<string, GraphNode> = {};
  let next = 0;
  const op: Ops['op'] = (name, inputs, extra) => {
    const id = `p${String(next++)}`; nodes[id] = { op: name, ...(inputs === undefined ? {} : { in: inputs }), ...extra }; return id;
  };
  const o: Ops = { op, add: (a, b) => op('add', [a, b]), mul: (a, b) => op('mul', [a, b]), sin: (a) => op('sin', [a]), swz: (a, mask) => op('swizzle', [a], { mask }) };
  const colour = body(o, op('positionWorld'), op('time'));
  return { version: 1, kind: 'material', model: 'toon', flatShading: true, effectState: { blend: 'alpha' }, nodes,
    stages: { surface: { colour, alpha, roughness, metalness: 0 } } };
}

/** The pools' graphs by look.materials id. */
export const POOL_GRAPHS: Readonly<Record<string, GraphIr>> = {
  // r = |fract(xz · 0.11) − 0.5| · 9; w = ½ + ½ sin(6r − 2.2t) sin(3.1x + t); tint = smoothstep(0.75, 1, w) · 0.4 + sin(5z + 1.7t) · 0.06
  [POOL_LOOK]: waterGraph(0.9, 0.4, ({ op, add, mul, sin, swz }, wp, t) => {
    const r = mul(op('length', [op('sub', [op('fract', [mul(swz(wp, 'xz'), 0.11)]), 0.5])]), 9);
    const w = add(0.5, mul(mul(sin(op('sub', [mul(r, 6), mul(t, 2.2)])), sin(add(mul(swz(wp, 'x'), 3.1), t))), 0.5));
    const tint = add(mul(op('smoothstep', [0.75, 1, w]), 0.4), mul(sin(add(mul(swz(wp, 'z'), 5), mul(t, 1.7))), 0.06));
    return op('mix', [[...DEEP], [0.12, 0.4, 0.5], tint]);
  }),
  // w = sin(2.3x + 1.1t) sin(2.9z − 0.9t) + sin(4.1(x + z) + 1.7t) · ½; shimmer = smoothstep(0.9, 1.4, w) · 0.45
  [SHRINE_POOL_LOOK]: waterGraph(0.82, 0.25, ({ op, add, mul, sin, swz }, wp, t) => {
    const x = swz(wp, 'x'), z = swz(wp, 'z');
    const w = add(mul(sin(add(mul(x, 2.3), mul(t, 1.1))), sin(op('sub', [mul(z, 2.9), mul(t, 0.9)]))), mul(sin(add(mul(add(x, z), 4.1), mul(t, 1.7))), 0.5));
    return op('mix', [[...TEAL], [0.55, 0.95, 0.95], mul(op('smoothstep', [0.9, 1.4, w]), 0.45)]);
  }),
};
