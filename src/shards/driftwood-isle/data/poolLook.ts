import type { GraphIr, GraphNode, GraphRef } from '@wildshard/format/materialGraph';

/**
 * The sea cave's pools (world/Cove.ts) as an SF59 material graph (SHARD-PLATFORM W2 C2; the shardfile's `look.materials`,
 * compiled by the hybrid runtime): the toon family's light model (the catalogue's live toon look, following the day clock:
 * look/toon.ts `followToon`), flat-shaded deep blue-green water (sRGB #0a2540), roughness 0.4 so the sun catches it, 90 %
 * opaque, with concentric ripple rings drifting outward on the frame clock: a ripple centre per 9 m world cell (each pool
 * gets its own), their crests and a faint cross-ripple tinting the water toward a lighter teal.
 */

/** the look.materials id the cove's pools wear */
export const POOL_LOOK = 'driftwood-cove-pool';
/** #0a2540 as linear RGB */
const DEEP = [0.003035, 0.018500, 0.051269] as const;

function poolGraph(): GraphIr {
  const nodes: Record<string, GraphNode> = {};
  let next = 0;
  const op = (name: string, inputs?: readonly GraphRef[], extra?: Omit<GraphNode, 'op' | 'in'>): string => {
    const id = `p${String(next++)}`; nodes[id] = { op: name, ...(inputs === undefined ? {} : { in: inputs }), ...extra }; return id;
  };
  const add = (a: GraphRef, b: GraphRef): string => op('add', [a, b]), mul = (a: GraphRef, b: GraphRef): string => op('mul', [a, b]);
  const sin = (a: GraphRef): string => op('sin', [a]), swz = (a: GraphRef, mask: string): string => op('swizzle', [a], { mask });
  const wp = op('positionWorld'), t = op('time'), x = swz(wp, 'x'), z = swz(wp, 'z');
  // r = |fract(xz · 0.11) − 0.5| · 9; w = ½ + ½ sin(6r − 2.2t) sin(3.1x + t); crest = smoothstep(0.75, 1, w)
  const r = mul(op('length', [op('sub', [op('fract', [mul(swz(wp, 'xz'), 0.11)]), 0.5])]), 9);
  const w = add(0.5, mul(mul(sin(op('sub', [mul(r, 6), mul(t, 2.2)])), sin(add(mul(x, 3.1), t))), 0.5));
  const crest = op('smoothstep', [0.75, 1, w]);
  const tint = add(mul(crest, 0.4), mul(sin(add(mul(z, 5), mul(t, 1.7))), 0.06));
  return { version: 1, kind: 'material', model: 'toon', flatShading: true, effectState: { blend: 'alpha' }, nodes,
    stages: { surface: { colour: op('mix', [[...DEEP], [0.12, 0.4, 0.5], tint]), alpha: 0.9, roughness: 0.4, metalness: 0 } } };
}

/** The pools' graph by look.materials id. */
export const POOL_GRAPHS: Readonly<Record<string, GraphIr>> = { [POOL_LOOK]: poolGraph() };
