import { SKY_PAINTER_GRAPH, type SkyGraph, type SkyGraphNode, type SkyGraphStage } from '../data/skyLook';

/**
 * A look over its model's own colour map (SF59 `meshMap`, bound per map by world/looks.ts `skyMappedLook`) in the painted
 * light: `c` is the map's linear colour (`cr` / `cg` / `cb` its channels), `nodes` build on it and `surface` names the
 * outputs, matte as the hero models' painted material (roughness 0.85). A helper, so it lives outside data/ (whose exports
 * are serialisable rows); the graphs it builds stay rows in data/.
 */
export function skyMapGraph(nodes: Readonly<Record<string, SkyGraphNode>>, surface: SkyGraphStage): SkyGraph {
  return { version: 1, kind: 'material', model: 'standard',
    nodes: { ...SKY_PAINTER_GRAPH.nodes, mm: { op: 'meshMap' }, c: { op: 'swizzle', in: ['mm'], mask: 'xyz' },
      cr: { op: 'swizzle', in: ['c'], mask: 'x' }, cg: { op: 'swizzle', in: ['c'], mask: 'y' }, cb: { op: 'swizzle', in: ['c'], mask: 'z' }, ...nodes },
    stages: { surface: { roughness: 0.85, metalness: 0, ...surface }, lighting: SKY_PAINTER_GRAPH.lighting } };
}
