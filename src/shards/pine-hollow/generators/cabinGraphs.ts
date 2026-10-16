// Pine Hollow's cabin look graphs, built at build time (SHARD-PLATFORM W2c): the door's SF59 material graph (worn over
// its rough_pine_door PBR set, world/homestead.ts) and the roof's and the stone's moss graphs (worn over their scans),
// emitted into data/lookMaterials.generated.json by ./lookMaterials.ts. The ids the play code wears them by stay in
// ../data/cabinLook.ts.
import type { GraphIr, GraphNode, GraphRef } from '@wildshard/format/materialGraph';
import { CABIN_MOSS_BINDINGS, CABIN_PBR } from '../data/cabinAssembly';
import { CABIN_DOOR_LOOK, CABIN_MOSS_LOOKS } from '../data/cabinLook';

/**
 * The door leaf: the rough_pine_door scan (a saturated orange-red, its `meshMap` under the set's tint) pulled toward a
 * weathered grey-brown; its normal, roughness and AO maps are borrowed from the set's material (`bindMeshMap`), the
 * graph's roughness and occlusion of 1 leaving them as they are.
 */
export const CABIN_DOOR_GRAPHS: Readonly<Record<string, GraphIr>> = {
  [CABIN_DOOR_LOOK]: { version: 1, kind: 'material', model: 'standard',
    nodes: { mm: { op: 'meshMap' }, scan: { op: 'swizzle', in: ['mm'], mask: 'xyz' }, c: { op: 'mul', in: ['scan', [0.72, 0.68, 0.62]] },
      l: { op: 'dot', in: ['c', [0.333, 0.333, 0.333]] }, grey: { op: 'mix', in: ['l', 'c', 0.45] }, colour: { op: 'mul', in: ['grey', [0.9, 0.95, 1]] } },
    stages: { surface: { colour: 'colour', roughness: 1, metalness: 0, occlusion: 1 } } },
};

/** One moss graph's node table and its builders (ids `m0`, `m1`, …). */
function kit() {
  const nodes: Record<string, GraphNode> = {};
  let next = 0;
  const op = (name: string, inputs?: readonly GraphRef[], extra?: Omit<GraphNode, 'op' | 'in'>): string => {
    const id = `m${String(next++)}`; nodes[id] = { op: name, ...(inputs === undefined ? {} : { in: inputs }), ...extra }; return id;
  };
  const add = (a: GraphRef, b: GraphRef): string => op('add', [a, b]), mul = (a: GraphRef, b: GraphRef): string => op('mul', [a, b]);
  const swz = (a: GraphRef, mask: string): string => op('swizzle', [a], { mask });
  /** value noise in 0 … 1: a sine hash at the cell's corners, a quintic fade between them */
  const noise = (p: GraphRef): string => {
    const i = op('floor', [p]), f = op('fract', [p]);
    const u = mul(mul(mul(f, f), f), add(mul(f, op('sub', [mul(f, 6), 15])), 10)), ux = swz(u, 'x');
    const hash = (corner: GraphRef): string => op('fract', [mul(op('sin', [op('dot', [corner, [127.1, 311.7]])]), 43758.5453)]);
    return op('mix', [op('mix', [hash(i), hash(add(i, [1, 0])), ux]), op('mix', [hash(add(i, [0, 1])), hash(add(i, [1, 1])), ux]), swz(u, 'y')]);
  };
  /** a 2 × 2 matrix times p, its columns (a, b) and (c, d) */
  const turn = (p: GraphRef, a: number, b: number, c: number, d: number): string => op('combine', [op('dot', [p, [a, c]]), op('dot', [p, [b, d]])]);
  /** three octaves, each turned and scaled from the last */
  const fbm = (p: GraphRef): string => {
    const p2 = add(mul(turn(p, 0.8, 0.6, -0.6, 0.8), 2.13), 3.7), p3 = add(mul(turn(p2, 0.8, 0.6, -0.6, 0.8), 2.02), 9.1);
    return add(add(mul(noise(p), 0.5), mul(noise(p2), 0.3)), mul(noise(p3), 0.2));
  };
  return { nodes, op, add, mul, swz, noise, turn, fbm };
}

/**
 * Procedural moss / lichen over a cabin scan (its `meshMap` under the set's tint; its roughness and AO maps borrowed
 * from the set's material, `bindMeshMap`; its normal map lent as `normalMap`, world/homestead.ts): value-noise patches stretched along the planks (the map's uv plus
 * the world's xz), denser where the geometry's `aMoss` is high (eaves, the foundation's foot) and on faces turned from
 * the sun, sparser on the large scale so some stretches stay bare, their edges bumped (lit dark where they turn from the
 * light), a grey-green lichen between them; the moss is rougher.
 * `strength` and `upOnly` (only the up-facing faces take it) are the kind's own, so each kind is its own compile.
 */
function mossGraph(tint: readonly number[], normalScale: readonly number[], strength: number, upOnly: boolean): GraphIr {
  const k = kit(), { op, add, mul, swz, noise, turn, fbm } = k;
  const base = mul(swz(op('meshMap'), 'xyz'), tint);
  const n = op('normalize', [op('normalWorld')]);
  const mp = add(mul(op('uv'), [1.6, 3.6]), mul(swz(op('positionWorld'), 'xz'), 0.2)), turned = turn(mp, 0.6, 0.8, -0.8, 0.6);
  const field = add(mul(fbm(mp), 0.8), mul(fbm(add(mul(turned, 2.7), 11)), 0.2));
  const patchy = add(0.55, mul(noise(add(mul(mp, 0.3), 2)), 0.9));
  const shade = op('oneMinus', [op('smoothstep', [-0.3, 0.5, op('dot', [n, op('atmosphereSunDirection')])])]);
  const hint = op('attribute', undefined, { name: 'aMoss', type: 'float' });
  const lift = add(add(0.2, mul(op('pow', [hint, 1.6]), 0.75)), mul(shade, 0.18));
  const density = mul(mul(mul(lift, patchy), strength), upOnly ? op('smoothstep', [-0.05, 0.45, swz(n, 'y')]) : 1);
  const th = op('sub', [0.8, mul(density, 0.5)]);
  const mask = op('smoothstep', [th, add(th, 0.22), field]);
  const lichen = mul(mul(op('smoothstep', [0.74, 0.86, fbm(add(mul(turned, 4), 17))]), density), 0.35);
  const grain = op('clamp', [add(0.6, op('dot', [base, [0.99, 0.99, 0.99]])), 0.6, 1.25]); // the plank grain shows through
  const mossCol = mul(op('mix', [[0.02, 0.038, 0.009], [0.075, 0.115, 0.03], fbm(add(mul(mp, 2), 5))]), grain);
  const colour = op('mix', [op('mix', [base, mossCol, mask]), [0.055, 0.07, 0.04], mul(lichen, op('oneMinus', [mask]))]);
  // the shading normal, as the old overlay lit it: the scan's normal map (lent as `normalMap`) in a cotangent frame
  // rebuilt from screen derivatives (three's perturbNormal2Arb, in world space), then the moss mask's own bump along the
  // patch edges (three's perturbNormalArb over a height of mask × 0.35, scaled 6): the lumpy, crisp edge
  const face = op('select', [op('frontFacing'), 1, -1]), facing = mul(n, face);
  const pw = op('positionWorld'), q0 = op('dFdx', [pw]), q1 = op('dFdy', [pw]);
  const st0 = op('dFdx', [op('uv')]), st1 = op('dFdy', [op('uv')]);
  const q1perp = op('cross', [q1, facing]), q0perp = op('cross', [facing, q0]);
  const tangent = add(mul(q1perp, swz(st0, 'x')), mul(q0perp, swz(st1, 'x'))), bitangent = add(mul(q1perp, swz(st0, 'y')), mul(q0perp, swz(st1, 'y')));
  const frame = op('div', [face, op('max', [op('length', [tangent]), op('length', [bitangent])])]);
  const mapN = mul(op('sub', [mul(swz(op('texture', [op('uv')], { param: 'normalMap' }), 'xyz'), 2), 1]), [normalScale[0] ?? 1, normalScale[1] ?? 1, 1]);
  const mapped = op('normalize', [add(add(mul(tangent, mul(swz(mapN, 'x'), frame)), mul(bitangent, mul(swz(mapN, 'y'), frame))), mul(facing, swz(mapN, 'z')))]);
  const height = mul(mask, 0.35), r1 = op('cross', [q1, mapped]), r2 = op('cross', [mapped, q0]);
  const det = mul(op('dot', [q0, r1]), face);
  const grad = mul(op('select', [op('gte', [det, 0]), 1, -1]), add(mul(r1, op('dFdx', [height])), mul(r2, op('dFdy', [height]))));
  const normal = op('normalize', [op('sub', [mul(mapped, op('abs', [det])), mul(grad, 6)])]);
  return { version: 1, kind: 'material', model: 'standard', budget: { nodes: 720, samplers: 2, instructions: 1600 }, nodes: k.nodes,
    params: { normalMap: { type: 'texture', value: 'pine-cabin-scan-normal', role: 'lent' } },
    stages: { surface: { colour, normal, roughness: op('mix', [1, 1.15, mask]), metalness: 0, occlusion: 1 } } };
}

/** the moss kinds' graphs by look.materials id, each over its scan's tint */
export const CABIN_MOSS_GRAPHS: Readonly<Record<string, GraphIr>> = Object.fromEntries(CABIN_MOSS_BINDINGS.map((row) => {
  const scan = CABIN_PBR.find((p) => p.key === row.key);
  if (scan === undefined) throw new Error(`[pine-hollow] no cabin scan ${row.key}`);
  return [CABIN_MOSS_LOOKS[row.key], mossGraph(scan.color, scan.normal, row.strength, row.upOnly)];
}));
