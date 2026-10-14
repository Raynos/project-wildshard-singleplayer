import type { GraphIr, GraphNode, GraphRef } from '@wildshard/format/materialGraph';

/**
 * The Ring Shrine's firefly cloud (world/Shrine.ts) as an SF59 material graph (SHARD-PLATFORM W2 C2; the shardfile's
 * `look.materials`, compiled by the hybrid runtime): unlit, additive, fogged, no depth write. Each firefly is one
 * camera-facing quad posed in the vertex stage from its `aFly` (start angle, orbit radius, height over the base, phase) on
 * the frame clock, the way the CPU cloud stepped it: it circles the platform at its own pace, its radius breathing, bobbing
 * and wobbling. The whole cloud flickers together; `dusk` (0 = broad day … 1 = night, the day clock's `shrine.dusk` writer)
 * brightens and grows it. The sprite is the soft dot the stock points program drew (a white radial gradient), a point's
 * world size: its pixel size `size × (height / 2) / depth` is `size × tan(fov / 2)` metres on the game camera's 72° fov.
 */

/** the look.materials id the shrine's fireflies wear */
export const FIREFLY_LOOK = 'driftwood-shrine-fireflies';
/** how many fireflies circle the shrine, and the dusk level before the clock first writes it */
export const FIREFLY_COUNT = 90;
const DUSK = 0.35;
/** a point sprite's world width per unit of its size on the game camera (tan 36°) */
const POINT_WORLD = Math.tan((72 / 2) * (Math.PI / 180));

function fireflyGraph(): GraphIr {
  const nodes: Record<string, GraphNode> = {};
  let next = 0;
  const op = (name: string, inputs?: readonly GraphRef[], extra?: Omit<GraphNode, 'op' | 'in'>): string => {
    const id = `f${String(next++)}`; nodes[id] = { op: name, ...(inputs === undefined ? {} : { in: inputs }), ...extra }; return id;
  };
  const add = (a: GraphRef, b: GraphRef): string => op('add', [a, b]), sub = (a: GraphRef, b: GraphRef): string => op('sub', [a, b]);
  const mul = (a: GraphRef, b: GraphRef): string => op('mul', [a, b]), swz = (a: GraphRef, mask: string): string => op('swizzle', [a], { mask });
  const sin = (a: GraphRef): string => op('sin', [a]);
  const fly = op('attribute', undefined, { name: 'aFly', type: 'vec4' }), t = op('time'), dusk = op('param', undefined, { param: 'dusk' });
  const ph = swz(fly, 'w');
  // the orbit: its own pace round the platform, the radius breathing, a wobble and a bob
  const a = add(swz(fly, 'x'), mul(mul(t, 0.12), add(1, mul(sin(ph), 0.5)))), r = add(swz(fly, 'y'), mul(sin(add(mul(t, 0.7), ph)), 0.6));
  const wob = mul(sin(add(mul(t, 1.9), mul(ph, 3))), 0.35);
  const centre = op('combine', [add(mul(op('cos', [a]), r), wob), add(swz(fly, 'z'), mul(sin(add(mul(t, 1.3), ph)), 0.25)), sub(mul(sin(a), r), mul(wob, 0.6))]);
  // a camera-facing quad the point's world size, bigger toward dusk
  const width = mul(add(0.09, mul(dusk, 0.06)), POINT_WORLD), corner = op('positionGeometry');
  const facing = add(mul(op('viewToWorld', [[1, 0, 0]]), mul(swz(corner, 'x'), width)), mul(op('viewToWorld', [[0, 1, 0]]), mul(swz(corner, 'y'), width)));
  const position = add(centre, op('worldToLocal', [facing]));
  // the cloud's flicker, brighter toward dusk
  const flick = add(0.7, mul(mul(sin(mul(t, 7.3)), sin(mul(t, 3.1))), 0.3));
  const glow = mul(add(0.3, mul(dusk, 0.7)), flick);
  // the soft dot: a radial gradient from 1 to 15 px of 32 (1 at its heart, 0.7 at 35 %, 0 at the rim)
  const k = op('saturate', [mul(sub(mul(op('length', [sub(op('uv'), 0.5)]), 32), 1), 1 / 14)]);
  const dot = op('select', [op('lt', [k, 0.35]), op('mix', [1, 0.7, mul(k, 1 / 0.35)]), op('mix', [0.7, 0, mul(sub(k, 0.35), 1 / 0.65)])]);
  return { version: 1, kind: 'material', model: 'unlit', effectState: { blend: 'additive', depthWrite: false }, nodes,
    params: { dusk: { type: 'float', value: DUSK, min: 0, max: 1 } },
    stages: { 'vertex.position': { position }, surface: { colour: [0.75, 1, 0.55], alpha: mul(glow, dot) } } };
}

/** The fireflies' graph by look.materials id. */
export const FIREFLY_GRAPHS: Readonly<Record<string, GraphIr>> = { [FIREFLY_LOOK]: fireflyGraph() };
