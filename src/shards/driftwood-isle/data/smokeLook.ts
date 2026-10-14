import type { GraphIr, GraphNode, GraphRef } from '@wildshard/format/materialGraph';
import type { SmokeColumnRow } from './lookRows';
import { CASTAWAY_SMOKE } from './castawayLook';

/**
 * Driftwood's smoke column (the castaway's campfire breadcrumb, data/castawayLook.ts) as an SF59 material graph
 * (SHARD-PLATFORM W2 C2; the shardfile's `look.materials`, compiled by the hybrid runtime and drawn on
 * runtime/looks/smokeColumn.ts's quads): unlit, alpha-blended, fogged, no depth write. Each puff is one camera-facing
 * quad posed in the vertex stage from its `aPuff` (start age, life speed, start seed) on the frame clock, the way the CPU
 * column stepped it: it rises (slowing as it cools), leans downwind more the higher it climbs, wanders on its own slow
 * turbulence and grows; its seed steps by `reseed` each time it restarts, so the column stays broken. It fades in over the
 * fire and out toward the top, and the whole column thins with the camera's distance (thin up close, a breadcrumb far off).
 * The puff is the soft round sprite the stock points program drew (a white radial gradient), a point's world size: its
 * pixel size `size × (height / 2) / depth` is `size × tan(fov / 2)` metres on the game camera's 72° fov.
 */

/** the look.materials id the castaway's smoke wears */
export const SMOKE_LOOK = 'driftwood-castaway-smoke';
/** a point sprite's world width per unit of its size on the game camera (tan 36°) */
const POINT_WORLD = Math.tan((72 / 2) * (Math.PI / 180));

function smokeGraph(r: SmokeColumnRow): GraphIr {
  const nodes: Record<string, GraphNode> = {};
  let next = 0;
  const op = (name: string, inputs?: readonly GraphRef[], extra?: Omit<GraphNode, 'op' | 'in'>): string => {
    const id = `s${String(next++)}`; nodes[id] = { op: name, ...(inputs === undefined ? {} : { in: inputs }), ...extra }; return id;
  };
  const add = (a: GraphRef, b: GraphRef): string => op('add', [a, b]), sub = (a: GraphRef, b: GraphRef): string => op('sub', [a, b]);
  const mul = (a: GraphRef, b: GraphRef): string => op('mul', [a, b]), swz = (a: GraphRef, mask: string): string => op('swizzle', [a], { mask });
  const puff = op('attribute', undefined, { name: 'aPuff', type: 'vec3' });
  // the puff's age through its life and its seed, stepped by `reseed` at every restart
  const cycle = add(swz(puff, 'x'), mul(op('time'), mul(swz(puff, 'y'), 1 / r.life)));
  const age = op('fract', [cycle]), seed = add(swz(puff, 'z'), mul(op('floor', [cycle]), r.reseed));
  // rise slows as it cools; the lean grows with height; each puff wanders on its own slow turbulence
  const cool = op('oneMinus', [age]);
  const rise = add(mul(op('oneMinus', [mul(cool, cool)]), r.rise * r.ease), mul(age, r.rise * r.linear)), lean = mul(mul(age, age), r.lean);
  const wx = r.wanderX, wz = r.wanderZ;
  const tx = mul(op('sin', [add(mul(age, wx[0]), mul(seed, wx[1]))]), add(wx[2], mul(age, wx[3])));
  const tz = mul(op('cos', [add(mul(age, wz[0]), mul(seed, wz[1]))]), add(wz[2], mul(age, wz[3])));
  const centre = op('combine', [add(mul(lean, r.wind[0]), tx), add(rise, r.base), add(mul(lean, r.wind[1]), tz)]);
  // thin at the fire, spreading as it climbs: a camera-facing quad the point's world size
  const width = mul(add(r.size[0], mul(age, r.size[1])), POINT_WORLD), corner = op('positionGeometry');
  const facing = add(mul(op('viewToWorld', [[1, 0, 0]]), mul(swz(corner, 'x'), width)), mul(op('viewToWorld', [[0, 1, 0]]), mul(swz(corner, 'y'), width)));
  const position = add(centre, op('worldToLocal', [facing]));
  // in over the first metre, out long before the top; some puffs thinner (broken)
  const thin = add(r.thin[0], mul(r.thin[1], add(0.5, mul(0.5, op('sin', [mul(seed, r.thin[2])])))));
  const fade = mul(mul(op('min', [1, mul(age, 1 / r.fadeIn)]), op('pow', [op('min', [1, mul(cool, 1 / r.fadeOut)]), r.fadePow])), thin);
  // the column thins with the camera's distance (along the ground) to the fire
  const away = sub(op('cameraPosition'), op('objectOrigin')), d = op('length', [op('combine', [swz(away, 'x'), swz(away, 'z')])]);
  const opacity = add(r.opacity[0], mul(r.opacity[1], op('smoothstep', [r.opacityFrom, r.opacityTo, d])));
  const vAlpha = op('varying', [mul(fade, opacity)]);
  // the soft round sprite: a radial gradient from 2 to 31 px of 64 (0.9 at its heart, 0.45 halfway, 0 at the rim)
  const t = op('saturate', [mul(sub(mul(op('length', [sub(op('uv'), 0.5)]), 64), 2), 1 / 29)]);
  const sprite = op('select', [op('lt', [t, 0.5]), op('mix', [0.9, 0.45, mul(t, 2)]), op('mix', [0.45, 0, sub(mul(t, 2), 1)])]);
  return { version: 1, kind: 'material', model: 'unlit', effectState: { blend: 'alpha', depthWrite: false }, nodes,
    stages: { 'vertex.position': { position }, surface: { colour: [...r.color], alpha: mul(vAlpha, sprite) } } };
}

/** The smoke's graph by look.materials id. */
export const SMOKE_GRAPHS: Readonly<Record<string, GraphIr>> = { [SMOKE_LOOK]: smokeGraph(CASTAWAY_SMOKE) };
