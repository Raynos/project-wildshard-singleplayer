import type { GraphIr, GraphNode, GraphRef } from '@wildshard/format/materialGraph';
import { HARE_NECK } from './wildlifeKinds';

/**
 * Pine Hollow's small wildlife (PINE-HOLLOW-REMASTER PH-M5) as an SF59 material graph (SHARD-PLATFORM W2 C2): the raven,
 * the great grey owl, the pileated woodpecker and the snowshoe hare packed in one geometry and drawn as one instanced mesh
 * (runtime/looks/posedInstances.ts, ../models/wildlife.ts WildlifeMesh). The vertex stage turns each part (aInfo.x: the
 * ids in ./wildlifeKinds.ts `P`) about its pivot from the instance's two vec4s — birds (flap, fold, head yaw, head pitch) +
 * (kind, leg tuck, body pitch, pose); the hare (hind legs, fore legs, head pitch, ears back) + (kind, head yaw, –, –) —
 * and collapses another kind's (or the other pose's) vertices to the instance's origin. The surface samples the birds'
 * atlas (lent once they land; a 1×1 stand-in before), takes the per-vertex roughness and lights the owl's eye-shine at
 * night (`glow`). Lit by the standard model, fogged, double-sided.
 */

/** the look.materials id the wildlife wears */
export const WILDLIFE_LOOK = 'pine-wildlife';

function wildlifeGraph(): GraphIr {
  const nodes: Record<string, GraphNode> = {};
  let next = 0;
  const op = (name: string, inputs?: readonly GraphRef[], extra?: Omit<GraphNode, 'op' | 'in'>): string => {
    const id = `v${String(next++)}`; nodes[id] = { op: name, ...(inputs === undefined ? {} : { in: inputs }), ...extra }; return id;
  };
  const add = (a: GraphRef, b: GraphRef): string => op('add', [a, b]), sub = (a: GraphRef, b: GraphRef): string => op('sub', [a, b]);
  const mul = (a: GraphRef, b: GraphRef): string => op('mul', [a, b]), swz = (a: GraphRef, mask: string): string => op('swizzle', [a], { mask });
  const sel = (c: GraphRef, a: GraphRef, b: GraphRef): string => op('select', [c, a, b]), eq = (a: GraphRef, b: number): string => op('eq', [a, b]);
  const xyz = (x: GraphRef, y: GraphRef, z: GraphRef): string => op('combine', [x, y, z]);
  const attr = (name: string, type: 'vec3' | 'vec4'): string => op('attribute', undefined, { name, type });
  /** v turned by a about the x, y or z axis, or about the unit axis k (Rodrigues) */
  const rot = (axis: 'x' | 'y' | 'z', v: GraphRef, a: GraphRef): string => {
    const c = op('cos', [a]), s = op('sin', [a]), x = swz(v, 'x'), y = swz(v, 'y'), z = swz(v, 'z');
    if (axis === 'x') return xyz(x, sub(mul(y, c), mul(z, s)), add(mul(y, s), mul(z, c)));
    if (axis === 'y') return xyz(add(mul(x, c), mul(z, s)), y, sub(mul(z, c), mul(x, s)));
    return xyz(sub(mul(x, c), mul(y, s)), add(mul(x, s), mul(y, c)), z);
  };
  const rodrigues = (v: GraphRef, k: GraphRef, a: GraphRef): string => {
    const c = op('cos', [a]), s = op('sin', [a]);
    return add(add(mul(v, c), mul(op('cross', [k, v]), s)), mul(k, mul(op('dot', [k, v]), op('oneMinus', [c]))));
  };

  const p = op('positionGeometry'), n = op('normalLocal'), pv = attr('aPivot', 'vec3');
  const info = attr('aInfo', 'vec4'), texV = attr('aTexV', 'vec4'), anim = attr('aAnim', 'vec4'), anim2 = attr('aAnim2', 'vec4');
  const part = swz(info, 'x'), ax = swz(anim, 'x'), ay = swz(anim, 'y'), az = swz(anim, 'z'), aw = swz(anim, 'w');
  const by = swz(anim2, 'y'), bz = swz(anim2, 'z');
  const rel = sub(p, pv);
  // a wing: shortened as it folds, flapped about the body axis at the shoulder; folding also stands its chord on edge
  // (leading edge up) and sweeps it back, so a folded wing lies flat along the flank over the tail, not out like a plate
  const side = sel(eq(part, 1), -1, 1), shut = op('smoothstep', [0.4, 1, ay]), flap = mul(ax, side), sweep = mul(mul(ay, 1.5), side);
  let wq = mul(rel, xyz(op('oneMinus', [mul(ay, 0.42)]), 1, op('oneMinus', [mul(shut, 0.5)])));
  wq = rot('y', rot('x', rot('z', wq, flap), mul(shut, -1.35)), sweep);
  const wingP = add(add(wq, xyz(mul(mul(side, 0.45), mul(op('abs', [swz(pv, 'x')]), shut)), 0, 0)), pv);
  const wingN = rot('y', rot('x', rot('z', n, flap), mul(shut, -1.35)), sweep);
  // the head: pitched (+ = down) about the neck, then turned about the world's vertical (the body may be upright)
  const up = xyz(0, op('cos', [bz]), op('sin', [bz]));
  const headP = add(rodrigues(rot('x', rel, aw), up, az), pv), headN = rodrigues(rot('x', n, aw), up, az);
  // the legs tucked (4); the hare's hind and fore legs (13, 14)
  const legA = sel(eq(part, 4), mul(by, 1.4), sel(eq(part, 13), ax, ay));
  const legP = add(rot('x', rel, legA), pv), legN = rot('x', n, legA);
  // the hare's head (11) and ears (12, laid back first), turned about its neck
  const ear = eq(part, 12), earP = sel(ear, add(rot('x', rel, op('negate', [aw])), pv), p), earN = sel(ear, rot('x', n, op('negate', [aw])), n);
  const neck = [HARE_NECK[0], HARE_NECK[1], HARE_NECK[2]];
  const hareP = add(rot('x', rot('y', sub(earP, neck), by), az), neck), hareN = rot('x', rot('y', earN, by), az);
  const isWing = op('or', [eq(part, 1), eq(part, 2)]), isLeg = op('or', [eq(part, 4), op('or', [eq(part, 13), eq(part, 14)])]);
  const isHare = op('or', [eq(part, 11), ear]);
  const posed = sel(isWing, wingP, sel(eq(part, 3), headP, sel(isLeg, legP, sel(isHare, hareP, p))));
  const normal = sel(isWing, wingN, sel(eq(part, 3), headN, sel(isLeg, legN, sel(isHare, hareN, n))));
  // another kind's vertex collapses to a point: this instance draws only its own model (and, for a modelled bird, only its
  // pose: perched or flying, aAnim2.w)
  const pose = swz(texV, 'w');
  const other = op('or', [op('gt', [op('abs', [sub(swz(info, 'y'), swz(anim2, 'x'))]), 0.5]),
    op('and', [op('gt', [pose, -0.5]), op('gt', [op('abs', [sub(pose, swz(anim2, 'w'))]), 0.5])])]);
  const local = sel(other, [0, 0, 0], posed);
  const position = swz(op('instanceTransform', [op('combine', [local, 1])]), 'xyz');

  // the surface: the atlas over the vertex colour where textured, the vertex's roughness, the owl's eyes at night
  const textured = op('gt', [op('varying', [swz(texV, 'z')]), 0.5]);
  const texel = swz(op('texture', [op('varying', [swz(texV, 'xy')])], { param: 'atlas' }), 'xyz');
  const tr = swz(texel, 'x'), tg = swz(texel, 'y'), tb = swz(texel, 'z');
  const eye = mul(mul(op('smoothstep', [0.3, 0.5, tr]), op('smoothstep', [0.18, 0.3, tg])), op('oneMinus', [op('smoothstep', [0.2, 0.45, op('div', [tb, op('max', [tr, 1e-3])])])]));
  const colour = mul(op('vertexColour'), sel(textured, texel, [1, 1, 1]));
  const emissive = mul([1.4, 1.008, 0.308], mul(mul(op('varying', [swz(info, 'w')]), op('param', undefined, { param: 'glow' })), sel(textured, eye, 1)));
  return {
    version: 1, kind: 'material', model: 'standard', budget: { nodes: 400, samplers: 1, instructions: 1600 }, doubleSided: true,
    params: { atlas: { type: 'texture', value: 'wildlife-atlas', role: 'lent' }, glow: { type: 'float', value: 0, min: 0, max: 1 } },
    nodes, stages: { 'vertex.position': { position }, 'vertex.normal': { normal },
      surface: { colour, roughness: op('varying', [swz(info, 'z')]), metalness: 0, emissive } },
  };
}

/** The wildlife's graph by look.materials id. */
export const WILDLIFE_GRAPHS: Readonly<Record<string, GraphIr>> = { [WILDLIFE_LOOK]: wildlifeGraph() };
