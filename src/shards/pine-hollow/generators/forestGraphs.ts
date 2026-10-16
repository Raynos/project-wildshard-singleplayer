// Pine Hollow's forest look graphs, built at build time (SHARD-PLATFORM W2c): emitted into
// data/lookMaterials.generated.json by ./lookMaterials.ts; the ids and rows the play code reads stay in ../data/forestLook.ts.
import type { GraphIr, GraphNode, GraphRef } from '@wildshard/format/materialGraph';
import { FOREST_LOOKS, FOREST_TEXTURES } from '../data/forestLook';

/** One graph's node table and its builders (ids `f0`, `f1`, …; a node built twice is one node). */
function kit() {
  const nodes: Record<string, GraphNode> = {}, seen = new Map<string, string>();
  let next = 0;
  const op = (name: string, inputs?: readonly GraphRef[], extra?: Omit<GraphNode, 'op' | 'in'>): string => {
    const node: GraphNode = { op: name, ...(inputs === undefined ? {} : { in: inputs }), ...extra }, key = JSON.stringify(node);
    const known = seen.get(key);
    if (known !== undefined) return known;
    const id = `f${String(next++)}`; nodes[id] = node; seen.set(key, id); return id;
  };
  const add = (a: GraphRef, b: GraphRef): string => op('add', [a, b]), sub = (a: GraphRef, b: GraphRef): string => op('sub', [a, b]);
  const mul = (a: GraphRef, b: GraphRef): string => op('mul', [a, b]), mix = (a: GraphRef, b: GraphRef, t: GraphRef): string => op('mix', [a, b, t]);
  const swz = (a: GraphRef, mask: string): string => op('swizzle', [a], { mask });
  const smooth = (a: GraphRef, b: GraphRef, x: GraphRef): string => op('smoothstep', [a, b, x]);
  const param = (name: string): string => op('param', undefined, { param: name });
  const tex = (name: string, uv: GraphRef): string => op('texture', [uv], { param: name });
  return { nodes, op, add, sub, mul, mix, swz, smooth, param, tex };
}

type Kit = ReturnType<typeof kit>;

/**
 * The vertex: each tree sways about its root in the one wind (wind.ts's clock, direction and gust field): a lean down
 * the wind with the gust and two slow swells, a small sway across it, each tree on its own phase (a hash of its root),
 * weighted by height² (`aWindWeight`, the bark's a third of the crown's); the cards also flutter, faster and out of
 * phase across the crown. Returns the model-space offset (after the copy's own transform) and the copy's root.
 */
function sway(k: Kit, trunk: boolean): { offset: string; root: string } {
  const { op, add, sub, mul, swz } = k;
  const root = swz(op('instanceTransform', [[0, 0, 0, 1]]), 'xyz'), rxz = swz(root, 'xz');
  const weight = op('attribute', undefined, { name: 'aWindWeight', type: 'float' });
  const h = op('clamp', [trunk ? mul(weight, 1 / 0.35) : weight, 0, 1.2]), w = mul(h, h);
  const g = op('windGustAt', [rxz]), t = op('windTime'), d = op('windDirection'), dx = swz(d, 'x'), dz = swz(d, 'y');
  const ph = mul(op('fract', [mul(op('sin', [op('dot', [rxz, [12.9898, 78.233]])]), 43758.5453)]), 6.2832);
  const along = add(add(add(0.1, mul(g, 0.6)), mul(op('sin', [add(mul(t, 1.75), ph)]), add(0.06, mul(g, 0.24)))),
    mul(mul(op('sin', [add(mul(t, 2.9), mul(ph, 1.9))]), 0.05), g));
  const across = mul(op('sin', [add(mul(t, 1.3), mul(ph, 2.3))]), add(0.04, mul(g, 0.1)));
  let offset = mul(op('combine', [sub(mul(dx, along), mul(dz, across)), 0, add(mul(dz, along), mul(dx, across))]), w);
  if (!trunk) {
    const fl = op('dot', [op('positionLocal'), [0.83, 0.61, 0.71]]);
    const flut = mul(mul(add(mul(op('sin', [add(mul(t, 6.1), fl)]), 0.7), mul(op('sin', [add(add(mul(t, 9.7), mul(fl, 1.7)), ph)]), 0.3)),
      add(0.02, mul(g, 0.06))), w);
    offset = add(offset, op('combine', [mul(dx, flut), mul(flut, 0.35), mul(dz, flut)]));
  }
  return { offset, root };
}

/**
 * The LOD dissolve (E94): over its `fade` band (start, end: metres from the forest's `viewer` to the copy's root, both
 * in the forest's frame, set each frame by world/treeFactory.ts) a copy dissolves out (`dir` +1: the cards, the bark,
 * the twigs) or in (−1: the impostor) by a screen-door dither whose threshold both sides share, so across a cross-fade
 * every pixel is drawn by exactly one LOD. Returns the discard.
 */
function dissolve(k: Kit, root: string, dir: 1 | -1): string {
  const { op, sub, swz, param } = k, fade = param('fade');
  const dist = op('length', [sub(swz(root, 'xz'), swz(param('viewer'), 'xz'))]);
  const ft = op('saturate', [op('div', [sub(dist, swz(fade, 'x')), op('max', [sub(swz(fade, 'y'), swz(fade, 'x')), 1e-3])])]);
  const keep = op('varying', [dir > 0 ? op('oneMinus', [ft]) : ft]);
  const ign = op('fract', [k.mul(op('fract', [op('dot', [op('fragCoord'), [0.06711056, 0.00583715]])]), 52.9829189)]);
  return op('and', [op('lt', [keep, 1]), op('lte', [keep, dir > 0 ? ign : op('oneMinus', [ign])])]);
}

/** a tangent-space normal map on `n` (world, unit) by the screen derivatives of the surface and its uv (three's
 *  perturbNormal2Arb, in world space); `face` ±1 mirrors the frame on a back face */
function perturb(k: Kit, n: GraphRef, mapN: GraphRef, face: GraphRef): string {
  const { op, add, mul, swz } = k, p = op('positionWorld'), uv = op('uv');
  const q0 = op('dFdx', [p]), q1 = op('dFdy', [p]), st0 = op('dFdx', [uv]), st1 = op('dFdy', [uv]);
  const q1p = op('cross', [q1, n]), q0p = op('cross', [n, q0]);
  const tg = add(mul(q1p, swz(st0, 'x')), mul(q0p, swz(st1, 'x'))), bt = add(mul(q1p, swz(st0, 'y')), mul(q0p, swz(st1, 'y')));
  const s = op('div', [face, op('pow', [op('max', [op('dot', [tg, tg]), op('dot', [bt, bt])]), 0.5])]);
  return op('normalize', [add(add(mul(tg, mul(swz(mapN, 'x'), s)), mul(bt, mul(swz(mapN, 'y'), s))), mul(n, swz(mapN, 'z')))]);
}

/** a normal-map texel → its tangent normal, xy scaled */
const unpack = (k: Kit, texel: GraphRef, scale: number): string => k.mul(k.sub(k.mul(k.swz(texel, 'xyz'), 2), 1), [scale, scale, 1]);

/** how far the view looks down at the fragment: 0 at the horizon → 1 from ~27° down (E322 F-L3 B's ramp) */
const lookingDown = (k: Kit): string => k.smooth(0, 0.45, k.swz(k.op('normalize', [k.sub(k.op('cameraPosition'), k.op('positionWorld'))]), 'y'));

const BIG = 1e6;

/** the dissolve's params: the band (start, end; m) and the viewer (the forest's frame) */
const FADE_PARAMS = {
  fade: { type: 'vec2', value: [1e5, 1e5 + 1], min: 0, max: BIG },
  viewer: { type: 'vec3', value: [0, 0, 0], min: -BIG, max: BIG },
} as const;

const lent = (names: readonly string[]): Record<string, { type: 'texture'; value: string; role: 'lent' }> =>
  Object.fromEntries(names.map((name) => [name, { type: 'texture' as const, value: `pine-forest-${name}`, role: 'lent' as const }]));

/**
 * The bark: five PBR bark sets in one texture array, the layer per vertex (`aBarkLayer`, treegen.py's index), sampled
 * file-up (v negated, as in Blender); albedo × the vertex colour and a small lift, ARM's AO on the indirect light and
 * its roughness, the normal map on the derivative frame. Swayed and dissolved like the cards, its shadow too.
 */
function barkGraph(): GraphIr {
  const k = kit(), { op, mul, swz } = k;
  const { offset, root } = sway(k, true);
  const at = op('combine', [swz(op('uv'), 'x'), op('negate', [swz(op('uv'), 'y')])]);
  const layer = op('attribute', undefined, { name: 'aBarkLayer', type: 'float' });
  const sample = (param: string): string => op('textureArray', [at, layer], { param });
  const arm = sample('barkArm');
  return { version: 1, kind: 'material', model: 'standard', budget: { nodes: 220, samplers: 3, instructions: 900 }, nodes: k.nodes,
    params: { ...lent(FOREST_TEXTURES.bark), ...FADE_PARAMS },
    stages: {
      'vertex.offset': { offset, shadow: true },
      surface: {
        colour: mul(mul(swz(sample('barkMap'), 'xyz'), op('vertexColour')), [1.22, 1.2, 1.18]),
        normal: perturb(k, op('normalize', [op('normalWorld')]), unpack(k, sample('barkNormal'), 1), 1),
        roughness: swz(arm, 'y'), metalness: 0, occlusion: swz(arm, 'x'), discard: dissolve(k, root, 1),
      },
    } };
}

/**
 * The needle / twig cards: the card atlas × the vertex colour (the crown's baked occlusion) and a cool tint, cut at
 * 0.45, both faces lit by the crown-bent vertex normal; a card facing down shades toward 0.6 (the crown's inside), the
 * normal map bends it and the normal leans a quarter to the sky. E322 F-L3 B: seen from above, the sky-facing cards
 * shed most of their AO, lift and lean further to the sky, so a crown's top reads sunlit. The sun glows through the
 * crown toward the viewer (the scene's key light) over a small fill, both emitted and occluded like the indirect light.
 */
function cardGraph(): GraphIr {
  const k = kit(), { op, add, mul, mix, swz, smooth, tex } = k;
  const { offset, root } = sway(k, false);
  const uv = op('uv'), map = tex('cardMap', uv), arm = tex('cardArm', uv);
  const n0 = op('normalize', [op('normalWorld')]), ny = swz(n0, 'y'), up = [0, 1, 0];
  const lift = mul(lookingDown(k), smooth(-0.1, 0.6, ny));
  const face = op('select', [op('frontFacing'), 1, -1]);
  const bent = op('normalize', [mix(perturb(k, n0, unpack(k, tex('cardNormal', uv), 0.8), face), up, 0.25)]);
  const shade = mul(mix(1, 0.6, smooth(0.2, -0.7, ny)), add(1, mul(lift, 0.35)));
  const look = op('normalize', [k.sub(op('positionWorld'), op('cameraPosition'))]);
  const trans = add(mul(op('pow', [op('saturate', [op('dot', [look, op('skyLightDirection')])]), 5]), 0.55), 0.08);
  const colour = mul(mul(mul(swz(map, 'xyz'), op('vertexColour')), [0.86, 0.92, 0.8]), shade);
  const occlusion = mix(1, swz(arm, 'x'), op('oneMinus', [mul(lift, 0.75)]));
  return { version: 1, kind: 'material', model: 'standard', budget: { nodes: 260, samplers: 3, instructions: 1100 }, nodes: k.nodes,
    doubleSided: true,
    params: { ...lent(FOREST_TEXTURES.cards), ...FADE_PARAMS },
    stages: {
      'vertex.offset': { offset, shadow: true },
      surface: {
        colour, alpha: swz(map, 'w'), alphaCutoff: 0.45,
        normal: op('normalize', [mix(bent, up, mul(lift, 0.5))]), roughness: 0.92, metalness: 0, occlusion, discard: dissolve(k, root, 1),
        // the glow through the crown and the fill, occluded like the indirect light they join
        emissive: mul(mul(colour, add(mul(op('skyLightColour'), mul(trans, 0.35)), 0.04)), occlusion),
      },
    } };
}

/**
 * The impostor crosses (the far band): the albedo + normal atlas, the alpha sharpened by its own derivative, the quad's
 * normal on both faces with the atlas's frame mirrored on a back face (so a back face reads the bake's normals, not a
 * pale sky sheen); E322 F-L3 B: seen from above the normal leans to the sky and the albedo lifts toward the sunlit top
 * the side bake lacks. A little fill (emitted); dissolving in over the band its LOD before dissolves out of.
 */
function farGraph(): GraphIr {
  const k = kit(), { op, add, sub, mul, mix, swz, tex } = k;
  const { offset, root } = sway(k, false);
  const uv = op('uv'), map = tex('farMap', uv), a = swz(map, 'w');
  const face = op('select', [op('frontFacing'), 1, -1]), down = lookingDown(k);
  const n = mul(perturb(k, op('normalize', [op('normalWorld')]), unpack(k, tex('farNormal', uv), 1), face), face);
  const farColour = mul(mul(swz(map, 'xyz'), [0.92, 0.95, 0.9]), add(1, down));
  const sharp = op('saturate', [add(op('div', [sub(a, 0.3), op('max', [op('fwidth', [a]), 1e-4])]), 0.5)]);
  return { version: 1, kind: 'material', model: 'standard', budget: { nodes: 200, samplers: 2, instructions: 900 }, nodes: k.nodes,
    doubleSided: true,
    params: { ...lent(FOREST_TEXTURES.far), ...FADE_PARAMS },
    stages: {
      'vertex.offset': { offset },
      surface: {
        colour: farColour, alpha: sharp, alphaCutoff: 0.5, emissive: mul(farColour, 0.06),
        normal: op('normalize', [mix(n, [0, 1, 0], mul(down, 0.8))]), roughness: 0.96, metalness: 0, discard: dissolve(k, root, -1),
      },
    } };
}

/** the forest's graphs by look.materials id (one card graph twice: the needles and the twigs dissolve on their own bands) */
export const FOREST_GRAPHS: Readonly<Record<string, GraphIr>> = {
  [FOREST_LOOKS.bark]: barkGraph(), [FOREST_LOOKS.needles]: cardGraph(), [FOREST_LOOKS.twigs]: cardGraph(), [FOREST_LOOKS.far]: farGraph(),
};
