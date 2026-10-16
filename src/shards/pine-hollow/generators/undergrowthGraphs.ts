// Pine Hollow's undergrowth look graphs, built at build time (SHARD-PLATFORM W2c): emitted into
// data/lookMaterials.generated.json by ./lookMaterials.ts; the ids and rows the play code reads stay in ../data/undergrowthLook.ts.
import type { GraphIr, GraphNode, GraphRef } from '@wildshard/format/materialGraph';

/** One graph's node table and its builders (ids `u0`, `u1`, …). */
function kit() {
  const nodes: Record<string, GraphNode> = {};
  let next = 0;
  const op = (name: string, inputs?: readonly GraphRef[], extra?: Omit<GraphNode, 'op' | 'in'>): string => {
    const id = `u${String(next++)}`; nodes[id] = { op: name, ...(inputs === undefined ? {} : { in: inputs }), ...extra }; return id;
  };
  const add = (a: GraphRef, b: GraphRef): string => op('add', [a, b]), sub = (a: GraphRef, b: GraphRef): string => op('sub', [a, b]);
  const mul = (a: GraphRef, b: GraphRef): string => op('mul', [a, b]), swz = (a: GraphRef, mask: string): string => op('swizzle', [a], { mask });
  const param = (name: string): string => op('param', undefined, { param: name });
  return { nodes, op, add, sub, mul, swz, param };
}

/**
 * The ground cover: three's standard model over the kind's painted texture (`meshMap`) and its copy's tint, darker at
 * the root (the card's height is uv.y), cut at the material's alpha test, both faces lit by the front normal.
 * The vertex stage scales each copy to nothing past `fade` (x the far edge, y the band, metres from `viewer`: the
 * player, so the shadow passes fade as the lit one does; `shift` the floor's world offset, the copy's origin being
 * its instance's) and sways it in the wind: a swell running down the wind, the
 * gust front, a small flutter, weighted by height² and by the geometry's `aWind`, dipping as it leans. The shadow depth
 * takes the same fade, sway and cut. The light keeps the physical sun (and its specular) and adds a back-light from the
 * sun (the atmosphere's sun direction, which the sky keeps on its light; `sunTint`: the sky's, set each frame) to the
 * ambient.
 */
function coverGraph(): GraphIr {
  const k = kit(), { op, add, sub, mul, swz, param } = k;
  // the vertex: the copy's fade by the player's distance, then the sway
  const origin = op('objectOrigin'), local = sub(origin, param('shift')), fade = param('fade');
  const dist = op('length', [sub(origin, param('viewer'))]);
  const keep = op('oneMinus', [op('smoothstep', [sub(swz(fade, 'x'), swz(fade, 'y')), swz(fade, 'x'), dist])]);
  const rel = sub(op('positionLocal'), local);
  const at = add(origin, mul(rel, keep)), ax = swz(at, 'x'), az = swz(at, 'z');
  const dir = op('windDirection'), t = op('windTime');
  const swell = add(mul(op('sin', [sub(mul(t, 1.25), mul(op('dot', [swz(at, 'xz'), dir]), 0.32))]), 0.5), 0.5);
  const gust = mul(mul(op('min', [op('windGustAt', [swz(at, 'xz')]), 1.3]), add(0.35, mul(0.65, mul(swell, swell)))), 1.25);
  const flutter = op('sin', [add(add(mul(t, 5), mul(ax, 3)), mul(az, 2))]);
  const amp = mul(mul(add(0.01, mul(gust, 0.05)), op('attribute', undefined, { name: 'aWind', type: 'float' })), 4);
  const h = swz(op('uv'), 'y');
  const ox = add(mul(swz(dir, 'x'), amp), mul(flutter, 0.006)), oz = add(mul(swz(dir, 'y'), amp), mul(flutter, 0.004));
  const lean = op('combine', [ox, mul(op('length', [op('combine', [ox, oz])]), -0.3), oz]);
  const offset = add(mul(rel, sub(keep, 1)), mul(lean, mul(mul(h, h), keep)));
  // the surface: the painted texture, darker at the root
  const map = op('meshMap');
  const colour = mul(swz(map, 'xyz'), op('mix', [0.55, 1, op('smoothstep', [0, 0.5, swz(op('uv'), 'y')])]));
  // the light: the physical sun, and the ambient plus a back-light from the sun
  const albedo = op('albedo');
  const sun = mul(mul(mul(mul(albedo, op('sunColour')), op('saturate', [op('dot', [op('normalView'), op('sunDirection')])])), op('sunShadow')), 1 / Math.PI);
  const back = op('pow', [op('saturate', [op('dot', [op('viewToWorld', [op('viewDirection')]), op('atmosphereSunDirection')])]), 5]);
  const ambient = add(mul(mul(op('irradiance'), albedo), 1 / Math.PI), mul(mul(albedo, add(0.05, mul(back, 0.35))), param('sunTint')));
  const big = 1e6;
  return { version: 1, kind: 'material', model: 'standard', budget: { nodes: 160, samplers: 1, instructions: 480 }, doubleSided: true, flipBackfaceNormals: false,
    params: {
      viewer: { type: 'vec3', value: [0, 0, 0], min: -big, max: big },
      shift: { type: 'vec3', value: [0, 0, 0], min: -big, max: big },
      fade: { type: 'vec2', value: [60, 18], min: 0, max: 10000 },
      sunTint: { type: 'vec3', value: [1, 0.93, 0.8], min: 0, max: 64 },
    },
    nodes: k.nodes,
    stages: { 'vertex.offset': { offset, shadow: true }, surface: { colour, alpha: swz(map, 'w'), alphaCutoff: 0.5 }, lighting: { sun, sunSpecular: 1, ambient } } };
}

/** All six kinds borrow one compiled graph and keep their own mapped textures. */
export const UNDER_GRAPHS: Readonly<Record<string, GraphIr>> = { 'pine-undergrowth': coverGraph() };
