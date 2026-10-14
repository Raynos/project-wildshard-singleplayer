import type { GraphIr, GraphNode, GraphParam, GraphRef } from '@wildshard/format/materialGraph';

/**
 * Pine Hollow's photoreal water (PINE-HOLLOW-REMASTER PH-L9; SHARD-PLATFORM W2 C2) as SF59 material graphs: the pond, the
 * creek and beaver pool, the dam's trickle and the rain's puddles all wear one program (the four ids differ only in their
 * params), compiled by runtime/looks/water.ts. No extra render pass:
 *
 *   · REFLECTION = the scene's environment (the clock's sky) along the rippled reflected ray, Fresnel F0 0.02 (water's
 *     ior 1.333). Where the reflected ray would hit the shore instead of the sky its radiance is the forest's: on the pond an
 *     analytic SKYLINE probe (a lent 1-D texture round the pond's centre: per azimuth the height, distance and albedo of the
 *     tallest thing on the horizon, intersected per pixel as a cylinder); on running water a plain elevation cutoff.
 *   · RIPPLES: three scales of one lent tiling normal map drift downwind, their strength and the roughness follow the wind's
 *     gusts; on running water the map rides the flow (uv.y is travel time, so it scrolls downstream at one rate everywhere).
 *     Rain adds rings up close and a rougher surface far off (`rain`, 0 … 1).
 *   · BODY: the per-vertex depth gives the opacity (Beer–Lambert, `kAbs` per metre) and tint (peaty shallow → dark deep);
 *     blended as `a = F + aBody − F·aBody` so the Fresnel reflection is never scaled away by the alpha.
 *   · FOAM: the map's alpha thresholded by a per-vertex amount (the dam, the fall, the plunge ring) plus a broken scum line
 *     at the shore, lit as a white diffuse layer. WET LINE: vertices just above the water (depth < 0) draw a dark glossy film.
 *
 * The lighting stage owns the whole light: the sun's diffuse and GGX glint (shadowed), the sky's diffuse and its reflection
 * (`radiance`, swapped for the forest where occluded); each term is divided by the alpha so the straight-alpha blend writes
 * (spec + body · aBody) over the bed. Vertex data: `uv` (still water: world x / z in metres; running water: across metres,
 * travel seconds), `aWater` vec4 = (depth m (< 0 the wet film), flowing 0 | 1, foam 0..1, kAbs per m (< 0 a foam-only
 * overlay)). Fogged half as much as the air (`vertex.scale.fog`).
 */

/** the look.materials ids: the pond (skyline), the creek and beaver pool, the dam's trickle (fading), the rain's puddles */
export const WATER_LOOKS = { pond: 'pine-water-pond', creek: 'pine-water-creek', trickle: 'pine-water-trickle', puddle: 'pine-water-puddle' } as const;
export type WaterLook = keyof typeof WATER_LOOKS;

/** the skyline texture's encoding: R = occluder top above the water (/ top m), G = its distance (/ dist m), B = the
 *  bank's albedo where the ground is the occluder (/ bank; 0 = a tree crown, drawn with the forest's albedo) */
export const SKYLINE = { top: 80, dist: 400, bins: 512, bank: 0.5, earth: 0.12, rock: 0.3 } as const;

/** linear colours: the forest's albedo in the reflection, the water's scatter colour shallow and deep */
const FOREST = [0.035, 0.052, 0.03], SHALLOW = [0.042, 0.04, 0.02], DEEP = [0.005, 0.01, 0.008];
const INV_PI = 1 / Math.PI;

function waterGraph(sinEl: number, skyline: boolean, puddle: boolean): GraphIr {
  const nodes: Record<string, GraphNode> = {};
  let next = 0;
  const op = (name: string, inputs?: readonly GraphRef[], extra?: Omit<GraphNode, 'op' | 'in'>): string => {
    const id = `w${String(next++)}`; nodes[id] = { op: name, ...(inputs === undefined ? {} : { in: inputs }), ...extra }; return id;
  };
  const add = (a: GraphRef, b: GraphRef): string => op('add', [a, b]), sub = (a: GraphRef, b: GraphRef): string => op('sub', [a, b]);
  const mul = (a: GraphRef, b: GraphRef): string => op('mul', [a, b]), div = (a: GraphRef, b: GraphRef): string => op('div', [a, b]);
  const swz = (a: GraphRef, mask: string): string => op('swizzle', [a], { mask }), param = (name: string): string => op('param', undefined, { param: name });
  const mix = (a: GraphRef, b: GraphRef, t: GraphRef): string => op('mix', [a, b, t]), sstep = (a: GraphRef, b: GraphRef, x: GraphRef): string => op('smoothstep', [a, b, x]);
  const clamp01 = (a: GraphRef): string => op('saturate', [a]), dot = (a: GraphRef, b: GraphRef): string => op('dot', [a, b]);
  const sqrt = (a: GraphRef): string => op('pow', [op('max', [a, 0]), 0.5]), tex = (name: string, at: GraphRef): string => op('texture', [at], { param: name });
  const hash = (c: GraphRef): string => op('fract', [mul(op('sin', [dot(c, [12.9898, 78.233])]), 43758.5453)]);

  const water = op('attribute', undefined, { name: 'aWater', type: 'vec4' });
  const depthW = swz(water, 'x'), flowK = swz(water, 'y'), kAbs = swz(water, 'w');
  const pw = op('positionWorld'), eye = op('cameraPosition'), uvm = op('uv'), T = op('windTime'), wd = op('windDirection');
  const rain = param('rain');
  const gust = op('clamp', [op('varying', [op('windGustAt', [swz(pw, 'xz')])]), 0, 1.2]);
  // still water: three scales drift downwind; running water: all ride the flow (uv.y = travel time × 1 m/s)
  const along = (k: number): string => op('combine', [0, mul(T, k)]);
  const sA = mix(mul(wd, mul(T, 0.09)), along(1), flowK);
  const sB = mix(add(mul(op('combine', [op('negate', [swz(wd, 'y')]), swz(wd, 'x')]), mul(T, 0.03)), mul(wd, mul(T, 0.05))), along(0.8), flowK);
  const sC = mix(mul(wd, mul(T, 0.22)), along(1.15), flowK);
  const tA = tex('ripples', mul(sub(uvm, sA), 1 / 4.7)), tB = tex('ripples', add(mul(sub(uvm, sB), 1 / 11.3), 0.37)), tC = tex('ripples', add(mul(sub(uvm, sC), 1 / 1.63), 0.71));
  const slopeOf = (t: string): string => sub(mul(swz(t, 'xy'), 2), 1);
  const slope = add(add(slopeOf(tA), mul(slopeOf(tB), 0.9)), mul(slopeOf(tC), 0.45));
  const dist = op('length', [sub(pw, eye)]);
  const strength = div(mix(add(0.025, mul(mul(gust, gust), 0.3)), 0.26, flowK), add(1, mul(dist, 0.012)));
  // rain rings: two offset lattices of ~0.5 m cells, each a drop at a random time and spot (the slope of the ring's wave);
  // up close only (past ~25 m they are sub-pixel: there the rain is a rougher surface instead)
  let rings: string | number[] = [0, 0];
  for (let k = 0; k < 2; k++) {
    const q = add(mul(swz(pw, 'xz'), 2.1), [0.37 * k, 0.61 * k]);
    const cell = op('floor', [q]), f = sub(op('fract', [q]), 0.5), h = hash(add(cell, 17 * k));
    const t = op('fract', [add(mul(T, 0.85), h)]);
    const d = sub(f, mul(sub(op('combine', [hash(add(cell, 3.1)), hash(add(cell, 7.7))]), 0.5), 0.4));
    const r = op('length', [d]), R = mul(t, 0.42), e = mul(sub(r, R), 26), fade = op('oneMinus', [t]);
    const w = mul(mul(op('exp', [op('negate', [mul(e, e)])]), op('sin', [mul(sub(r, R), 45)])), mul(fade, fade));
    rings = add(rings, mul(mul(div(d, op('max', [r, 1e-3])), w), op('step', [mul(h, 0.999), rain])));
  }
  const far = sstep(4, 15, dist);
  const rainS = mul(rings, mul(mul(op('oneMinus', [mul(flowK, 0.6)]), 0.4), op('oneMinus', [far])));
  const mapN = op('normalize', [op('combine', [add(mul(slope, strength), rainS), 1])]);
  // the derivative tangent frame of uv (three's perturbNormal2Arb, in world space); a degenerate frame or a NaN falls back
  const ng = op('normalize', [op('normalWorld')]);
  const q0 = op('dFdx', [pw]), q1 = op('dFdy', [pw]), st0 = op('dFdx', [uvm]), st1 = op('dFdy', [uvm]);
  const q1p = op('cross', [q1, ng]), q0p = op('cross', [ng, q0]);
  const tg = add(mul(q1p, swz(st0, 'x')), mul(q0p, swz(st1, 'x'))), bt = add(mul(q1p, swz(st0, 'y')), mul(q0p, swz(st1, 'y')));
  const scale = div(1, sqrt(op('max', [op('max', [dot(tg, tg), dot(bt, bt)]), 1e-20])));
  const rippled = op('normalize', [add(add(mul(tg, mul(swz(mapN, 'x'), scale)), mul(bt, mul(swz(mapN, 'y'), scale))), mul(ng, swz(mapN, 'z')))]);
  const normal = op('select', [op('gt', [dot(rippled, rippled), 0.5]), rippled, ng]);
  // gusts roughen still water (the reflection blurs under a front); running water is always a little rough; rain roughens
  const rough = add(mix(add(0.025, mul(gust, 0.09)), 0.08, flowK), mul(rain, add(0.03, mul(far, 0.07))));
  // foam: a noise channel thresholded by the vertex's amount, plus the shore's broken scum line on still water; on running
  // water a finer, faster layer breaks it into streaks and clumps
  const fS = swz(tex('ripples', add(op('combine', [mul(swz(uvm, 'x'), 1 / 1.1), mul(sub(swz(uvm, 'y'), T), 1 / 0.32)]), 0.53)), 'w');
  const aA = swz(tA, 'w'), aC = swz(tC, 'w');
  const fN = mix(add(mul(aA, 0.6), mul(aC, 0.4)), add(add(mul(aA, 0.35), mul(aC, 0.25)), mul(fS, 0.4)), flowK);
  const foam = clamp01(swz(water, 'z'));
  const shore = mul(mul(mul(op('oneMinus', [flowK]), sstep(0.3, 0.04, depthW)), op('step', [0, depthW])), 0.45);
  const lip = op('oneMinus', [foam]);
  const wf = clamp01(add(mul(mul(sstep(lip, add(lip, 0.3), fN), op('step', [0.001, foam])), 0.92), mul(sstep(0.62, 0.8, fN), shore)));
  const tint = mix(SHALLOW, DEEP, sstep(0.2, 3, depthW));

  // the compose: Fresnel (the map's top-down shot reads as most of the sky), the body's opacity, foam over it
  const view = op('normalize', [sub(eye, pw)]);
  const nDotV = clamp01(dot(normal, view));
  const f0 = add(0.02, mul(op('pow', [op('oneMinus', [nDotV]), 5]), 0.98));
  const topDown = param('topDown'), fresnel = mix(f0, 0.7, topDown);
  const specMul = mix(1, div(fresnel, op('max', [f0, 1e-3])), topDown);
  const aBody = op('oneMinus', [op('exp', [op('negate', [mul(op('max', [depthW, 0]), op('max', [kAbs, 0]))])])]);
  const a = sub(add(fresnel, aBody), mul(fresnel, aBody));
  const aF = add(wf, mul(a, op('oneMinus', [wf])));
  const overlay = op('lt', [kAbs, -0.5]), wet = op('lt', [depthW, 0]);
  const invA = div(1, op('max', [aF, 1e-3]));
  // what multiplies the light falling on the surface (the body's scatter, the foam) and the specular, per fragment
  const bodyK = op('select', [wet, [0, 0, 0], op('select', [overlay, [0.55, 0.55, 0.55], mul(add(mul(tint, mul(aBody, op('oneMinus', [wf]))), mul(wf, 0.55)), invA)])]);
  const specK = mul(op('select', [wet, 1.4, op('select', [overlay, 0, mul(op('oneMinus', [wf]), invA)])]), specMul);
  const edge = sstep(0, 0.05, sub(depthW, mul(mul(flowK, 0.1), op('oneMinus', [fS]))));
  const wetA = mul(mul(sstep(0, -0.05, depthW), op('oneMinus', [sstep(-0.4, -0.12, depthW)])), 0.35);
  const alpha = clamp01(mul(op('select', [wet, wetA, op('select', [overlay, mul(wf, clamp01(depthW)), mul(aF, edge)])]), param('fade')));

  // where the reflected ray (off the rippled normal, so the shore's mirror wavers) meets the shore: the skyline's cylinder
  // on the pond, else the elevation cutoff; and the occluder's albedo there (the trees', or the bank's earth / the rock)
  const rg = sub(mul(normal, mul(dot(normal, view), 2)), view), rxz = swz(rg, 'xz'), horiz = op('length', [rxz]);
  const skyC = param('skyC');
  const dir = div(rxz, op('max', [horiz, 1e-4]));
  const skyAt = (p: GraphRef): string => mul(swz(tex('skyline', op('combine', [add(mul(op('atan', [swz(p, 'y'), swz(p, 'x')]), 0.1591549), 0.5), 0.5])), 'xyz'), [SKYLINE.top, SKYLINE.dist, SKYLINE.bank]);
  const o = sub(swz(pw, 'xz'), swz(skyC, 'xy'));
  let s = skyAt(dir), t: GraphRef = 0;
  for (let i = 0; i < 2; i++) {
    const b = dot(o, dir), c = sub(dot(o, o), mul(swz(s, 'y'), swz(s, 'y')));
    t = op('max', [0, add(op('negate', [b]), sqrt(sub(mul(b, b), c)))]);
    s = skyAt(add(o, mul(dir, t)));
  }
  const yAt = add(sub(swz(pw, 'y'), swz(skyC, 'z')), mul(div(swz(rg, 'y'), op('max', [horiz, 1e-3])), t));
  const skyOn = param('skyOn');
  const occ = mix(sstep(add(param('sinEl'), 0.07), sub(param('sinEl'), 0.07), swz(rg, 'y')), sstep(add(swz(s, 'x'), 1.6), sub(swz(s, 'x'), 1.2), yAt), skyOn);
  const shoreAlb = mix(FOREST, op('max', [FOREST, mul([1, 0.95, 0.88], swz(s, 'z'))]), skyOn);
  // the trees facing the water, lit by the sun on their crowns (they face back along the reflected ray, tipped up)
  const crown = op('normalize', [op('combine', [op('negate', [swz(rg, 'x')]), 0.35, op('negate', [swz(rg, 'z')])])]);

  // the sun: its diffuse on the body and foam, the GGX glint, the sunlit crowns in the reflection (all shadowed)
  const L = op('sunDirection'), nV = op('normalView'), vV = op('viewDirection');
  const sunIn = mul(op('sunColour'), op('sunShadow'));
  const nDotL = clamp01(dot(nV, L)), hV = op('normalize', [add(L, vV)]), nDotH = clamp01(dot(nV, hV)), vDotH = clamp01(dot(vV, hV));
  const r = op('min', [op('max', [rough, 0.0525]), 1]), a2 = mul(mul(r, r), mul(r, r));
  const dd = add(mul(mul(nDotH, nDotH), sub(a2, 1)), 1);
  const ggxD = div(mul(a2, INV_PI), op('max', [mul(dd, dd), 1e-7]));
  const nvV = clamp01(dot(nV, vV)), oneA = op('oneMinus', [a2]);
  const vis = div(0.5, op('max', [add(mul(nDotL, sqrt(add(mul(mul(nvV, nvV), oneA), a2))), mul(nvV, sqrt(add(mul(mul(nDotL, nDotL), oneA), a2)))), 1e-6]));
  const fVH = add(0.02, mul(op('pow', [op('oneMinus', [vDotH]), 5]), 0.98));
  const glint = mul(mul(mul(ggxD, vis), fVH), specK);
  const crownLit = mul(mul(mul(shoreAlb, INV_PI * 0.6), clamp01(dot(crown, op('viewToWorld', [L])))), mul(mul(f0, occ), specK));
  const sun = add(mul(mul(sunIn, nDotL), add(mul(op('albedo'), INV_PI), glint)), mul(sunIn, crownLit));
  // the sky: its diffuse on the body and foam, and its reflection (the forest's where the ray meets the shore)
  const envIrr = op('environmentIrradiance');
  const forest = mul(shoreAlb, mul(envIrr, INV_PI * 0.75));
  const ambient = add(mul(op('albedo'), mul(add(op('irradiance'), envIrr), INV_PI)), mul(mix(op('radiance'), forest, occ), mul(f0, specK)));

  const lent = (slot: string): GraphParam => ({ type: 'texture', value: slot, role: 'lent' });
  return {
    version: 1, kind: 'material', model: 'standard', budget: { nodes: 1200, samplers: 2, instructions: 2200 },
    effectState: { blend: 'alpha', depthWrite: false, ...(puddle ? { depthBias: { factor: -2, units: -4 } } : {}) },
    params: {
      ripples: lent('water-ripples'), skyline: lent('water-skyline'),
      skyC: { type: 'vec4', value: [0, 0, 0, 0], min: -100000, max: 100000 },
      skyOn: { type: 'float', value: skyline ? 1 : 0, min: 0, max: 1 }, sinEl: { type: 'float', value: sinEl, min: -1, max: 1 },
      fade: { type: 'float', value: 1, min: 0, max: 1 }, rain: { type: 'float', value: 0, min: 0, max: 1 }, topDown: { type: 'float', value: 0, min: 0, max: 1 },
    },
    nodes, stages: { 'vertex.scale': { fog: 0.5 }, surface: { colour: bodyK, alpha, roughness: r, metalness: 0, normal },
      lighting: { sun, ambient } },
  };
}

/** The water's graphs by look.materials id. */
export const WATER_GRAPHS: Readonly<Record<string, GraphIr>> = {
  [WATER_LOOKS.pond]: waterGraph(0.22, true, false), [WATER_LOOKS.creek]: waterGraph(0.3, false, false),
  [WATER_LOOKS.trickle]: waterGraph(0.3, false, false), [WATER_LOOKS.puddle]: waterGraph(0.12, false, true),
};
