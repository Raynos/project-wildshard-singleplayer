/**
 * The falls (council round 2; SHARD-PLATFORM G382: an SF59 material graph, the shardfile's `look.materials.falls`):
 * falling water, not a white card: streaks of foam scrolling down, soft thin edges, a blue-white body that frays into spray
 * toward the bottom. Local frame (the baked sheet, generators/geometries.ts `fall`): x −0.5..0.5 across the sheet, y 0 at
 * the lip down to −1 (each instance scales it to its width and length). Unlit, alpha-blended, unfogged, no depth write.
 */

type GraphInput = string | number | readonly number[];
interface GraphNodeRow { readonly op: string; readonly in?: readonly GraphInput[]; readonly mask?: string }
const nodes: Record<string, GraphNodeRow> = {};
let next = 0;
const op = (name: string, inputs?: readonly GraphInput[], mask?: string): string => {
  const id = `f${String(next++)}`;
  nodes[id] = { op: name, ...(inputs === undefined ? {} : { in: inputs }), ...(mask === undefined ? {} : { mask }) };
  return id;
};
const add = (a: GraphInput, b: GraphInput): string => op('add', [a, b]), sub = (a: GraphInput, b: GraphInput): string => op('sub', [a, b]);
const mul = (a: GraphInput, b: GraphInput): string => op('mul', [a, b]), mix = (a: GraphInput, b: GraphInput, t: GraphInput): string => op('mix', [a, b, t]);
const smooth = (e0: GraphInput, e1: GraphInput, x: GraphInput): string => op('smoothstep', [e0, e1, x]);
const oneMinus = (a: GraphInput): string => op('oneMinus', [a]), vec2 = (a: GraphInput, b: GraphInput): string => op('combine', [a, b]);
const hash = (p: string): string => op('fract', [mul(op('sin', [op('dot', [p, [127.1, 311.7]])]), 43758.5453)]);
/** the old program's value noise (sine hash, smoothstep blend) */
const valueNoise = (p: string): string => {
  const i = op('floor', [p]), f = op('fract', [p]), u = mul(mul(f, f), sub(3, mul(f, 2))), ux = op('swizzle', [u], 'x'), uy = op('swizzle', [u], 'y');
  return mix(mix(hash(i), hash(add(i, [1, 0])), ux), mix(hash(add(i, [0, 1])), hash(add(i, [1, 1])), ux), uy);
};
/** the graph's gradient noise remapped to 0 … 1 (the softer layers; not the same field as `valueNoise`) */
const soft = (p: string): string => add(mul(op('noise', [p]), 0.5), 0.5);

const at = op('varying', [op('positionGeometry')]), time = op('time');
const down = op('negate', [op('swizzle', [at], 'y')]), across = op('swizzle', [at], 'x'), wide = op('abs', [across]);
// streaks: narrow columns of foam, each scrolling down at its own pace
const streak = add(mul(valueNoise(vec2(mul(across, 26), sub(mul(down, 3), mul(time, 1.6)))), 0.6), mul(soft(vec2(mul(across, 60), sub(mul(down, 7), mul(time, 2.6)))), 0.4));
// E399 (the council: 'a flat pale blue strip'): narrow at the lip, spreading as it falls; a deep blue-teal body with bright
// foam ropes, gaps between them, breaking into mist toward the bottom
const spread = add(0.2, mul(down, 0.18));
const edge = oneMinus(smooth(mul(spread, 0.7), spread, add(wide, mul(sub(soft(vec2(mul(down, 4), mul(time, 0.3))), 0.5), 0.1))));
const fray = oneMinus(mul(smooth(0.5, 1, down), add(0.35, mul(0.65, soft(vec2(mul(across, 9), sub(mul(down, 5), time)))))));
const ropes = smooth(0.42, 0.78, streak);
const body = mul(mul(edge, fray), add(0.18, mul(0.8, ropes)));
// the plunge's mist: a soft white bloom over the last third
const mist = mul(mul(smooth(0.62, 1, down), oneMinus(smooth(0.25, 0.5, wide))), add(0.5, mul(0.5, soft(vec2(mul(across, 4), sub(mul(down, 2), mul(time, 0.4)))))));
const colour = mix(mix([0.3, 0.5, 0.58], [1, 0.98, 0.94], ropes), [1, 0.97, 0.92], mul(mist, 0.7));
// the lip's mist
const alpha = mul(op('max', [op('max', [body, mul(mist, 0.55)]), mul(mul(edge, oneMinus(smooth(0, 0.05, down))), 0.7)]), 0.85);
// the old program wrote its colours straight to the display (no colour space conversion): the graph's are linear
const linear = op('pow', [colour, 2.2]);

/** The falls' material graph (`look.materials.falls`). */
export const FALL_GRAPH = { version: 1, kind: 'material', model: 'unlit', doubleSided: true, effectState: { blend: 'alpha', fog: false, depthWrite: false },
  nodes, stages: { surface: { colour: linear, alpha } } } as const;
