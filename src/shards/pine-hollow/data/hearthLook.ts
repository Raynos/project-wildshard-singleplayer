import type { GraphIr, GraphNode, GraphRef } from '@wildshard/format/materialGraph';

/**
 * Pine Hollow's hearth particles (the chimney smoke, the hearth flames and their embers) as SF59 material graphs
 * (SHARD-PLATFORM W2 C2; the shardfile's `look.materials`, compiled by runtime/index.ts and drawn on the baked buildings'
 * instanced quads, runtime/props/bakedBuilding.ts). Each quad is one camera-facing billboard posed in the vertex stage
 * from its `aSeed` (x, y: shape and heading, z: speed and spread, w: phase) on the frame clock: no CPU work per frame.
 *
 * - `smoke`: rises, drifts downwind (world space, so every plume leans the same way) on a slow turbulence, grows and turns;
 *   a noisy round puff lit on the sun's side (`sunColour`, the sky's sun, fed each frame) and cool blue-grey in its own
 *   shade, dimmed by `shade` at night, the young plume catching the chimney's glow from below (`lamps`). Alpha, fogged.
 * - `flame`: tongues licking up and in from the hearth, a tall noisy body hot white at its heart. Additive, unfogged.
 * - `ember`: sparks rising on the wind, flickering out. Additive, unfogged.
 */

/** One particle kind: its life (s), rise (m), spread (m), size from birth to death (m), wind (m/s, world), blend. */
export interface HearthParticleRow {
  readonly life: number;
  readonly rise: number;
  readonly spread: number;
  readonly size: readonly [number, number];
  readonly wind: readonly [number, number, number];
}

/** the chimney smoke, the hearth flames and their embers */
export const CABIN_PARTICLE_KINDS: Readonly<Record<'smoke' | 'flame' | 'ember', HearthParticleRow>> = {
  smoke: { life: 11.0, rise: 12.0, spread: 0.25, size: [0.7, 4.6], wind: [1.6, 0.0, 0.45] },
  flame: { life: 0.85, rise: 0.95, spread: 0.36, size: [0.95, 0.3], wind: [0, 0, 0] },
  ember: { life: 2.8, rise: 3.4, spread: 0.4, size: [0.04, 0.012], wind: [0.3, 0, 0.15] },
};

/** the look.materials ids the hearth particles wear */
export const HEARTH_LOOKS = { smoke: 'pine-hearth-smoke', flame: 'pine-hearth-flame', ember: 'pine-hearth-ember' } as const;

/** One graph's node table and its builders (ids `h0`, `h1`, …), with the particle's seed, age and billboard. */
function kit(row: HearthParticleRow) {
  const nodes: Record<string, GraphNode> = {};
  let next = 0;
  const op = (name: string, inputs?: readonly GraphRef[], extra?: Omit<GraphNode, 'op' | 'in'>): string => {
    const id = `h${String(next++)}`; nodes[id] = { op: name, ...(inputs === undefined ? {} : { in: inputs }), ...extra }; return id;
  };
  const add = (a: GraphRef, b: GraphRef): string => op('add', [a, b]), sub = (a: GraphRef, b: GraphRef): string => op('sub', [a, b]);
  const mul = (a: GraphRef, b: GraphRef): string => op('mul', [a, b]), swz = (a: GraphRef, mask: string): string => op('swizzle', [a], { mask });
  const sin = (a: GraphRef): string => op('sin', [a]), cos = (a: GraphRef): string => op('cos', [a]);
  const ss = (a: GraphRef, b: GraphRef, x: GraphRef): string => op('smoothstep', [a, b, x]);
  /** GLSL's reversed smoothstep(b, a, x) for a < b */
  const fall = (a: GraphRef, b: GraphRef, x: GraphRef): string => op('oneMinus', [ss(a, b, x)]);
  const seed = op('attribute', undefined, { name: 'aSeed', type: 'vec4' });
  const sx = swz(seed, 'x'), sy = swz(seed, 'y'), sz = swz(seed, 'z'), t = op('time');
  const age = op('fract', [add(mul(t, mul(add(0.85, mul(sz, 0.3)), 1 / row.life)), swz(seed, 'w'))]);
  // a ring of birth points, denser toward the middle
  const ang = mul(sy, Math.PI * 2), r = mul(op('pow', [sz, 0.5]), row.spread);
  const bx = mul(cos(ang), r), bz = mul(sin(ang), r);
  const right = op('viewToWorld', [[1, 0, 0]]), up = op('viewToWorld', [[0, 1, 0]]), corner = op('positionGeometry');
  return { nodes, op, add, sub, mul, swz, sin, cos, ss, fall, seed, sx, sy, t, age, right, up, corner, bx, bz, d: sub(op('uv'), 0.5),
    /** the quad's corner `(qx, qy)` laid along the camera's axes `ax`, `ay` (world), into the model's frame at `p` */
    pose: (p: GraphRef, ax: GraphRef, ay: GraphRef, qx: GraphRef, qy: GraphRef): string => add(p, op('worldToLocal', [add(mul(ax, qx), mul(ay, qy))])),
    /** the drifting plume's sway (smoke, embers): the wandering rise and the world wind, `extra` added before it turns local */
    drift: (extraWind?: GraphRef): string => {
      const age2 = mul(age, age);
      const x = add(add(bx, mul(mul(sin(add(mul(age, 9), mul(sx, 12))), 0.12), age)), mul(mul(sin(add(mul(t, 1.3), mul(sy, 9))), 0.08), age));
      const z = add(bz, mul(mul(cos(add(mul(age, 7), mul(sy, 12))), 0.12), age));
      const lift = mul(mul(age, row.rise), add(0.7, mul(sx, 0.6)));
      let wind: GraphRef = mul(mul([...row.wind], age2), add(0.6, mul(sx, 0.8)));
      if (extraWind !== undefined) wind = add(wind, mul(extraWind, mul(age2, 0.9)));
      return add(op('combine', [x, lift, z]), op('worldToLocal', [wind]));
    },
  };
}

/** two octaves of noise standing in for the canvas value noise (lattices of 8 and 16 per unit), about 0 … 1 around 0.5 */
function noiseAt(k: ReturnType<typeof kit>, at: GraphRef): string {
  const { op, add, mul } = k;
  return add(0.5, mul(add(mul(op('noise', [mul(at, 8)]), 0.67), mul(op('noise', [mul(at, 16)]), 0.33)), 0.35));
}

const BUDGET = { nodes: 400, samplers: 1, instructions: 1200 };

function smokeGraph(row: HearthParticleRow): GraphIr {
  const k = kit(row), { op, add, sub, mul, swz, sin, cos, ss, fall, seed, sx, sy, t, age, right, up, corner, d } = k;
  const p = k.drift(op('combine', [sin(add(mul(t, 0.37), mul(sx, 6))), 0, cos(add(mul(t, 0.29), mul(sy, 6)))]));
  const size = mul(mul(op('mix', [row.size[0], row.size[1], op('pow', [age, 0.7])]), add(0.75, mul(sx, 0.5))), ss(0, 0.08, age));
  // each puff turns as it climbs
  const rot = add(mul(sx, 6.28), mul(mul(age, sub(sy, 0.5)), 2)), c = cos(rot), s = sin(rot);
  const ax = add(mul(right, c), mul(up, s)), ay = sub(mul(up, c), mul(right, s));
  const position = k.pose(p, ax, ay, mul(swz(corner, 'x'), size), mul(swz(corner, 'y'), size));
  const sun = op('atmosphereSunDirection');
  const sunView = op('varying', [op('normalize', [add(op('combine', [op('dot', [sun, right]), op('dot', [sun, up])]), 1e-4)])]);
  const vAge = op('varying', [age]), uv = op('uv'), xy = swz(seed, 'xy'), zw = swz(seed, 'zw');
  const n = noiseAt(k, add(add(mul(uv, 1.3), mul(xy, 3)), mul(t, [0.015, -0.04])));
  const n2 = noiseAt(k, add(add(mul(uv, 3.1), mul(zw, 5)), mul(t, [-0.03, -0.02])));
  const m = fall(0.08, 0.5, add(add(op('length', [d]), mul(sub(n, 0.5), 0.42)), mul(sub(n2, 0.5), 0.15)));
  const alpha = mul(mul(mul(m, 0.55), ss(0, 0.08, vAge)), fall(0.3, 1, vAge));
  // lit on the sun side of each puff, cool blue-grey in its own shadow
  const lit = ss(-0.55, 0.6, add(op('dot', [mul(d, 2), sunView]), mul(sub(n, 0.5), 0.6)));
  const shade = op('param', undefined, { param: 'shade' }), lamps = op('param', undefined, { param: 'lamps' });
  const sunTint = mul(mul(op('param', undefined, { param: 'sunColour' }), [0.95, 0.9, 0.85]), 1.25);
  const body = mul(mul(op('mix', [[0.36, 0.38, 0.44], sunTint, lit]), add(0.85, mul(n2, 0.3))), shade);
  // the chimney's glow (PH-L3): the young plume catches the hearth's light from below at night
  const glow = mul(mul(mul([0.16, 0.0672, 0.0192], lamps), fall(0, 0.1, vAge)), op('oneMinus', [shade]));
  return { version: 1, kind: 'material', model: 'unlit', budget: BUDGET, doubleSided: true, effectState: { blend: 'alpha', depthWrite: false, singlePass: true },
    params: { sunColour: { type: 'vec3', value: [1, 1, 1], min: 0, max: 64 }, shade: { type: 'float', value: 1, min: 0, max: 1 }, lamps: { type: 'float', value: 0, min: 0, max: 1 } },
    nodes: k.nodes, stages: { 'vertex.position': { position }, surface: { colour: add(body, glow), alpha } } };
}

function flameGraph(row: HearthParticleRow): GraphIr {
  const k = kit(row), { op, add, sub, mul, swz, sin, cos, ss, fall, sx, sy, t, age, right, up, corner, d } = k;
  // tongues lick up and in toward the middle, wavering as they go
  const lift = mul(mul(age, row.rise), add(0.6, mul(sx, 0.8))), pinch = sub(1, mul(age, 0.55));
  const x = add(mul(k.bx, pinch), mul(mul(sin(add(mul(t, 7), mul(sx, 20))), 0.06), age));
  const z = add(mul(k.bz, pinch), mul(mul(cos(add(mul(t, 6.3), mul(sy, 20))), 0.06), age));
  const size = mul(op('mix', [row.size[0], row.size[1], age]), add(0.75, mul(sx, 0.5)));
  const position = k.pose(op('combine', [x, lift, z]), right, up, mul(swz(corner, 'x'), size), mul(swz(corner, 'y'), mul(size, 1.9)));
  const vAge = op('varying', [age]), uv = op('uv'), v = swz(uv, 'y');
  const n1 = noiseAt(k, add(mul(uv, [1.2, 0.7]), op('combine', [mul(sx, 4), sub(mul(t, -0.9), mul(sy, 5))])));
  const n2 = noiseAt(k, add(mul(uv, [2.3, 1.4]), op('combine', [mul(sy, -3), add(mul(t, -1.6), mul(sx, 7))])));
  const n = add(mul(n1, 0.65), mul(n2, 0.35));
  const width = mul(op('mix', [0.42, 0.06, v]), add(0.7, mul(n, 0.6)));
  const edge = fall(mul(width, 0.25), width, op('abs', [add(swz(d, 'x'), mul(mul(sub(n, 0.5), 0.25), v))]));
  const body = mul(mul(edge, ss(0, 0.18, v)), fall(0.55, 1, add(v, mul(sub(n, 0.5), 0.4))));
  const life = mul(ss(0, 0.1, vAge), fall(0.55, 1, vAge));
  const heat = mul(mul(body, sub(1, mul(v, 0.6))), sub(1, mul(vAge, 0.5)));
  const col = op('mix', [op('mix', [[1, 0.18, 0.02], [1, 0.62, 0.12], ss(0.15, 0.6, heat)]), [1, 0.96, 0.75], ss(0.55, 1, heat)]);
  const shown = mul(body, life);
  return { version: 1, kind: 'material', model: 'unlit', budget: BUDGET, doubleSided: true, effectState: { blend: 'additive', depthWrite: false, fog: false, singlePass: true },
    nodes: k.nodes, stages: { 'vertex.position': { position }, surface: { colour: mul(mul(col, shown), 1.8), alpha: shown } } };
}

function emberGraph(row: HearthParticleRow): GraphIr {
  const k = kit(row), { op, add, mul, swz, sin, ss, fall, sx, t, age, right, up, corner, d } = k;
  const size = mul(op('mix', [row.size[0], row.size[1], age]), add(0.75, mul(sx, 0.5)));
  const position = k.pose(k.drift(), right, up, mul(swz(corner, 'x'), size), mul(swz(corner, 'y'), size));
  const vAge = op('varying', [age]);
  const m = fall(0.15, 0.5, op('length', [d]));
  const flick = add(0.6, mul(sin(add(mul(t, 17), mul(sx, 40))), 0.4));
  const shown = mul(m, mul(ss(0, 0.05, vAge), fall(0.4, 1, vAge)));
  return { version: 1, kind: 'material', model: 'unlit', budget: BUDGET, doubleSided: true, effectState: { blend: 'additive', depthWrite: false, fog: false, singlePass: true },
    nodes: k.nodes, stages: { 'vertex.position': { position }, surface: { colour: mul(mul([2.5, 1.375, 0.375], flick), shown), alpha: shown } } };
}

/** The hearth particles' graphs by look.materials id. */
export const HEARTH_GRAPHS: Readonly<Record<string, GraphIr>> = {
  [HEARTH_LOOKS.smoke]: smokeGraph(CABIN_PARTICLE_KINDS.smoke),
  [HEARTH_LOOKS.flame]: flameGraph(CABIN_PARTICLE_KINDS.flame),
  [HEARTH_LOOKS.ember]: emberGraph(CABIN_PARTICLE_KINDS.ember),
};
