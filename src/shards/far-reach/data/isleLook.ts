import skyMapSources from './skyMapSources.json' with { type: 'json' };
import { SKY_PAINTER_GRAPH } from './skyLook';
import { ISLE_CUT, ISLE_KEEL_CUT } from './skyIsles';

/**
 * The islands' paint (E392; SHARD-PLATFORM W1 C2: an SF59 material graph, the shardfile's `look.materials['isle-paint']`,
 * worn by the islands, the islets and the knolls): green faces get the painted meadow (the library's `meadow` map, two
 * scales so no repeat reads from above), sunlit swells, tufts and far daisies; the rest the painted cliff rock (`rock`),
 * triplanar in world space, toned grey-green with moss on every ledge that faces up. Faceted, matte, in the painted light.
 * The old program's value noise is the graph's gradient noise (`soft`): the same scales, a near-identical field.
 */

type GraphInput = string | number | readonly number[];
interface GraphNodeRow { readonly op: string; readonly in?: readonly GraphInput[]; readonly mask?: string; readonly param?: string }
/** A graph builder: each `op` adds one node (prefixed `prefix`) and returns its id. */
function graphNodes(prefix: string): { nodes: Record<string, GraphNodeRow>; op: (name: string, inputs?: readonly GraphInput[], extra?: { mask?: string; param?: string }) => string } {
  const nodes: Record<string, GraphNodeRow> = {};
  let next = 0;
  return { nodes, op: (name, inputs, extra) => {
    const id = `${prefix}${String(next++)}`;
    nodes[id] = { op: name, ...(inputs === undefined ? {} : { in: inputs }), ...extra };
    return id;
  } };
}

/** The library maps the island looks sample (data/skyMapSources.json: the KTX2 file each tiling map was admitted as). */
export const ISLE_MAPS = { rock: skyMapSources.rock.asset, meadow: skyMapSources.meadow.asset } as const;

const { nodes, op } = graphNodes('i');
const add = (a: GraphInput, b: GraphInput): string => op('add', [a, b]), mul = (a: GraphInput, b: GraphInput): string => op('mul', [a, b]);
const mix = (a: GraphInput, b: GraphInput, t: GraphInput): string => op('mix', [a, b, t]), swz = (a: string, mask: string): string => op('swizzle', [a], { mask });
const smooth = (e0: GraphInput, e1: GraphInput, x: GraphInput): string => op('smoothstep', [e0, e1, x]);
const lum = (c: string): string => op('dot', [c, [0.3, 0.59, 0.11]]);
const soft = (p: string): string => add(mul(op('noise', [p]), 0.6), 0.5);
const tex = (map: 'rock' | 'meadow', at: string): string => swz(op('texture', [at], { param: map }), 'xyz');

const col = op('vertexColour'), wp = op('positionWorld'), q = swz(wp, 'xz');
const cr = swz(col, 'x'), cg = swz(col, 'y'), cb = swz(col, 'z');
// 1 on the green faces (a float, so both sides run and every texture tap stays in uniform control flow)
const green = mul(op('step', [mul(cr, 1.05), cg]), op('step', [mul(cb, 1.3), cg]));
// the meadow: two scales of the painted meadow (3 m and 11 m tiles), sunlit swells and shaded hollows, dark tuft shadows,
// the ground between the blades the shade down in the sward (E399), one shade at every distance (round 13)
const mt = add(mul(tex('meadow', mul(q, 0.33)), 0.6), mul(tex('meadow', add(mul(q, 0.09), 0.37)), 0.4));
const swell = add(mul(soft(mul(q, 0.12)), 0.7), mul(soft(mul(q, 0.4)), 0.3)), tuft = soft(mul(q, 3.1));
const sward = mul(mul(mul(mt, add(0.5, mul(swell, 0.45))), add(0.85, mul(tuft, 0.2))), [0.5, 0.58, 0.4]);
const lawn = mul(mix(mul(col, 1.05), sward, 0.9), 0.86);
// painted daisies for the far view only (near the camera the meadow draws real flowers)
const cells = mul(q, 2.2), pick = op('fract', [mul(op('sin', [op('dot', [op('floor', [cells]), [127.1, 311.7]])]), 43758.5453)]);
const disc = op('oneMinus', [smooth(0.12, 0.3, op('length', [op('sub', [op('fract', [cells]), 0.5])]))]);
const farDots = smooth(14, 26, op('length', [op('sub', [wp, op('cameraPosition')])]));
const daisy = op('select', [op('gt', [pick, 0.975]), [0.95, 0.78, 0.25], [0.95, 0.94, 0.9]]);
const meadow = mix(lawn, daisy, mul(mul(mul(disc, 0.85), farDots), op('step', [0.93, pick])));
// the rock: toward a cool grey-brown, then the triplanar mossy rock over it (rockMix 0.85), grey-green, moss on the ledges
const grey = mix(col, mul(lum(col), [1, 0.96, 0.93]), 0.45);
const n = op('normalWorld'), w0 = op('pow', [op('abs', [n]), 4]), tw = op('div', [w0, op('dot', [w0, [1, 1, 1]])]);
const wq = mul(wp, 0.13);
const rockTex = add(add(mul(tex('rock', swz(wq, 'zy')), swz(tw, 'x')), mul(tex('rock', swz(wq, 'xz')), swz(tw, 'y'))), mul(tex('rock', swz(wq, 'xy')), swz(tw, 'z')));
const r1 = mix(grey, mul(rockTex, add(0.55, mul(lum(grey), 1.3))), 0.85), rl = lum(r1);
const r2 = mix(r1, mul(rl, [0.98, 1, 0.97]), 0.55);
const rock = mix(r2, mul([0.33, 0.42, 0.2], add(0.7, mul(rl, 0.6))), mul(smooth(0.2, 0.65, swz(n, 'y')), 0.65));
const paint = mix(rock, meadow, green);

/** The islands' paint; `cut`: a playable island's code keel ends `cut` metres under its top (E399 round 3, item 2: the
 *  textured keel model below is the rock you see), its fragments below that discarded (the island stands at its top). */
const islePaint = (cut?: number): Readonly<Record<string, unknown>> => {
  const keel = cut === undefined ? {} : { kY: { op: 'swizzle', in: ['kP'], mask: 'y' }, kP: { op: 'positionLocal' }, kCut: { op: 'lt', in: ['kY', -cut] } };
  return { version: 1, kind: 'material', model: 'standard', flatShading: true,
    params: { rock: { type: 'texture', value: ISLE_MAPS.rock }, meadow: { type: 'texture', value: ISLE_MAPS.meadow } },
    nodes: { ...SKY_PAINTER_GRAPH.nodes, ...nodes, ...keel },
    stages: { surface: { colour: paint, roughness: 0.95, metalness: 0, ...(cut === undefined ? {} : { discard: 'kCut' }) }, lighting: SKY_PAINTER_GRAPH.lighting } };
};
/** The islands' looks: whole (`isle-paint`: the gate isles, the islets, the knolls), cut over the keel models (`isle-paint-cut`,
 *  1.4 m: data/skyIsles.ts ISLE_CUT) and the windmill's (`isle-paint-cut-mill`, 0.8 m: its ISLE_KEEL_CUT). */
export const ISLE_GRAPHS = { 'isle-paint': islePaint(), 'isle-paint-cut': islePaint(ISLE_CUT), 'isle-paint-cut-mill': islePaint(ISLE_KEEL_CUT['windmill']?.cut ?? ISLE_CUT) } as const;

/** How many values each playable island takes from the level's cosmetic stream (the old 12-gon island's 122; the last seeds
 *  its baked shape, generators/isles.ts), so every piece built after the islands keeps its draws. */
export const ISLE_DRAWS = 122;
