import type { GraphIr, GraphNode, GraphParam, GraphRef } from '@wildshard/format/materialGraph';

/**
 * Driftwood's open sea (runtime/looks/facetedOcean.ts, world/Ocean.ts) as an SF59 material graph (SHARD-PLATFORM W2 C2;
 * the shardfile's `look.materials`, compiled by the hybrid runtime with the reef and the pools). The toon family's light
 * model (the catalogue's live toon look, following the day clock: look/toon.ts `followToon`) without its caustics
 * (`toonCaustics: false`: none on the sea surface itself), double-sided in one pass, alpha blended, depth written.
 *
 * - **vertex**: the shared Gerstner swell (`gerstner`, the same coefficients the boats and swimmers read) on the frame's
 *   wave clock (`clock`, the runtime's), damped over the sand from the vertex's still depth (`aDepth`, waves.ts
 *   `seaDamp`), plus a small lateral wobble per vertex (`aSeed`) so the grid never reads as a grid. The lighting normal
 *   is the waves' own smooth normal (`gerstnerNormal` at the rest point, E151), not the grid facet's.
 * - **water body**: the sea floor under the pixel from the lent sea-floor texture (`tSea`: R floor height, G obstacle
 *   proximity; off the chunk the edge's floor sinks over 260 m), Beer–Lambert opacity from the view path through the
 *   column, turquoise lagoon → cobalt by still depth, graded by the per-pixel wave normal in hard 10 % steps one pixel
 *   wide (fwidth), tinted deep teal-blue at night (`night`, the day clock's toon night).
 * - **foam** (W2): three thin broken lace lines breathing with the swell along the shore, rings round whatever stands in
 *   the water (from the G proximity field, wobbled wider than a texel), sparse caps on the highest crests out deep.
 * - **reflection and glint**, added after lighting through `emissive`: a Schlick-fresnel reflection of the fog ramp's
 *   horizon → zenith and a crisp sun glint that sparkles cell by cell; foam reads sun white. From below (W4): Snell's
 *   window, the sky inside ~49° of straight up, the deep water's mirror outside it.
 * - **edges**: discarded outside the level's open-water square less its inset (`waterHalf`, `edgeInset`) and inside the
 *   four dry entry sockets (`dry0` … `dry3`: minX, minZ, maxX, maxZ; an empty rectangle clips nothing); faded out over
 *   the last 300 m before the painted horizon (`seaEnd`).
 *
 * The classic sea was premultiplied (lit body × alpha + reflection); straight alpha with `emissive` = reflection / alpha
 * is the same colour after the fog epilogue and the blend.
 */

/** the look.materials id the sea wears */
export const OCEAN_LOOK = 'driftwood-ocean';
/** the dry rectangles the sea can clip (params `dry0` … `dry3`) */
export const OCEAN_DRY_SLOTS = 4;
/** an empty dry rectangle (min past max): clips nothing */
export const OCEAN_NO_DRY: readonly [number, number, number, number] = [1e9, 1e9, -1e9, -1e9];

/** the sea-floor texture's resolution (runtime/looks/facetedOcean.ts bakes it): one texel over in each axis */
const SEA_TEXEL = 1 / 512;

function oceanGraph(): GraphIr {
  const nodes: Record<string, GraphNode> = {};
  let next = 0;
  const op = (name: string, inputs?: readonly GraphRef[], extra?: Omit<GraphNode, 'op' | 'in'>): string => {
    const id = `o${String(next++)}`; nodes[id] = { op: name, ...(inputs === undefined ? {} : { in: inputs }), ...extra }; return id;
  };
  const add = (a: GraphRef, b: GraphRef): string => op('add', [a, b]), sub = (a: GraphRef, b: GraphRef): string => op('sub', [a, b]);
  const mul = (a: GraphRef, b: GraphRef): string => op('mul', [a, b]), div = (a: GraphRef, b: GraphRef): string => op('div', [a, b]);
  const max = (a: GraphRef, b: GraphRef): string => op('max', [a, b]), mix = (a: GraphRef, b: GraphRef, f: GraphRef): string => op('mix', [a, b, f]);
  const ss = (e0: GraphRef, e1: GraphRef, x: GraphRef): string => op('smoothstep', [e0, e1, x]);
  const clamp = (x: GraphRef, lo: GraphRef, hi: GraphRef): string => op('clamp', [x, lo, hi]);
  const step = (edge: GraphRef, x: GraphRef): string => op('step', [edge, x]), inv = (a: GraphRef): string => op('oneMinus', [a]);
  const fract = (a: GraphRef): string => op('fract', [a]), floor = (a: GraphRef): string => op('floor', [a]), abs = (a: GraphRef): string => op('abs', [a]);
  const sin = (a: GraphRef): string => op('sin', [a]), dot = (a: GraphRef, b: GraphRef): string => op('dot', [a, b]);
  const sw = (a: GraphRef, mask: string): string => op('swizzle', [a], { mask });
  const param = (name: string): string => op('param', undefined, { param: name });
  const varying = (a: GraphRef): string => op('varying', [a]);
  // hash21 / vnoise as the classic sea had them: a fract-dot hash and smooth value noise over its four corners
  const hash21 = (p: GraphRef): string => {
    const q = fract(mul(p, [123.34, 456.21])), r = add(q, dot(q, add(q, 45.32)));
    return fract(mul(sw(r, 'x'), sw(r, 'y')));
  };
  const vnoise = (p: GraphRef): string => {
    const i = floor(p), f = fract(p), u = mul(mul(f, f), sub(3, mul(f, 2))), ux = sw(u, 'x');
    return mix(mix(hash21(i), hash21(add(i, [1, 0])), ux), mix(hash21(add(i, [0, 1])), hash21(add(i, [1, 1])), ux), sw(u, 'y'));
  };

  // ── vertex: the swell, the wobble, and what the fragment reads ──
  const clock = param('clock'), geom = op('positionGeometry'), gxz = sw(geom, 'xz'), origin = op('objectOrigin');
  const seed = mul(op('attribute', undefined, { name: 'aSeed', type: 'float' }), 6.2831);
  const damp = add(0.35, mul(0.65, ss(0, 1.5, op('attribute', undefined, { name: 'aDepth', type: 'float' }))));   // waves.ts seaDamp()
  const g = op('gerstner', [gxz, clock, damp]);
  const wobble = op('combine', [mul(sin(add(mul(clock, 0.7), seed)), 0.3), 0, mul(op('cos', [add(add(mul(clock, 0.6), seed), 1.7)]), 0.3)]);
  const offset = add(g, wobble);
  const restV = add(sw(origin, 'xz'), gxz);   // E151: the rest point the normals are taken at
  const vCrest = varying(div(sw(g, 'y'), max(damp, 0.35))), vRest = varying(restV), vDamp = varying(damp);
  const vW = varying(add(add(origin, geom), offset));

  // ── the water body ──
  const chunkHalf = param('chunkHalf'), level = param('level'), shallow = param('shallow'), deep = param('deep');
  const wxz = sw(vW, 'xz'), camera = op('cameraPosition');
  const tSea = (uv: GraphRef): string => op('texture', [uv], { param: 'tSea' });
  const outD = op('length', [max(sub(abs(wxz), chunkHalf), 0)]), inC = step(outD, 0);
  const cuv = clamp(div(add(wxz, chunkHalf), mul(chunkHalf, 2)), 0.001, 0.999);
  const sea = tSea(cuv), seaR = sw(sea, 'x'), seaG = sw(sea, 'y');
  const floorY = mix(seaR, sub(level, 30), ss(0, 260, outD));
  const still = sub(level, floorY);                                // depth below the still level
  const column = max(sub(sw(vW, 'y'), floorY), 0);                 // the water column under the wave
  // metres to the water line: the depth over the local floor slope (two more fetches one texel over)
  const hx = sw(tSea(add(cuv, [SEA_TEXEL, 0])), 'x'), hz = sw(tSea(add(cuv, [0, SEA_TEXEL])), 'x');
  const slope = div(op('length', [op('combine', [sub(hx, seaR), sub(hz, seaR)])]), mul(chunkHalf, 2 * SEA_TEXEL));
  const shoreD = div(still, max(slope, 0.012));
  const V = op('normalize', [sub(camera, vW)]);
  const fn = op('gerstnerNormal', [vRest, clock, vDamp]), fnV = dot(fn, V);
  const opac = inv(op('exp', [mul(div(column, max(abs(sw(V, 'y')), 0.22)), -0.85)]));   // Beer–Lambert over the view path
  const depthT = ss(0, 1, op('pow', [clamp(div(still, param('deepDepth')), 0, 1), 0.9]));
  // the swell's grade from the smooth normal, banded into hard-edged 10 % steps, each edge one pixel wide
  const gr = mul(add(mul(sw(fn, 'x'), 4.2), mul(sw(fn, 'z'), 2.6)), 26);
  const gw = clamp(op('fwidth', [gr]), 0.02, 0.5);
  const banded = add(floor(gr), ss(sub(0.5, gw), add(0.5, gw), fract(gr)));
  const graded = mul(mix(shallow, deep, depthT), clamp(add(1, mul(banded, 0.1)), 0.58, 1.48));
  const water = mix(graded, mul(graded, [0.12, 0.3, 0.75]), param('night'));   // a moonlit sea is deep teal-blue

  // ── foam (W2) ──
  const n = vnoise(add(mul(wxz, 0.55), mul(clock, 0.15)));
  const d0 = sub(add(shoreD, mul(sin(add(mul(clock, 1.1), dot(wxz, [0.07, 0.05]))), 0.3)), mul(vCrest, 0.8));   // breathes with the swell
  const l1 = mul(mul(ss(-0.05, 0.05, d0), inv(ss(0.22, 0.36, d0))), step(0.34, vnoise(add(mul(wxz, 1.7), op('combine', [mul(clock, 0.3), 0])))));
  const ph = fract(add(mul(clock, 0.16), mul(n, 0.15)));
  const l2 = mul(mul(inv(ss(0.1, 0.28, abs(sub(d0, mix(3, 0.9, ph))))), step(0.42, vnoise(add(mul(wxz, 0.9), 7)))), inv(mul(ph, 0.6)));
  const l3 = mul(mul(inv(ss(0.08, 0.22, abs(sub(d0, mix(5, 2.2, fract(add(ph, 0.5))))))), step(0.55, vnoise(add(mul(wxz, 0.7), 13)))), 0.8);
  const lace = mul(mul(mul(max(l1, max(l2, l3)), inC), inv(ss(6, 9, shoreD))), step(0, still));   // never where a crest pokes over the sand
  // rings round what stands in the water (E125): the ~1 m-texel proximity back in metres, wobbled wider than a texel
  const od = add(add(mul(inv(seaG), 3), mul(sub(n, 0.5), 0.5)), mul(sub(vnoise(sub(mul(wxz, 1.3), mul(clock, 0.2))), 0.5), 0.35));
  const rn = vnoise(add(mul(wxz, 2.4), op('combine', [mul(clock, 0.35), mul(clock, -0.25)])));
  const r1 = mul(inv(ss(0.22, 0.3, sub(od, mul(vCrest, 0.4)))), step(0.42, rn));
  const rp = fract(add(mul(clock, 0.3), mul(n, 0.25)));
  const r2 = mul(mul(mul(inv(ss(0.05, 0.14, abs(sub(od, mix(0.45, 1.9, rp))))), step(0.5, rn)), inv(rp)), 0.9);
  const ring = mul(mul(max(r1, r2), ss(0, 0.12, seaG)), inC);
  const cap = mul(mul(mul(ss(0.2, 0.26, vCrest), step(0.62, vnoise(add(mul(wxz, 0.2), 3.1)))), ss(2.5, 8, still)), 0.85);
  const foam = clamp(max(max(lace, ring), cap), 0, 1);

  // ── reflection + glint, added after lighting ──
  const sunC = op('atmosphereSunColour'), fogC = op('fogColour'), zenith = op('fogZenithColour');
  const R = sub(mul(fn, mul(fnV, 2)), V);   // reflect(−V, n)
  const skyR = mix(fogC, zenith, add(mul(op('pow', [ss(0, 0.75, max(sw(R, 'y'), 0)), 0.62]), 0.6), 0.4));   // biased to the zenith: no white wash
  const fres = add(0.02, mul(0.98, op('pow', [inv(clamp(fnV, 0, 1)), 5])));
  const sd = max(dot(R, op('atmosphereSunDirection')), 0);
  const sparkle = step(0.92, hash21(add(floor(mul(wxz, 1.3)), floor(mul(clock, 3)))));   // glints break up cell by cell
  const glint = add(mul(ss(0.994, 0.998, sd), sparkle), mul(op('pow', [sd, 60]), 0.08));
  const frontAdd = add(mul(add(mul(skyR, mul(fres, 0.14)), mul(sunC, glint)), inv(foam)), mul(sunC, mul(foam, 0.5)));   // foam reads white
  // from below (W4): Snell's window, the sky inside ~49° of straight up, the deep water's mirror outside it
  const snell = ss(0.6, 0.7, abs(fnV));
  const backAdd = mix(add(mul(deep, 1.6), mul(shallow, 0.15)), mul(mix(fogC, zenith, 0.5), 1.4), snell);
  const front = op('frontFacing');
  const waterAdd = op('select', [front, frontAdd, backAdd]);
  const waterA = op('select', [front, max(max(opac, foam), mul(fres, 0.3)), 1]);
  const colour = op('select', [front, mix(water, [1, 1, 1], foam), [0, 0, 0]]);

  // ── edges: the level's square, the dry sockets, the painted horizon ──
  const rx = sw(vRest, 'x'), rz = sw(vRest, 'y');
  let clip = op('gt', [max(abs(rx), abs(rz)), sub(param('waterHalf'), param('edgeInset'))]);
  for (let i = 0; i < OCEAN_DRY_SLOTS; i++) {
    const r = param(`dry${String(i)}`);
    const inside = op('and', [op('and', [op('gte', [rx, sw(r, 'x')]), op('gte', [rz, sw(r, 'y')])]), op('and', [op('lte', [rx, sw(r, 'z')]), op('lte', [rz, sw(r, 'w')])])]);
    clip = op('or', [clip, inside]);
  }
  const seaEndR = param('seaEnd');
  const seaEnd = inv(ss(sub(seaEndR, 300), seaEndR, op('length', [sub(wxz, sw(camera, 'xz'))])));
  const alpha = mul(clamp(waterA, 0, 1), seaEnd);
  const emissive = div(mul(waterAdd, seaEnd), max(alpha, 1e-3));

  const f = (value: number): GraphParam => ({ type: 'float', value });
  const params: Record<string, GraphParam> = {
    clock: f(0), level: f(0), deepDepth: f(9), chunkHalf: f(256), waterHalf: f(1e9), edgeInset: f(0), seaEnd: f(4000),
    night: { type: 'float', value: 0, min: 0, max: 1 },
    shallow: { type: 'vec3', value: [0.1, 0.6, 0.6] }, deep: { type: 'vec3', value: [0.02, 0.1, 0.3] },
    tSea: { type: 'texture', value: 'tSea', role: 'lent' },
  };
  for (let i = 0; i < OCEAN_DRY_SLOTS; i++) params[`dry${String(i)}`] = { type: 'vec4', value: [...OCEAN_NO_DRY] };
  return {
    version: 1, kind: 'material', model: 'toon', budget: { nodes: 760, samplers: 1, instructions: 1700 },
    doubleSided: true, flatShading: false, toonCaustics: false, effectState: { blend: 'alpha', depthWrite: true, singlePass: true },
    params, nodes,
    stages: {
      'vertex.offset': { offset },
      'vertex.normal': { normal: op('gerstnerNormal', [restV, clock, damp]) },
      surface: { colour, alpha, emissive, roughness: 0.9, metalness: 0, discard: clip },
    },
  };
}

/** The sea's graph by look.materials id. */
export const OCEAN_GRAPHS: Readonly<Record<string, GraphIr>> = { [OCEAN_LOOK]: oceanGraph() };
