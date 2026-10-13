import { MATRIARCH_PRESENTATION } from './matriarchPresentation';

/**
 * The Matriarch's sand storm shells (SF27, first Signal Dunes' review R5 / TOP-15 #11; SHARD-PLATFORM G397: SF59 material
 * graphs, the shardfile's `look.materials.storm-far` / `storm-near`): a sphere round the player, seen from inside, whose
 * graph draws long streaks racing downwind (the dune field's wind), denser near the horizon and the ground, pulsing in
 * gusts, over a dusty veil. The near shell (`fine`) streaks faster and thinner. Its alpha is the storm's strength (the
 * host field `shared.storm`, which the runtime hands its look) × the shell's share (the presentation row's `shells`).
 * Unlit, alpha-blended, unfogged, depth-tested without writing depth (what stands nearer, a boss diving at you, draws in
 * front; round 1, R1B-17). Local frame: the unit direction from the shell's centre (`positionGeometry`, normalised).
 */

type GraphInput = string | number | readonly number[];
interface GraphNodeRow { readonly op: string; readonly in?: readonly GraphInput[]; readonly mask?: string; readonly param?: string }

const { storm } = MATRIARCH_PRESENTATION;
const windLength = Math.hypot(storm.wind.x, storm.wind.z), wind = [storm.wind.x / windLength, storm.wind.z / windLength] as const;
/** the storm's colour, linear (three's sRGB hex decode) */
const linear = (c: number): number => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const colour = [(storm.color >> 16) & 255, (storm.color >> 8) & 255, storm.color & 255].map((c) => linear(c / 255));

function stormGraph(fine: boolean, share: number): object {
  const nodes: Record<string, GraphNodeRow> = {};
  let next = 0;
  const op = (name: string, inputs?: readonly GraphInput[], mask?: string): string => {
    const id = `s${String(next++)}`;
    nodes[id] = { op: name, ...(inputs === undefined ? {} : { in: inputs }), ...(mask === undefined ? {} : { mask }) };
    return id;
  };
  const add = (a: GraphInput, b: GraphInput): string => op('add', [a, b]), sub = (a: GraphInput, b: GraphInput): string => op('sub', [a, b]);
  const mul = (a: GraphInput, b: GraphInput): string => op('mul', [a, b]), mix = (a: GraphInput, b: GraphInput, t: GraphInput): string => op('mix', [a, b, t]);
  const smooth = (e0: GraphInput, e1: GraphInput, x: GraphInput): string => op('smoothstep', [e0, e1, x]);
  const swz = (a: string, mask: string): string => op('swizzle', [a], mask), vec2 = (a: GraphInput, b: GraphInput): string => op('combine', [a, b]);
  const hash = (p: string): string => op('fract', [mul(op('sin', [op('dot', [p, [127.1, 311.7]])]), 43758.5453)]);
  /** the old program's value noise (sine hash, smoothstep blend) */
  const valueNoise = (p: string): string => {
    const i = op('floor', [p]), f = op('fract', [p]), u = mul(mul(f, f), sub(3, mul(f, 2))), ux = swz(u, 'x'), uy = swz(u, 'y');
    return mix(mix(hash(i), hash(add(i, [1, 0])), ux), mix(hash(add(i, [0, 1])), hash(add(i, [1, 1])), ux), uy);
  };
  const d = op('normalize', [op('varying', [op('positionGeometry')])]), dx = swz(d, 'x'), dz = swz(d, 'z'), el = swz(d, 'y'), time = op('time');
  // the azimuth from downwind: the streaks run along it and race that way (on a circle round the horizon: no seam at the wrap)
  const az = op('atan', [sub(mul(dx, wind[1]), mul(dz, wind[0])), add(mul(dx, wind[0]), mul(dz, wind[1]))]);
  const speed = fine ? 2.4 : 1.1, rows = fine ? 260 : 120, len = fine ? 7 : 4;
  const a1 = sub(az, mul(time, speed / len)), a2 = sub(az, mul(time, (speed * 1.7) / (len * 2.3)));
  const s1 = valueNoise(vec2(add(mul(op('cos', [a1]), len), mul(el, rows)), mul(op('sin', [a1]), len)));
  const s2 = valueNoise(vec2(add(mul(op('cos', [a2]), len * 2.3), add(mul(el, rows * 1.9), 3.1)), mul(op('sin', [a2]), len * 2.3)));
  const streak = smooth(0.55, 0.95, add(mul(s1, 0.6), mul(s2, 0.4)));
  const gust = add(0.7, mul(mul(op('sin', [mul(time, 1.3)]), op('sin', [add(mul(time, 0.37), 1)])), 0.3));
  const low = op('oneMinus', [smooth(-0.1, 0.55, el)]);
  // the dusty veil: the graph's gradient noise remapped to 0 … 1 (the old value noise's slow layer; not the same field)
  const a3 = sub(az, mul(time, 0.2));
  const veil = add(0.55, mul(add(mul(op('noise', [vec2(add(mul(op('cos', [a3]), 1.5), mul(el, 4)), mul(op('sin', [a3]), 1.5))]), 0.5), 0.5), 0.45));
  const body = add(mul(veil, add(0.45, mul(low, 0.55))), mul(mul(streak, 0.7), add(0.35, mul(low, 0.65))));
  nodes['strength'] = { op: 'param', param: 'storm' };
  const alpha = op('clamp', [mul(mul(mul('strength', share), gust), body), 0, 0.95]);
  // the old program wrote its linear colour straight to the display: the graph's output is converted, so it is decoded first
  const lit = op('pow', [mul(colour, add(0.85, mul(streak, 0.5))), 2.2]);
  return { version: 1, kind: 'material', model: 'unlit', doubleSided: true, effectState: { blend: 'alpha', fog: false, depthWrite: false },
    params: { storm: { type: 'float', value: 0, min: 0, max: 1, bind: { state: 'shared.storm' } } }, nodes, stages: { surface: { colour: lit, alpha } } };
}

const [farShare, nearShare] = storm.shells.map(([, share]) => share);
if (farShare === undefined || nearShare === undefined) throw new Error('Signal Dunes: the storm declares two shells (far, near)');
/** The host field the storm's strength rides (`shared.storm`, 0 … 1; the runtime hands it to its look). */
export const STORM_FIELD = { id: 2, name: 'storm', type: 'f64', privacy: 'host', default: 0, min: 0, max: 1 } as const;
/** The two shells' material graphs by look.materials id, outer (coarse) first, as the presentation row's `shells`. */
export const STORM_GRAPHS = { 'storm-far': stormGraph(false, farShare), 'storm-near': stormGraph(true, nearShare) } as const;
