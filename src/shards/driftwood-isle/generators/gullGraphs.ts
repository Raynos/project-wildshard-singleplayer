// SHARD-PLATFORM W2c (build-time look graphs): data/gullGraphLook.ts's SF59 material graphs, built only at build time and emitted
// as JSON (generators/lookMaterials.ts → data/lookMaterials.generated.json, the shardfile's `look.materials`); play code
// reads the ids and rows in data/gullGraphLook.ts, never these builders.
import type { GraphIr, GraphNode, GraphRef } from '@wildshard/format/materialGraph';
import { GULL_GRAPH_LOOK, GULL_RIG } from '../data/gullGraphLook';

function gullGraph(): GraphIr {
  const nodes: Record<string, GraphNode> = {};
  let next = 0;
  const op = (name: string, inputs?: readonly GraphRef[], extra?: Omit<GraphNode, 'op' | 'in'>): string => {
    const id = `g${String(next++)}`; nodes[id] = { op: name, ...(inputs === undefined ? {} : { in: inputs }), ...extra }; return id;
  };
  const add = (a: GraphRef, b: GraphRef): string => op('add', [a, b]), sub = (a: GraphRef, b: GraphRef): string => op('sub', [a, b]);
  const mul = (a: GraphRef, b: GraphRef): string => op('mul', [a, b]), swz = (a: GraphRef, mask: string): string => op('swizzle', [a], { mask });
  const sel = (c: GraphRef, a: GraphRef, b: GraphRef): string => op('select', [c, a, b]), eq = (a: GraphRef, b: number): string => op('eq', [a, b]);
  /** (u, v) turned by `a` about (pu, pv), counter-clockwise */
  const turn = (u: GraphRef, v: GraphRef, a: GraphRef, pu: GraphRef, pv: GraphRef): [string, string] => {
    const c = op('cos', [a]), s = op('sin', [a]), du = sub(u, pu), dv = sub(v, pv);
    return [add(sub(mul(du, c), mul(dv, s)), pu), add(add(mul(du, s), mul(dv, c)), pv)];
  };
  const { shoulderX, shoulderY, elbowX, neck, hip } = GULL_RIG;
  const p = op('positionGeometry'), x = swz(p, 'x'), y = swz(p, 'y'), z = swz(p, 'z');
  const part = op('attribute', undefined, { name: 'aPart', type: 'float' }), anim = op('attribute', undefined, { name: 'aAnim', type: 'vec4' });
  const flap = swz(anim, 'x'), headYaw = swz(anim, 'y'), fold = swz(anim, 'z'), tuck = swz(anim, 'w');
  // a wing: shortened and swept back along the flank when perched (tuck 0), the hand folded about the elbow, the whole
  // wing flapped about the shoulder (about +z), then swept about the shoulder (about +y)
  const side = sel(eq(part, 1), -1, 1), sx = mul(shoulderX, side);
  const k = op('oneMinus', [mul(0.45, op('oneMinus', [tuck]))]);
  const ex = add(mul(sub(mul(elbowX, side), sx), k), sx), x1 = add(mul(sub(x, sx), k), sx);
  const hand = op('gt', [op('abs', [x]), elbowX - 0.001]);
  const [hx, hy] = turn(x1, y, op('negate', [mul(fold, side)]), ex, shoulderY + 0.01);
  const [x2, y2] = [sel(hand, hx, x1), sel(hand, hy, y)];
  const [x3, y3] = turn(x2, y2, mul(flap, side), sx, shoulderY);
  const sweep = op('negate', [mul(mul(op('oneMinus', [tuck]), 1.25), side)]);
  const [x4, z4] = turn(x3, z, sweep, sx, 0.02);
  const wing = op('combine', [x4, y3, z4]);
  // the head turns about the neck (y axis); the legs tuck back under the tail in flight (about the hip, x axis)
  const [nx, nz] = turn(x, z, headYaw, neck[0], neck[2]);
  const head = op('combine', [nx, y, nz]);
  const [ly, lz] = turn(y, z, mul(tuck, -1.35), hip[1], hip[2]);
  const legs = op('combine', [x, ly, lz]);
  const posed = sel(op('or', [eq(part, 1), eq(part, 2)]), wing, sel(eq(part, 3), head, sel(op('gte', [part, 4]), legs, p)));
  const position = swz(op('instanceTransform', [op('combine', [posed, 1])]), 'xyz');
  return {
    version: 1, kind: 'material', model: 'toon', flatShading: true, doubleSided: true,
    nodes: { ...nodes, paint: { op: 'vertexColour' } },
    stages: { 'vertex.position': { position, shadow: true }, surface: { colour: 'paint', roughness: 0.8, metalness: 0 } },
  };
}

/** The gulls' graph by look.materials id. */
export const GULL_GRAPHS: Readonly<Record<string, GraphIr>> = { [GULL_GRAPH_LOOK]: gullGraph() };
