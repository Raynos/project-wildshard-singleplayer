import type { GraphIr, GraphNode, GraphRef } from '@wildshard/format/materialGraph';

/**
 * The island's low-poly kit materials as SF59 material graphs (SHARD-PLATFORM W2 C2; the shardfile's `look.materials`,
 * compiled by the look's `prepareWorld` with the ground and lent to the kit's variants with `bindLowPolyMaterial`, so every
 * `lowPolyLookMaterial(sky, variant)` in the world wears the graph): the toon family's light model (its numbers the
 * catalogue's live toon look, following the day clock: look/toon.ts `followToon`), flat-shaded vertex colour, two-sided,
 * matte. The swaying ones move in their shadow pass too (`shadow: true`), so no mesh needs a depth material of its own.
 * - `default`: the kit (the castaway, the trader and his counter, the boat's sail, the lookout's banner, the wrecks, the
 *   hibiscus): the engine's Driftwood sway (engine/world/wind.ts) from each vertex's `aSway` (weight, phase; absent reads
 *   0, still), a lean downwind plus a flap and a cross flutter;
 * - `still`: the pieces that never sway (the pier deck, the hut, the shrine, the trail, the entry deck, cargo, logs);
 * - `rock-smooth`: the rocks (world/rockKit.ts carries its own smooth normals), smooth-shaded, roughness 0.82;
 * - `pennant`: the pier's pennant, the kit's sway plus a ripple travelling from the hoist to the fly across the cloth;
 * - `palm`: the palms' fronds (models/palm.ts) from their `aSway` (weight, phase), stronger in a gust, roughness 0.85.
 */

/** the look.materials ids the kit wears */
export const KIT_LOOK = 'driftwood-kit';
export const KIT_STILL_LOOK = 'driftwood-kit-still';
export const KIT_ROCK_LOOK = 'driftwood-kit-rock';
export const KIT_PENNANT_LOOK = 'driftwood-kit-pennant';
export const KIT_PALM_LOOK = 'driftwood-kit-palm';

/** the prevailing wind (unit xz, from the sea in the south-east), as the engine's sway has it; the pennant streams along it */
const WIND = [-0.55, 0.83] as const;

type Op = (name: string, inputs?: readonly GraphRef[], extra?: Omit<GraphNode, 'op' | 'in'>) => string;

/** a toon kit graph: `offset` (given the node builder) is the vertex stage's, in its shadow too; none stays put */
function kitGraph(flatShading: boolean, roughness: number, offset?: (op: Op) => string): GraphIr {
  const nodes: Record<string, GraphNode> = { paint: { op: 'vertexColour' } };
  let next = 0;
  const op: Op = (name, inputs, extra) => { const id = `k${String(next++)}`; nodes[id] = { op: name, ...(inputs === undefined ? {} : { in: inputs }), ...extra }; return id; };
  const moved = offset?.(op);
  return { version: 1, kind: 'material', model: 'toon', doubleSided: true, flatShading, nodes,
    stages: { ...(moved === undefined ? {} : { 'vertex.offset': { offset: moved, shadow: true } }), surface: { colour: 'paint', roughness, metalness: 0 } } };
}

/** the engine's sway (wind.ts SWAY_GLSL) as a model-space offset; `flutter` adds the pennant's ripple across the cloth */
const kitSway = (flutter: boolean) => (op: Op): string => {
  const add = (a: GraphRef, b: GraphRef): string => op('add', [a, b]), mul = (a: GraphRef, b: GraphRef): string => op('mul', [a, b]);
  const sway = op('attribute', undefined, { name: 'aSway', type: 'vec2', default: [0, 0] }), t = op('windTime'), gust = op('windGust');
  const w = op('swizzle', [sway], { mask: 'x' }), seed = op('swizzle', [sway], { mask: 'y' }), world = op('positionWorld');
  const ph = add(seed, add(mul(op('swizzle', [world], { mask: 'x' }), 0.21), mul(op('swizzle', [world], { mask: 'z' }), 0.17)));
  const amp = mul(add(0.35, mul(gust, 0.65)), w);
  const flap = add(mul(op('sin', [add(mul(t, 2.1), ph)]), 0.55), mul(op('sin', [add(mul(t, 4.3), mul(ph, 1.9))]), 0.25));
  const along = mul(add(mul(add(0.25, mul(gust, 0.75)), 0.12), mul(flap, 0.1)), amp), across = mul(mul(op('sin', [add(mul(t, 1.4), mul(ph, 1.3))]), 0.05), amp);
  const dx = add(mul(along, WIND[0]), mul(across, -WIND[1])), dz = add(mul(along, WIND[1]), mul(across, WIND[0]));
  const drop = mul(mul(op('abs', [flap]), amp), -0.02);
  if (!flutter) return op('worldToLocal', [op('combine', [dx, drop, dz])]);
  // the pennant (models/pier.ts, streaming downwind): sin(t·5.2 − 7w + phase)·0.7 + sin(t·8.3 − 11w)·0.3, 0.075·w·(0.45 +
  // 0.55·gust) across the wind
  const ripple = add(mul(op('sin', [add(op('sub', [mul(t, 5.2), mul(w, 7)]), seed)]), 0.7), mul(op('sin', [op('sub', [mul(t, 8.3), mul(w, 11)])]), 0.3));
  const k = mul(mul(mul(ripple, 0.075), w), add(0.45, mul(gust, 0.55)));
  return op('worldToLocal', [op('combine', [add(dx, mul(k, -WIND[1])), drop, add(dz, mul(k, WIND[0]))])]);
};

/** the palm fronds: w = weight·(0.55 + 0.8·gust), g = sin(t·1.3 + ph)·0.6 + sin(t·2.9 + 1.7ph)·0.25 + 0.35·gust */
const palmSway = (op: Op): string => {
  const add = (a: GraphRef, b: GraphRef): string => op('add', [a, b]), mul = (a: GraphRef, b: GraphRef): string => op('mul', [a, b]);
  const sway = op('attribute', undefined, { name: 'aSway', type: 'vec2', default: [0, 0] }), t = op('windTime'), gust = op('windGust');
  const w = mul(op('swizzle', [sway], { mask: 'x' }), add(mul(gust, 0.8), 0.55)), ph = op('swizzle', [sway], { mask: 'y' });
  const g = add(add(mul(op('sin', [add(mul(t, 1.3), ph)]), 0.6), mul(op('sin', [add(mul(t, 2.9), mul(ph, 1.7))]), 0.25)), mul(gust, 0.35));
  return op('combine', [mul(mul(g, w), 0.22), mul(mul(op('abs', [g]), w), -0.05), mul(mul(op('cos', [add(mul(t, 1.1), ph)]), w), 0.14)]);
};

/** The kit's graphs by look.materials id. */
export const KIT_GRAPHS: Readonly<Record<string, GraphIr>> = {
  [KIT_LOOK]: kitGraph(true, 0.88, kitSway(false)), [KIT_STILL_LOOK]: kitGraph(true, 0.88), [KIT_ROCK_LOOK]: kitGraph(false, 0.82),
  [KIT_PENNANT_LOOK]: kitGraph(true, 0.88, kitSway(true)), [KIT_PALM_LOOK]: kitGraph(true, 0.85, palmSway),
};

/** The kit variant each graph is lent to (engine/world/lowpolyKit.ts `lowPolyLookMaterial(sky, variant)`). */
export const KIT_LENDS: Readonly<Record<string, string>> = {
  default: KIT_LOOK, still: KIT_STILL_LOOK, 'rock-smooth': KIT_ROCK_LOOK, pennant: KIT_PENNANT_LOOK, palm: KIT_PALM_LOOK,
};
