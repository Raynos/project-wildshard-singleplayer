import type { GraphIr, GraphNode, GraphParam, GraphRef } from '@wildshard/format/materialGraph';
import { MIDDAY_SKY_ROWS } from './skyPalette';

/**
 * Driftwood's faceted sky (DRIFTWOOD-REMASTER L2, the user's pick D2) as two SF59 material graphs (SHARD-PLATFORM W2 C2;
 * the shardfile's `look.materials`, compiled through the runtime look catalogue by the sky backdrop on the page renderer, before the
 * world stage, so the dome is drawn and PMREM'd from its first frame): unlit, unfogged, no depth write.
 *
 * - **dome** (`SKY_DOME_LOOK`): a saturated zenith → pale horizon gradient by the view direction's height, the colour
 *   below the horizon, a thin bright band on it, a glow round the sun (dimmed at night) and, at night, stars on a hashed
 *   cell grid (twinkle-free). The backdrop draws it back-faced with no depth test, behind everything.
 * - **cumulus** (`SKY_CLOUD_LOOK`): one icosahedron instanced per puff row (`aPuff` its centre and radius, `aLump` its
 *   lump phases and the cut its base is flattened at; data/cumulusPuffs.json), lumped and squashed in the vertex stage,
 *   turned slowly about the dome's centre on the frame clock (a full turn in ~3 h), faceted by derivative normals, lit in
 *   a two-band sun ramp (lit / shade), darker flat bellies, a silver-lining fresnel on rims facing away from the eye
 *   when the sun is behind them, the lowest puffs melting into the horizon haze.
 *
 * The palette is params (linear RGB, pre-tonemap, as the day clock blends it): the clock writes them every frame through
 * the compiled graphs' checked `setParam`; `night` 0 … 1; `sunDir` the unit direction toward the sun (or the moon).
 */

/** the look.materials id of the dome */
export const SKY_DOME_LOOK = 'driftwood-sky-dome';
/** the look.materials id of the cumulus ring */
export const SKY_CLOUD_LOOK = 'driftwood-sky-cumulus';

/** a graph builder over its own node table */
function kit(prefix: string): { nodes: Record<string, GraphNode>; op: (name: string, inputs?: readonly GraphRef[], extra?: Omit<GraphNode, 'op' | 'in'>) => string } {
  const nodes: Record<string, GraphNode> = {};
  let next = 0;
  return { nodes, op: (name, inputs, extra) => {
    const id = `${prefix}${String(next++)}`; nodes[id] = { op: name, ...(inputs === undefined ? {} : { in: inputs }), ...extra }; return id;
  } };
}

const vec3 = (value: readonly number[]): GraphParam => ({ type: 'vec3', value: [...value] });
// unbounded: a blended unit vector or night level can round a hair past ±1, and a refused write would freeze the sky
const SUN_UP: GraphParam = { type: 'vec3', value: [0, 1, 0] };
const NIGHT: GraphParam = { type: 'float', value: MIDDAY_SKY_ROWS.night };

function domeGraph(): GraphIr {
  const { nodes, op } = kit('d');
  const p = (param: string): string => op('param', undefined, { param });
  const add = (a: GraphRef, b: GraphRef): string => op('add', [a, b]), mul = (a: GraphRef, b: GraphRef): string => op('mul', [a, b]);
  const swz = (a: GraphRef, mask: string): string => op('swizzle', [a], { mask }), smooth = (e0: GraphRef, e1: GraphRef, x: GraphRef): string => op('smoothstep', [e0, e1, x]);
  const zenith = p('zenith'), horizon = p('horizon'), night = p('night');
  const d = op('normalize', [op('positionLocal')]), h = swz(d, 'y');
  let col = op('mix', [horizon, zenith, op('pow', [smooth(0, 0.75, h), 0.62])]);
  col = op('mix', [col, p('below'), smooth(0, -0.08, h)]);
  col = add(col, mul(mul(horizon, 0.18), smooth(0.06, 0, op('abs', [op('sub', [h, 0.01])]))));   // a thin bright band on the horizon
  const s = op('max', [op('dot', [d, p('sunDir')]), 0]);
  const glow = add(mul(op('pow', [s, 8]), 0.35), mul(op('pow', [s, 64]), 0.6));
  col = add(col, mul(mul(p('sunGlow'), glow), op('oneMinus', [mul(night, 0.7)])));
  // stars: a hashed cell grid, twinkle-free (none at all by day, nor below 0.02 of height)
  let q = op('fract', [mul(op('floor', [mul(d, 180)]), 0.1031)]);
  q = add(q, op('dot', [q, add(swz(q, 'zyx'), 31.32)]));
  const hash = op('fract', [mul(add(swz(q, 'x'), swz(q, 'y')), swz(q, 'z'))]);
  const star = mul(op('step', [0.9965, hash]), smooth(0.02, 0.25, h));
  col = add(col, mul([0.9, 0.95, 1.1], mul(mul(star, night), 1.6)));
  return { version: 1, kind: 'material', model: 'unlit', doubleSided: true, nodes,
    params: { zenith: vec3(MIDDAY_SKY_ROWS.zenith), horizon: vec3(MIDDAY_SKY_ROWS.horizon), below: vec3(MIDDAY_SKY_ROWS.below), sunGlow: vec3(MIDDAY_SKY_ROWS.sunGlow), sunDir: SUN_UP, night: NIGHT },
    stages: { surface: { colour: col } }, effectState: { depthWrite: false, fog: false } };
}

function cloudGraph(): GraphIr {
  const { nodes, op } = kit('c');
  const p = (param: string): string => op('param', undefined, { param });
  const add = (a: GraphRef, b: GraphRef): string => op('add', [a, b]), sub = (a: GraphRef, b: GraphRef): string => op('sub', [a, b]);
  const mul = (a: GraphRef, b: GraphRef): string => op('mul', [a, b]), swz = (a: GraphRef, mask: string): string => op('swizzle', [a], { mask });
  const smooth = (e0: GraphRef, e1: GraphRef, x: GraphRef): string => op('smoothstep', [e0, e1, x]);
  // one shared icosahedron per puff row (data/cumulusPuffs.json, instanced): lumpy, squashed, its base cut flat
  const puff = op('attribute', undefined, { name: 'aPuff', type: 'vec4' }), lump = op('attribute', undefined, { name: 'aLump', type: 'vec3' });
  const l = mul(op('positionGeometry'), swz(puff, 'w')), baseY = swz(lump, 'z');
  const kk = add(1, mul(mul(op('sin', [add(mul(swz(l, 'x'), 0.13), swz(lump, 'x'))]), op('cos', [add(mul(swz(l, 'z'), 0.11), swz(lump, 'y'))])), 0.12));
  const d = mul(mul(l, kk), [1.15, 0.8, 1.15]), y = op('max', [add(swz(d, 'y'), swz(puff, 'y')), baseY]);
  const above = op('varying', [sub(y, baseY)]);
  // the slow drift: the whole ring turns about the dome's centre
  const a = mul(op('time'), 0.0006), c = op('cos', [a]), s = op('sin', [a]);
  const turn = (v: string): string => op('combine', [sub(mul(c, swz(v, 'x')), mul(s, swz(v, 'z'))), swz(v, 'y'), add(mul(s, swz(v, 'x')), mul(c, swz(v, 'z')))]);
  const position = turn(op('combine', [add(swz(d, 'x'), swz(puff, 'x')), y, add(swz(d, 'z'), swz(puff, 'z'))]));
  const sunDir = p('sunDir'), cloudShade = p('cloudShade'), sunGlow = p('sunGlow');
  const world = op('positionWorld'), v = op('normalize', [sub(op('cameraPosition'), world)]);
  // faceted: each facet's own normal from the position's screen derivatives, turned toward the eye (front faces only)
  const face = op('normalize', [op('cross', [op('dFdx', [world]), op('dFdy', [world])])]);
  const n = mul(face, sub(mul(op('step', [0, op('dot', [face, v])]), 2), 1));
  const ndl = op('dot', [n, sunDir]);
  const lit = mul(smooth(-0.05, 0.2, ndl), add(0.82, mul(0.18, ndl)));
  let col = op('mix', [cloudShade, p('cloudLit'), lit]);
  const belly = mul(op('step', [swz(n, 'y'), -0.9]), op('step', [above, 2]));   // the flat bases: facing down, on the cut
  col = op('mix', [col, mul(cloudShade, 0.82), mul(belly, 0.55)]);   // darker, flatter bellies
  // silver lining: rims facing away from the eye glow when the sun sits behind the cloud (clamped: a facet square to the
  // eye rounds |N·V| past 1, and one NaN pixel smeared by bloom's mip chain is a flickering black square, E91)
  const fres = op('pow', [op('clamp', [op('oneMinus', [op('abs', [op('dot', [n, v])])]), 0, 1]), 2.5]);
  const behind = op('pow', [op('max', [op('dot', [op('negate', [v]), sunDir]), 0]), 3]);
  col = add(col, mul(mul(sunGlow, fres), add(0.25, mul(1.6, behind))));
  // the lowest puffs melt into the horizon haze
  col = op('mix', [col, p('horizon'), mul(smooth(0.1, 0, op('negate', [swz(v, 'y')])), 0.7)]);
  return { version: 1, kind: 'material', model: 'unlit', nodes,
    params: { cloudLit: vec3(MIDDAY_SKY_ROWS.cloudLit), cloudShade: vec3(MIDDAY_SKY_ROWS.cloudShade), horizon: vec3(MIDDAY_SKY_ROWS.horizon), sunGlow: vec3(MIDDAY_SKY_ROWS.sunGlow), sunDir: SUN_UP },
    stages: { 'vertex.position': { position }, surface: { colour: col } }, effectState: { blend: 'alpha', depthWrite: false, fog: false } };
}

/** The sky's graphs by look.materials id. */
export const SKY_GRAPHS: Readonly<Record<string, GraphIr>> = { [SKY_DOME_LOOK]: domeGraph(), [SKY_CLOUD_LOOK]: cloudGraph() };
