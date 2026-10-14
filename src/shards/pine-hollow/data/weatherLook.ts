import type { GraphIr, GraphNode, GraphRef } from '@wildshard/format/materialGraph';

/**
 * Pine Hollow's rain as data (PH-L10, E322 F-L5; SHARD-PLATFORM M3): the sizes of the SDK rain system's pieces
 * (runtime/looks/rainFx — the curtain with the canopy's drips, the puddles, the splashes at the feet, the drops on
 * the lens) and the curtain's, the splashes' and the lens drops' SF59 material graphs (`RAIN_GRAPHS`, the shardfile's
 * look.materials; `PINE_RAIN_PROGRAMS` their ids). The cave's hood is the bear cave's mouth in its own frame (lx across,
 * lz into the rock; the mouth faces −lz): half width, from, to, height over the mouth's ground — the arch's opening is
 * 2.6 × 4.8 m (caveArch.ts `openCaveArch`); the cover map takes over at lz ≈ 1.5.
 */

/** The rain's sizes per tier: the cover map's texels, the streaks, the splash and lens-drop slots, the puddles. */
export const PINE_RAIN = {
  coverN: 256,
  streaks: { phone: 3200, desktop: 6000 },
  splashes: { phone: 64, desktop: 96 },
  lensDrops: { phone: 14, desktop: 20 },
  puddles: { trail: { phone: 55, desktop: 90 }, open: { phone: 36, desktop: 60 }, seg: 14, rings: [[0, 0.05], [0.55, 0.04], [1.0, 0.004], [1.12, -0.1], [1.35, -0.42]] },
} as const;

/** The bear cave's hood, where no rain falls (its frame is the layout's BEAR_CAVE). */
export const PINE_CAVE_HOOD = { hw: 3.2, lz0: -1.4, lz1: 4.5, up: 5.6 } as const;

/** the look.materials ids the rain's graphs are worn under: the curtain, the splashes at the feet, the drops on the lens */
export const PINE_RAIN_PROGRAMS = { rain: 'pine-rain-curtain', splash: 'pine-rain-splash', lens: 'pine-rain-lens' } as const;

/** One graph's node table and its builders (ids `r0`, `r1`, …). */
function kit() {
  const nodes: Record<string, GraphNode> = {};
  let next = 0;
  const op = (name: string, inputs?: readonly GraphRef[], extra?: Omit<GraphNode, 'op' | 'in'>): string => {
    const id = `r${String(next++)}`; nodes[id] = { op: name, ...(inputs === undefined ? {} : { in: inputs }), ...extra }; return id;
  };
  const add = (a: GraphRef, b: GraphRef): string => op('add', [a, b]), sub = (a: GraphRef, b: GraphRef): string => op('sub', [a, b]);
  const mul = (a: GraphRef, b: GraphRef): string => op('mul', [a, b]), swz = (a: GraphRef, mask: string): string => op('swizzle', [a], { mask });
  const ss = (a: GraphRef, b: GraphRef, x: GraphRef): string => op('smoothstep', [a, b, x]);
  /** GLSL's reversed smoothstep(b, a, x) for a < b */
  const fall = (a: GraphRef, b: GraphRef, x: GraphRef): string => op('oneMinus', [ss(a, b, x)]);
  const param = (name: string): string => op('param', undefined, { param: name });
  const attr = (name: string): string => op('attribute', undefined, { name, type: 'vec4' });
  return { nodes, op, add, sub, mul, swz, ss, fall, param, attr };
}

/**
 * The curtain: N streak quads (game/systems/looks/rainCurtain `rainCurtainGeometry`: the corner in `position`, the drop's
 * seed in `aSeed`) in a box of half-size `radius` round the eye, world-anchored by the wrapped `offset` (set each frame),
 * built here in the vertex stage. The cover map (`cover`, lent by the runtime: R the crowns, G the roofs; world x/z → uv
 * = p · `coverK` + 0.5) stops the rain under a roof and turns most of it under the crowns into short, straight drips.
 * No rain in the cave's hood (`cave`: x, z, cos yaw, sin yaw; `caveBox`: half width, lz from, lz to, the ceiling's world
 * y; all 0 with no hood). Each streak turns its width to the eye and fades at the box's walls and right at the eye. The
 * fog takes 0.6 of it (`vertex.scale`); `colour`, `alpha`, `velocity` and `length` follow the rain, the wind and the fog.
 */
function curtainGraph(): GraphIr {
  const k = kit(), { op, add, sub, mul, swz, ss, param } = k;
  const seed = k.attr('aSeed'), corner = op('positionGeometry'), cx = swz(corner, 'x'), cy = swz(corner, 'y'), speed = swz(seed, 'w');
  const R = param('radius'), box = mul(R, 2), eye = op('cameraPosition');
  const p = add(mul(swz(seed, 'xyz'), box), mul(param('offset'), speed));
  const c = add(eye, [0, 2, 0]);
  const w = add(sub(op('mod', [add(sub(p, c), R), box]), R), c);
  // the cover over this drop: a roof stops it; the crowns catch most of it and let the rest through as drips
  const cv = op('texture', [add(mul(swz(w, 'xz'), param('coverK')), 0.5)], { param: 'cover' });
  const drip = ss(0.25, 0.8, swz(cv, 'x'));
  const lucky = op('step', [mul(drip, 0.86), op('fract', [add(mul(swz(seed, 'x'), 91.7), mul(swz(seed, 'z'), 13.3))])]);
  // the cave's hood (E322 F-L5): no rain in the mouth or under the arch, below its ceiling
  const cave = param('cave'), hood = param('caveBox'), cd = sub(swz(w, 'xz'), swz(cave, 'xy')), dx = swz(cd, 'x'), dz = swz(cd, 'y');
  const lx = sub(mul(dx, swz(cave, 'z')), mul(dz, swz(cave, 'w'))), lz = add(mul(dx, swz(cave, 'w')), mul(dz, swz(cave, 'z')));
  const across = mul(op('step', [op('abs', [lx]), swz(hood, 'x')]), op('step', [swz(w, 'y'), swz(hood, 'w')]));
  const inHood = mul(across, mul(op('step', [swz(hood, 'y'), lz]), op('step', [lz, swz(hood, 'z')])));
  const keep = mul(mul(lucky, op('oneMinus', [op('step', [0.5, swz(cv, 'y')])])), op('oneMinus', [inHood]));
  const v = op('normalize', [add(param('velocity'), op('combine', [0, mul(drip, -3), 0]))]); // drips fall straight: the canopy breaks the wind
  const a = add(w, mul(v, mul(cy, mul(op('mix', [param('length'), 0.28, drip]), speed))));
  const toEye = sub(eye, a), dist = op('length', [toEye]);
  const side = op('normalize', [add(op('cross', [v, toEye]), 1e-5)]);
  const half = mul(mul(mul(0.012 * 0.12, op('mix', [1, 2.2, drip])), op('max', [dist, 1])), add(0.6, mul(speed, 0.4)));
  const off = op('abs', [sub(w, c)]), far = op('max', [op('max', [swz(off, 'x'), swz(off, 'y')]), swz(off, 'z')]);
  const edge = op('oneMinus', [ss(mul(R, 0.65), mul(R, 0.98), far)]);
  const vA = mul(mul(mul(keep, edge), mul(ss(0.5, 2.2, dist), op('mix', [0.15, 1, cy]))), op('mix', [1, 1.4, drip]));
  const alpha = mul(op('varying', [vA]), param('alpha'));
  const colour = mul(param('colour'), op('mix', [1, 1.15, op('varying', [drip])]));
  const big = 1e6;
  return { version: 1, kind: 'material', model: 'unlit', doubleSided: true, effectState: { blend: 'alpha', depthWrite: false },
    params: {
      cover: { type: 'texture', value: 'rain-cover', role: 'lent' },
      coverK: { type: 'float', value: 1 / 1024, min: 0, max: 1 },
      cave: { type: 'vec4', value: [0, 0, 0, 0], min: -big, max: big },
      caveBox: { type: 'vec4', value: [0, 0, 0, 0], min: -big, max: big },
      offset: { type: 'vec3', value: [0, 0, 0], min: 0, max: 1000 },
      radius: { type: 'float', value: 16, min: 1, max: 100 },
      velocity: { type: 'vec3', value: [0, -9, 0], min: -100, max: 100 },
      length: { type: 'float', value: 0.9, min: 0, max: 10 },
      colour: { type: 'vec3', value: [0.6, 0.65, 0.75], min: 0, max: 64 },
      alpha: { type: 'float', value: 0.3, min: 0, max: 1 },
    },
    nodes: k.nodes,
    stages: { 'vertex.position': { position: add(a, mul(side, mul(cx, half))) }, 'vertex.scale': { fog: 0.6 }, surface: { colour, alpha, discard: op('lt', [alpha, 0.002]) } } };
}

/**
 * The splashes at the feet: per instance slot (`aSplash`: x, y, z, born on the `time` param's clock, set each frame) a flat
 * ripple ring (corners with z 0) and an upright crown facing the eye (z 1), both posed from the slot's age over 0.42 s;
 * a dead slot collapses to a point. The ring widens and thins out; the crown throws five droplets up and out on arcs.
 * `colour` and `alpha` follow the rain and the fog colour, set each frame.
 */
function splashGraph(): GraphIr {
  const k = kit(), { op, add, sub, mul, swz, fall, param } = k;
  const slot = k.attr('aSplash'), corner = op('positionGeometry'), cx = swz(corner, 'x'), cy = swz(corner, 'y'), kind = swz(corner, 'z');
  const age = mul(sub(param('time'), swz(slot, 'w')), 1 / 0.42);
  const seed = op('fract', [mul(op('sin', [op('dot', [swz(slot, 'xz'), [12.9898, 78.233]])]), 43758.5453)]);
  const grow = add(0.7, mul(seed, 0.6)), at = swz(slot, 'xyz');
  const r = mul(op('mix', [0.02, 0.17, op('pow', [age, 0.5])]), grow);
  const ring = op('combine', [mul(cx, r), 0.012, mul(cy, r)]);
  const toEye = sub(op('cameraPosition'), at);
  const side = op('normalize', [add(op('combine', [op('negate', [swz(toEye, 'z')]), 0, swz(toEye, 'x')]), 1e-4)]);
  const crown = add(mul(side, mul(cx, add(0.045, mul(age, 0.035)))), op('combine', [0, mul(cy, mul(grow, 0.07)), 0]));
  const isRing = op('lt', [kind, 0.5]);
  const alive = mul(op('step', [0, age]), op('step', [age, 1]));
  const position = add(at, mul(op('select', [isRing, ring, crown]), alive));
  const uv = op('varying', [swz(corner, 'xy')]), vAge = op('varying', [age]), vSeed = op('varying', [seed]), fragRing = op('lt', [op('varying', [kind]), 0.5]);
  // a ripple ring widening and thinning out
  const ringA = mul(mul(fall(0, 0.14, op('abs', [sub(op('length', [uv]), 0.85)])), op('oneMinus', [vAge])), 0.55);
  // the crown: five droplets thrown up and out on arcs, falling back
  const arc = mul(mul(vAge, op('oneMinus', [vAge])), 4 * 1.9);
  let crownA: GraphRef = 0;
  for (let i = 0; i < 5; i++) {
    const s = add((i - 2) / 2, mul(sub(vSeed, 0.5), 0.3));
    const c = op('combine', [mul(mul(s, 0.75), vAge), sub(mul(arc, sub(0.95, mul(op('abs', [s]), 0.35))), 0.9)]);
    crownA = add(crownA, fall(0.06, 0.16, op('length', [mul(sub(uv, c), [1, 0.8])])));
  }
  crownA = mul(crownA, op('oneMinus', [mul(vAge, vAge)]));
  const alpha = mul(op('select', [fragRing, ringA, crownA]), param('alpha'));
  return { version: 1, kind: 'material', model: 'unlit', budget: { nodes: 200, samplers: 1, instructions: 500 }, doubleSided: true, effectState: { blend: 'alpha', depthWrite: false, fog: false, singlePass: true },
    params: {
      time: { type: 'float', value: 0, min: 0, max: 1e9 },
      colour: { type: 'vec3', value: [0.8, 0.84, 0.9], min: 0, max: 64 },
      alpha: { type: 'float', value: 0.5, min: 0, max: 1 },
    },
    nodes: k.nodes, stages: { 'vertex.position': { position }, surface: { colour: param('colour'), alpha, discard: op('lt', [alpha, 0.01]) } } };
}

/**
 * The drops on the lens: one clip-space quad per drop (`aDrop`: ndc x, y, radius in ndc y, alpha), a bead a little
 * taller than wide; the fragment is an uneven bead showing the world upside down and small (the bright sky pooled low,
 * the dark ground high) with a dark rim and a glint. `aspect` (the camera's), `sky` and `ground` (from the fog colour)
 * are set each frame; depth testing is switched off on the worn material (runtime/looks/rainFx).
 */
function lensGraph(): GraphIr {
  const k = kit(), { op, add, sub, mul, swz, ss, fall, param } = k;
  const drop = k.attr('aDrop'), corner = swz(op('positionGeometry'), 'xy');
  const scale = mul(mul(corner, swz(drop, 'z')), op('combine', [op('div', [1, param('aspect')]), 1.15]));
  const clip = op('combine', [add(swz(drop, 'xy'), scale), 0, 1]);
  const uv = op('varying', [corner]), vA = op('varying', [swz(drop, 'w')]);
  const vSeed = op('varying', [op('fract', [mul(op('sin', [add(mul(swz(drop, 'x'), 91.3), mul(swz(drop, 'y'), 47.1))]), 1753.1)])]);
  const uy = swz(uv, 'y'), ang = op('atan', [uy, swz(uv, 'x')]);
  const wob = add(add(1, mul(op('sin', [add(mul(ang, 3), mul(vSeed, 6.3))]), 0.07)), mul(op('sin', [sub(mul(ang, 5), mul(vSeed, 4))]), 0.04));
  const r = mul(op('length', [uv]), wob);
  const body = fall(0, 1, r), sky = param('sky'), ground = param('ground');
  const rim = mul(ss(0.72, 0.95, r), fall(0.95, 1, r));
  const glint = fall(0, 0.22, op('length', [sub(uv, [-0.32, 0.4])]));
  const col = add(op('mix', [op('mix', [ground, sky, fall(-0.6, 0.5, uy)]), mul(ground, 0.35), mul(rim, 0.8)]), mul(glint, 0.9));
  const alpha = mul(mul(mul(add(add(0.28, mul(rim, 0.4)), mul(glint, 0.5)), fall(0.9, 1, r)), vA), op('mix', [0.8, 1, body]));
  return { version: 1, kind: 'material', model: 'unlit', budget: { nodes: 120, samplers: 1, instructions: 300 }, effectState: { blend: 'alpha', depthWrite: false, fog: false },
    params: {
      aspect: { type: 'float', value: 1, min: 0.05, max: 20 },
      sky: { type: 'vec3', value: [0.8, 0.82, 0.86], min: 0, max: 64 },
      ground: { type: 'vec3', value: [0.2, 0.22, 0.2], min: 0, max: 64 },
    },
    nodes: k.nodes, stages: { 'vertex.clip': { position: clip }, surface: { colour: col, alpha, discard: op('gt', [r, 1]) } } };
}

/** The rain's graphs by look.materials id. */
export const RAIN_GRAPHS: Readonly<Record<string, GraphIr>> = {
  [PINE_RAIN_PROGRAMS.rain]: curtainGraph(), [PINE_RAIN_PROGRAMS.splash]: splashGraph(), [PINE_RAIN_PROGRAMS.lens]: lensGraph(),
};

/** C7: in the rain the grazing herds drift in under the nearest big trees (the bear sits it out), and back out after. */
export const PINE_HERD_SHELTER = { kinds: ['deer', 'elk', 'boar'], bigTree: 20, reach: 90, homeHold: 90, clear: 2.2, spotR: 3.5, homeR: 10, wet: 0.3, dry: 0.05 } as const;
