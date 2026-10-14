import type { GraphIr, GraphNode, GraphRef } from '@wildshard/format/materialGraph';

/**
 * The lagoon reef's material (models/reef.ts, welded by world/Seabed.ts) as an SF59 material graph (SHARD-PLATFORM W2 C2;
 * the shardfile's `look.materials`, compiled by the hybrid runtime): the toon family's light model (two bands on N·L and
 * the cast shadow, the coloured lift, the terminator, the rim, drifting cloud shade and the caustics under the sea, its
 * numbers the catalogue's live toon look, which follows the day clock: look/toon.ts `followToon`), flat-shaded vertex
 * colour, two-sided, roughness 0.8 (no sun specular), and the seaweed fronds swaying in the current on the frame clock from
 * their `aSway` (weight, phase): a slow surge with a faster ripple on top, the tips travelling, the roots staying put.
 */

/** the look.materials id the reef wears */
export const REEF_LOOK = 'driftwood-reef';

function reefGraph(): GraphIr {
  const nodes: Record<string, GraphNode> = {};
  let next = 0;
  const op = (name: string, inputs?: readonly GraphRef[], extra?: Omit<GraphNode, 'op' | 'in'>): string => {
    const id = `r${String(next++)}`; nodes[id] = { op: name, ...(inputs === undefined ? {} : { in: inputs }), ...extra }; return id;
  };
  const add = (a: GraphRef, b: GraphRef): string => op('add', [a, b]), mul = (a: GraphRef, b: GraphRef): string => op('mul', [a, b]);
  const sway = op('attribute', undefined, { name: 'aSway', type: 'vec2' }), t = op('time');
  const w = op('swizzle', [sway], { mask: 'x' }), ph = op('swizzle', [sway], { mask: 'y' });
  // the current: g = sin(t·0.8 + ph)·0.7 + sin(t·1.9 + ph·1.7)·0.3 along x, a slower cos along z, dipping by |g|
  const g = add(mul(op('sin', [add(mul(t, 0.8), ph)]), 0.7), mul(op('sin', [add(mul(t, 1.9), mul(ph, 1.7))]), 0.3));
  const offset = op('combine', [mul(mul(g, w), 0.35), mul(mul(op('abs', [g]), w), -0.08), mul(mul(op('cos', [add(mul(t, 0.65), mul(ph, 1.3))]), w), 0.28)]);
  return { version: 1, kind: 'material', model: 'toon', doubleSided: true, flatShading: true, nodes,
    stages: { 'vertex.offset': { offset }, surface: { colour: op('vertexColour'), roughness: 0.8, metalness: 0 } } };
}

/** The reef's graph by look.materials id. */
export const REEF_GRAPHS: Readonly<Record<string, GraphIr>> = { [REEF_LOOK]: reefGraph() };
