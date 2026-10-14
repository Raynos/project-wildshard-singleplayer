import type { GraphIr, GraphNode, GraphRef } from '@wildshard/format/materialGraph';

/**
 * Pine Hollow's running water as data (PH-L9; SHARD-PLATFORM M3, W2 C2): the waterfall's spray puffs (where they rise, how
 * many, how big) and their SF59 material graph (the shardfile's look.materials, compiled by runtime/index.ts and worn by
 * world/streams.ts's instanced quads).
 */

/** The spray's anchors: at the foot of the fall's face, and over the plunge (lifted `lift` m off the pond). */
export const SPRAY_ANCHORS = {
  faceFoot: { n: 5, size: 4.5, rise: 3.5 },
  plunge: { n: 6, size: 5.5, rise: 3, lift: 0.3 },
} as const;

/** the look.materials id the spray wears */
export const SPRAY_LOOK = 'pine-waterfall-spray';

/** the world wind's direction the puffs drift along (engine/world/wind.ts `WIND_DIR`, xz) */
const WIND: readonly [number, number] = [-0.55, 0.83];

/**
 * Billboard puffs rising and swelling over their own cycle (each instance's origin is its anchor; `aSeed`: phase, period
 * (s), sideways drift, opacity; `aSize`: width, height, rise in metres), drifting downwind, upright and turned to the
 * camera, their soft lumpy mist turning as they climb and fading close to the eye. Lit like the air round them: the fog's
 * colour, brighter toward the sun; fogged by the engine epilogue. Alpha, unlit, no depth write.
 */
function sprayGraph(): GraphIr {
  const nodes: Record<string, GraphNode> = {};
  let next = 0;
  const op = (name: string, inputs?: readonly GraphRef[], extra?: Omit<GraphNode, 'op' | 'in'>): string => {
    const id = `s${String(next++)}`; nodes[id] = { op: name, ...(inputs === undefined ? {} : { in: inputs }), ...extra }; return id;
  };
  const add = (a: GraphRef, b: GraphRef): string => op('add', [a, b]), sub = (a: GraphRef, b: GraphRef): string => op('sub', [a, b]);
  const mul = (a: GraphRef, b: GraphRef): string => op('mul', [a, b]), swz = (a: GraphRef, mask: string): string => op('swizzle', [a], { mask });
  const seed = op('attribute', undefined, { name: 'aSeed', type: 'vec4' }), size = op('attribute', undefined, { name: 'aSize', type: 'vec3' });
  const sx = swz(seed, 'x'), sz = swz(seed, 'z'), eye = op('cameraPosition');
  const t = op('fract', [add(op('div', [op('time'), swz(seed, 'y')]), sx)]);
  const centre = add(add(op('objectOrigin'), op('combine', [0, mul(swz(size, 'z'), t), 0])),
    mul(add(mul([WIND[0], 0, WIND[1]], 2.2), mul(op('combine', [sz, 0, op('negate', [sz])]), 1.5)), t));
  const grow = add(0.55, mul(t, 0.75)), toCam = sub(eye, centre);
  const fwd = op('normalize', [add(op('combine', [swz(toCam, 'x'), 0, swz(toCam, 'z')]), 1e-4)]);
  const right = op('normalize', [op('cross', [[0, 1, 0], fwd])]), corner = op('positionGeometry');
  const world = add(add(centre, mul(right, mul(mul(swz(corner, 'x'), swz(size, 'x')), grow))), op('combine', [0, mul(mul(swz(corner, 'y'), swz(size, 'y')), grow), 0]));
  const ang = add(mul(sx, 6.283), mul(t, 0.8)), c = sub(op('uv'), 0.5), cx = swz(c, 'x'), cy = swz(c, 'y'), ca = op('cos', [ang]), sa = op('sin', [ang]);
  const turned = op('varying', [add(op('combine', [sub(mul(cx, ca), mul(cy, sa)), add(mul(cx, sa), mul(cy, ca))]), 0.5)]);
  const fade = op('varying', [mul(mul(op('sin', [mul(t, Math.PI)]), swz(seed, 'w')), op('smoothstep', [1.5, 5, op('length', [toCam])]))]);
  const at = op('varying', [world]);
  // the mist: a lumpy cloud of soft blobs in an ellipse (wider than tall), held to the quad's middle so its edges never show
  const m = sub(turned, 0.5), d = op('length', [m]);
  const ellipse = op('oneMinus', [op('smoothstep', [0.75, 1.25, mul(op('length', [mul(m, [1 / 1.15, 1 / 0.8])]), 1 / 0.42)])]);
  const lumps = add(0.5, mul(add(mul(op('noise', [mul(turned, 4)]), 0.6), mul(op('noise', [add(mul(turned, 9), 7)]), 0.4)), 0.35));
  const edge = mul(op('mix', [1, 0.55, op('saturate', [mul(sub(d, 0.1), 1 / 0.3)])]), op('saturate', [mul(sub(0.5, d), 10)]));
  const alpha = mul(mul(mul(mul(lumps, ellipse), edge), 0.8), mul(fade, 0.55));
  const sunAmt = op('max', [op('dot', [op('normalize', [sub(at, eye)]), op('atmosphereSunDirection')]), 0]);
  const sun = op('atmosphereSunColour');
  const colour = add(op('mix', [mul(op('fogColour'), 1.15), sun, add(0.25, mul(op('pow', [sunAmt, 3]), 0.5))]), mul(sun, 0.04));
  return { version: 1, kind: 'material', model: 'unlit', budget: { nodes: 200, samplers: 1, instructions: 900 }, doubleSided: true,
    effectState: { blend: 'alpha', depthWrite: false, singlePass: true },
    nodes, stages: { 'vertex.position': { position: world }, surface: { colour, alpha } } };
}

/** The spray's graph by look.materials id. */
export const SPRAY_GRAPHS: Readonly<Record<string, GraphIr>> = { [SPRAY_LOOK]: sprayGraph() };
