import { ISLE_MAPS } from './isleLook';
import { SKY_PAINTER_GRAPH } from './skyLook';

/**
 * The island dressing's looks: the clumps' and flowers' hand-offs are SF59 material graphs (the shardfile's
 * `look.materials`), the boulders' rock and lichen another (`BOULDER_GRAPH`). The clumps carry the meadow beyond the near field and shrink away inside it
 * (between 15 and 22 m from the camera: world/meadow.ts's blades own the foreground); the flowers grow in past 9-13 m, a
 * little larger far off; the boulders wear the islands' painted rock with cracks, lichen flecks and a moss cap at a
 * boulder's own scale.
 */

/**
 * The vertex shrink a hand-off draws with: the instance's origin from the camera across the ground (`d`), and every vertex
 * pulled toward that origin by `scale` (model space: the world offset turned back through the piece's own rotation).
 */
const handoff = (scale: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> => ({ ...SKY_PAINTER_GRAPH.nodes,
  origin: { op: 'objectOrigin' }, eye: { op: 'cameraPosition' }, rel: { op: 'sub', in: ['origin', 'eye'] }, flat: { op: 'swizzle', in: ['rel'], mask: 'xz' },
  d: { op: 'length', in: ['flat'] }, wp: { op: 'positionWorld' }, arm: { op: 'sub', in: ['wp', 'origin'] }, local: { op: 'worldToLocal', in: ['arm'] },
  ...scale, less: { op: 'sub', in: ['s', 1] }, offset: { op: 'mul', in: ['local', 'less'] },
});

/**
 * The grass clumps' (and the rim's lip clumps') hand-off to the near meadow (SHARD-PLATFORM G382: an SF59 material graph,
 * `look.materials.dressing-clump`): each clump shrinks away between 15 and 22 m from the camera.
 */
export const CLUMP_GRAPH = { version: 1, kind: 'material', model: 'standard', doubleSided: true,
  nodes: { ...handoff({ s: { op: 'smoothstep', in: [15, 22, 'd'] } }), c: { op: 'vertexColour' } },
  stages: { 'vertex.offset': { offset: 'offset' }, surface: { colour: 'c', roughness: 1, metalness: 0 }, lighting: SKY_PAINTER_GRAPH.lighting } } as const;

/**
 * The far flowers' hand-off (`look.materials.dressing-flower`): grown in past the near meadow's flowers (9 to 13 m), up to
 * 2.2 × far off, lit a little by their own warm emissive.
 */
export const FLOWER_GRAPH = { version: 1, kind: 'material', model: 'standard', doubleSided: true,
  params: { warm: { type: 'colour', value: [0x2a / 255, 0x24 / 255, 0x18 / 255] } },
  nodes: { ...handoff({ grow: { op: 'smoothstep', in: [9, 13, 'd'] }, far: { op: 'div', in: ['d', 12] }, big: { op: 'clamp', in: ['far', 1, 2.2] }, s: { op: 'mul', in: ['grow', 'big'] } }),
    c: { op: 'vertexColour' }, warm: { op: 'param', param: 'warm' } },
  stages: { 'vertex.offset': { offset: 'offset' }, surface: { colour: 'c', emissive: 'warm', roughness: 1, metalness: 0 }, lighting: SKY_PAINTER_GRAPH.lighting } } as const;

/** A graph builder for the boulders: each `op` adds one node and returns its id. */
type GraphInput = string | number | readonly number[];
const boulderNodes: Record<string, { readonly op: string; readonly in?: readonly GraphInput[]; readonly mask?: string; readonly param?: string }> = {};
let nextBoulder = 0;
const op = (name: string, inputs?: readonly GraphInput[], extra?: { mask?: string; param?: string }): string => {
  const id = `b${String(nextBoulder++)}`; boulderNodes[id] = { op: name, ...(inputs === undefined ? {} : { in: inputs }), ...extra }; return id;
};
const add = (a: GraphInput, b: GraphInput): string => op('add', [a, b]), mul = (a: GraphInput, b: GraphInput): string => op('mul', [a, b]);
const swz = (a: string, mask: string): string => op('swizzle', [a], { mask }), smooth = (e0: GraphInput, e1: GraphInput, x: GraphInput): string => op('smoothstep', [e0, e1, x]);
const half = (x: string): string => add(mul(x, 0.5), 0.5), sinDot = (p: string, k: readonly number[]): string => op('sin', [op('dot', [p, k])]);
const rockAt = (at: string): string => swz(op('texture', [mul(at, 0.7)], { param: 'rock' }), 'xyz');

// the boulder's world position and facet normal (flat shading), three sine fields at a boulder's scale and a crack line
const bw = op('positionWorld'), bn = op('normalWorld'), bny = swz(bn, 'y');
const n1 = half(mul(sinDot(bw, [4.42, 0, 7.54]), sinDot(bw, [-2.86, 8.58, 0])));
const n2 = half(mul(sinDot(bw, [7.3, 5.1, 0]), sinDot(bw, [0, -4.3, 6.7])));
const n3 = half(mul(sinDot(bw, [19, 7, -13]), sinDot(bw, [11, 0, 17])));
const crack = op('oneMinus', [smooth(0, 0.07, op('abs', [op('sin', [add(op('dot', [bw, [3.1, 0, 2.3]]), mul(op('sin', [mul(swz(bw, 'y'), 4)]), 1.5))])]))]);
// the painted cliff rock again, triplanar at a boulder's scale (a 1.4 m tile, not the cliffs' 8 m), grey, darker below
const w0 = op('pow', [op('abs', [bn]), 4]), tw = op('div', [w0, op('dot', [w0, [1, 1, 1]])]);
const bt = add(add(mul(rockAt(swz(bw, 'zy')), swz(tw, 'x')), mul(rockAt(swz(bw, 'xz')), swz(tw, 'y'))), mul(rockAt(swz(bw, 'xy')), swz(tw, 'z')));
const stone = mul(mul(mul(op('dot', [bt, [0.3, 0.59, 0.11]]), [1, 0.98, 0.94]), add(0.8, mul(n2, 0.4))), op('oneMinus', [mul(crack, 0.5)]));
const shaded = mul(stone, op('oneMinus', [mul(smooth(0, -0.6, bny), 0.35)]));
// pale lichen flecks (round 6, E407 row 4), then a moss cap on the flattest tops, its edge broken by noise
const lichen = op('mix', [shaded, [0.42, 0.4, 0.3], mul(smooth(0.8, 0.93, mul(n3, add(0.7, mul(n1, 0.6)))), 0.4)]);
const mossK = mul(smooth(0.88, 0.99, add(add(bny, mul(op('sub', [n2, 0.5]), 0.35)), mul(op('sub', [n1, 0.5]), 0.2))), 0.3);
const boulder = op('mix', [lichen, mul([0.1, 0.12, 0.05], add(0.75, mul(n3, 0.5))), mossK]);

/** The boulders' look (`look.materials['dressing-stone']`, E392 foreground, E407 row 4): grey rocks with pale lichen and a
 *  moss cap over the islands' painted rock (the library's `rock` map), faceted, matte, in the painted light. */
export const BOULDER_GRAPH = { version: 1, kind: 'material', model: 'standard', flatShading: true,
  params: { rock: { type: 'texture', value: ISLE_MAPS.rock } },
  nodes: { ...SKY_PAINTER_GRAPH.nodes, ...boulderNodes }, stages: { surface: { colour: boulder, roughness: 0.95, metalness: 0 }, lighting: SKY_PAINTER_GRAPH.lighting } } as const;

/**
 * Which `look.materials` entry each dressing kind (a dressing row's `dressing`) is drawn in: the clumps and the rims' lip
 * clumps (which lean out over every rim, E407 row 4) the hand-off clump, the flowers theirs, the boulders the rock.
 */
export const DRESSING_LOOKS: Readonly<Record<string, string>> = { clump: 'dressing-clump', lip: 'dressing-clump', flower: 'dressing-flower', stone: 'dressing-stone' };
