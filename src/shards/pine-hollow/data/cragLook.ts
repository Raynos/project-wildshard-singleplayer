// Pine Hollow's crag and cave looks as data (SHARD-PLATFORM M3, look-family rows): the triplanar granite's SF59 material
// graph (CRAG_GRAPHS: world/crags.ts draws the one BatchedMesh in it) and the cave's look near its mouth (CAVE_LOOK:
// @wildshard/sdk/kit/caveInterior; the shaft's look is data/caveShaftLook.ts). The vertex `aCdata` = (AO, sun reach, wet,
// rock): AO multiplies the indirect light, sun reach the directional lights and the haze; `aCtint` = (tint shade, tint
// path / face skin).
import type { GraphIr, GraphNode, GraphRef } from '@wildshard/format/materialGraph';
import type { CaveLookRow } from '../runtime/kit/caveInterior';
import { CAVE_SHAFT_LOOK } from './caveShaftLook';

/** the granite's albedo lift (E322 F-L1) */
const CRAG_LIFT = 1.3;
/** the granite's tile (m): one mossy_rock repeat per 4.6 m on the faces, the grit per 3.4 m */
const ROCK_TILE = 4.6, GRIT_TILE = 3.4;

/** the look.materials id the crags, the face skin and the cave wear */
export const CRAG_LOOK = 'pine-crag';
/** the granite's lent textures (world/crags.ts lends `mossy_rock`'s albedo / normal / ARM and `rock_ground`'s albedo / normal) */
export const CRAG_TEXTURES = ['rockMap', 'rockNormal', 'rockArm', 'gritMap', 'gritNormal'] as const;

/** One graph's node table and its builders (ids `c0`, `c1`, …; a node built twice is one node). */
function kit() {
  const nodes: Record<string, GraphNode> = {}, seen = new Map<string, string>();
  let next = 0;
  const op = (name: string, inputs?: readonly GraphRef[], extra?: Omit<GraphNode, 'op' | 'in'>): string => {
    const node: GraphNode = { op: name, ...(inputs === undefined ? {} : { in: inputs }), ...extra }, key = JSON.stringify(node);
    const known = seen.get(key);
    if (known !== undefined) return known;
    const id = `c${String(next++)}`; nodes[id] = node; seen.set(key, id); return id;
  };
  const add = (a: GraphRef, b: GraphRef): string => op('add', [a, b]), sub = (a: GraphRef, b: GraphRef): string => op('sub', [a, b]);
  const mul = (a: GraphRef, b: GraphRef): string => op('mul', [a, b]), mix = (a: GraphRef, b: GraphRef, t: GraphRef): string => op('mix', [a, b, t]);
  const swz = (a: GraphRef, mask: string): string => op('swizzle', [a], { mask });
  const smooth = (a: GraphRef, b: GraphRef, x: GraphRef): string => op('smoothstep', [a, b, x]);
  /** the old program's value noise: a fract hash at the cell's corners, a smoothstep fade between them */
  const noise = (p: GraphRef): string => {
    const hash = (q: GraphRef): string => {
      const f = op('fract', [mul(q, [123.34, 456.21])]), g = add(f, op('dot', [f, add(f, 45.32)]));
      return op('fract', [mul(swz(g, 'x'), swz(g, 'y'))]);
    };
    const i = op('floor', [p]), f = op('fract', [p]), u = mul(mul(f, f), sub(3, mul(f, 2))), ux = swz(u, 'x');
    return mix(mix(hash(i), hash(add(i, [1, 0])), ux), mix(hash(add(i, [0, 1])), hash(add(i, [1, 1])), ux), swz(u, 'y'));
  };
  return { nodes, op, add, sub, mul, mix, swz, smooth, noise };
}

/**
 * Triplanar granite in world space for the BatchedMesh (and the cave inside it): albedo / normal / ARM from `mossy_rock`
 * on the X and Z projections and on the Y one blended with `rock_ground` grit on the ledges, moss on the up-facing,
 * dark rain streaks down the faces, warm stains, the pale lift, and a tint path for the cave's bedding and bones. The
 * face skin (aCtint.y = 1) is projected by its facets (its smoothed normals averaged a riser with the tread above it,
 * laying the tread's texture down the riser) and lit half by them. The cave's wet darkens and glosses; its fill (the
 * `caveFill` param, world/crags.ts sets it each frame) is an emissive on the inside; sun reach scales the sun and the
 * haze (the fog's bright sky colour stays off the cave's rock); AO and reach scale the indirect light.
 */
function cragGraph(): GraphIr {
  const k = kit(), { op, add, sub, mul, mix, swz, smooth, noise } = k;
  const cd = op('attribute', undefined, { name: 'aCdata', type: 'vec4' }), ct = op('attribute', undefined, { name: 'aCtint', type: 'vec2' });
  const ao = swz(cd, 'x'), reach = swz(cd, 'y'), wet = swz(cd, 'z'), rockW = op('step', [0.5, swz(cd, 'w')]);
  const pw = op('positionWorld'), px = swz(pw, 'x'), py = swz(pw, 'y'), pz = swz(pw, 'z'), xz = swz(pw, 'xz');
  const base = op('normalize', [op('normalWorld')]);
  // the face skin, by its facets: lit half faceted, projected fully faceted
  const facet0 = op('normalize', [op('cross', [op('dFdx', [pw]), op('dFdy', [pw])])]);
  const facet = mul(facet0, op('select', [op('gt', [add(op('dot', [facet0, base]), 1e-4), 0]), 1, -1]));
  const skin = mul(op('step', [0.5, swz(ct, 'y')]), rockW);
  const lit = op('normalize', [mix(base, facet, mul(skin, 0.5))]), n = op('normalize', [mix(base, facet, skin)]);
  const n2 = mul(n, n), n4 = mul(n2, n2);
  const cb = op('div', [n4, op('max', [op('dot', [n4, [1, 1, 1]]), 1e-5])]), cbx = swz(cb, 'x'), cby = swz(cb, 'y'), cbz = swz(cb, 'z');
  const sg = sub(mul(op('step', [-1e-4, n]), 2), 1), sgx = swz(sg, 'x'), sgy = swz(sg, 'y'), sgz = swz(sg, 'z');
  const tile = 1 / ROCK_TILE;
  const uvX = mul(op('combine', [mul(pz, sgx), py]), tile), uvY = mul(op('combine', [mul(px, sgy), pz]), tile);
  const uvZ = mul(op('combine', [mul(op('negate', [px]), sgz), py]), tile), uvG = mul(xz, 1 / GRIT_TILE);
  const tex = (param: (typeof CRAG_TEXTURES)[number], uv: GraphRef): string => swz(op('texture', [uv], { param }), 'xyz');
  const up = smooth(0.45, 0.9, swz(n, 'y'));
  // the grit on the ledges (the Y projection): patchy
  const gritN = add(mul(noise(mul(xz, 0.35)), 0.65), mul(noise(mul(xz, 1.3)), 0.35));
  const grit = mul(mul(up, smooth(0.35, 0.65, gritN)), rockW);
  const aY = mix(tex('rockMap', uvY), mul(tex('gritMap', uvG), [0.95, 0.93, 0.9]), grit);
  let alb = add(add(mul(tex('rockMap', uvX), cbx), mul(aY, cby)), mul(tex('rockMap', uvZ), cbz));
  const arm = add(add(mul(tex('rockArm', uvX), cbx), mul(tex('rockArm', uvY), cby)), mul(tex('rockArm', uvZ), cbz));
  // granite, not a lichen carpet: the lichen's green / yellow cools toward grey on the steep faces and in the dark
  const luma = (c: GraphRef): string => op('dot', [c, [0.299, 0.587, 0.114]]);
  alb = mix(mul(luma(alb), [0.98, 1, 1.04]), alb, mul(mix(0.58, 0.9, up), mix(0.5, 1, reach)));
  // rain streaks down the faces: dark vertical stains under the ledges
  const streak = mul(noise(op('combine', [mul(add(px, pz), 0.9), mul(py, 0.06)])), noise(op('combine', [mul(sub(px, pz), 0.33), add(mul(py, 0.02), 7)])));
  alb = mul(alb, sub(1, mul(mul(mul(smooth(0.12, 0.45, streak), 0.2), op('oneMinus', [up])), reach)));
  // moss on the up-facing, outside (the cave's floor stays bare)
  const mossN = add(mul(noise(add(mul(xz, 0.21), 3)), 0.6), mul(noise(mul(xz, 0.9)), 0.4));
  const moss = mul(mul(mul(mul(smooth(0.62, 0.92, swz(n, 'y')), smooth(0.42, 0.62, mossN)), reach), rockW), sub(1, mul(grit, 0.6)));
  alb = mix(alb, mul([0.075, 0.095, 0.035], add(0.8, mul(mossN, 0.4))), mul(moss, 0.85));
  // a macro variation so a face does not tile; warm iron-stained patches
  alb = mul(alb, add(0.86, mul(noise(add(mul(xz, 0.045), mul(py, 0.03))), 0.28)));
  alb = mul(alb, mix([1, 1, 1], [1.1, 1, 0.86], mul(smooth(0.35, 0.75, noise(add(mul(xz, 0.018), 9))), rockW)));
  // E322 F-L1: the look targets' pale granite: lifted, the blotches pulled toward their mean
  alb = mul(mix(alb, mix(luma(alb), [0.36, 0.35, 0.33], 0.35), mul(mul(rockW, op('oneMinus', [moss])), 0.3)), mix(1, CRAG_LIFT, rockW));
  // the tint path (the cave's bedding, bones, twigs): its own albedo, the granite's normal for grain
  const ty = swz(ct, 'y');
  const tint = op('select', [op('lt', [ty, 0.25]), [0.62, 0.58, 0.49], op('select', [op('lt', [ty, 0.5]), [0.42, 0.33, 0.19], [0.19, 0.13, 0.08]])]);
  alb = mix(mul(mul(tint, swz(ct, 'x')), add(0.85, mul(noise(mul(xz, 6)), 0.3))), alb, rockW);
  // the cave's wet (drips, the damp floor): darker, glossier
  const colour = mul(alb, sub(1, mul(wet, 0.35)));
  const roughness = mix(mix(mix(0.95, swz(arm, 'y'), rockW), 0.9, moss), 0.28, wet);
  // inside, the fill is the cave's light: the sky's own light has no business under the roof
  const occlusion = mul(mul(mix(1, swz(arm, 'x'), mul(rockW, 0.75)), op('max', [ao, 0.012])), mix(0.08, 1, reach));
  // the normal: each projection's tangent normal, whiteout-blended onto the lit base (tangent frames X ← (z, y), Y ← (x, z), Z ← (x, y))
  const unpack = (t: GraphRef): string => sub(mul(t, 2), 1);
  const str = mul(mix(0.35, 1, rockW), sub(1, mul(moss, 0.6)));
  const nX = unpack(tex('rockNormal', uvX)), nZ = unpack(tex('rockNormal', uvZ));
  const nY = op('normalize', [mix(unpack(tex('rockNormal', uvY)), unpack(tex('gritNormal', uvG)), grit)]);
  const bent = (t: string, sign: GraphRef): string => mul(op('combine', [mul(swz(t, 'x'), sign), swz(t, 'y')]), str);
  const tX = op('combine', [add(bent(nX, sgx), swz(lit, 'zy')), mul(op('abs', [swz(nX, 'z')]), swz(lit, 'x'))]);
  const tY = op('combine', [add(bent(nY, sgy), swz(lit, 'xz')), mul(op('abs', [swz(nY, 'z')]), swz(lit, 'y'))]);
  const tZ = op('combine', [add(bent(nZ, op('negate', [sgz])), op('combine', [op('negate', [swz(lit, 'x')]), swz(lit, 'y')])), mul(op('abs', [swz(nZ, 'z')]), swz(lit, 'z'))]);
  const zFlip = op('combine', [op('negate', [swz(tZ, 'x')]), swz(tZ, 'y'), swz(tZ, 'z')]);
  const normal = op('normalize', [add(add(mul(swz(tX, 'zyx'), cbx), mul(swz(tY, 'xzy'), cby)), mul(zFlip, cbz))]);
  const emissive = mul(mul(mul(colour, op('param', undefined, { param: 'caveFill' })), ao), op('oneMinus', [reach]));
  return { version: 1, kind: 'material', model: 'standard', budget: { nodes: 720, samplers: 5, instructions: 1080 }, nodes: k.nodes,
    params: {
      ...Object.fromEntries(CRAG_TEXTURES.map((name) => [name, { type: 'texture' as const, value: `pine-crag-${name}`, role: 'lent' as const }])),
      caveFill: { type: 'float', value: 1, min: 0, max: 8 },
    },
    stages: {
      'vertex.scale': { sun: reach, fog: mix(0.06, 1, reach) },
      surface: { colour, normal, roughness, metalness: 0, occlusion, emissive },
    } };
}

/** the crags' graph by look.materials id */
export const CRAG_GRAPHS: Readonly<Record<string, GraphIr>> = { [CRAG_LOOK]: cragGraph() };

/**
 * The bear cave near its mouth (world/crags.ts hands it to @wildshard/sdk/kit/caveInterior): the shaft and the drips draw
 * within 60 m; under the roof (the floor at the eye's depth, clamped to the passage, + 7 m) the sun's disc goes; the walls'
 * fill is 0.05 + 1.6 × day; the shaft is 0.2 × day × min(1, 0.4 + 2 × max(0, sun.y)) + 0.02; each drip forms on a
 * 1.7 s + (i mod 5) × 0.53 s clock, then falls.
 */
export const CAVE_LOOK: CaveLookRow = {
  near: 60,
  under: { height: 7, lzMin: -4, lzMax: 36 },
  fill: [0.05, 1.6],
  surface: 'rock',
  shaft: { look: CAVE_SHAFT_LOOK, radialSegments: 20, heightSegments: 6, renderOrder: 7, gain: 0.2, sunBase: 0.4, sunGain: 2, floor: 0.02 },
  drips: { color: 0xcfd8dc, size: 0.045, opacity: 0.85, period: 1.7, periodStep: 0.53, kinds: 5, phaseStep: 0.37, gravity: 9.8, hang: 0.04, minDrop: 0.2 },
};
