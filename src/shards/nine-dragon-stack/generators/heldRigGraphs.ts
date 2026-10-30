import { checkAuthorGraph, type AuthorGraph as GraphIr, type AuthorGraphNode as GraphNode } from '@wildshard/sdk/bake/materialGraph';
import type { NineHeldProfile } from './heldProfile';

/**
 * Each held mesh's graph from its base, its GLB channels chosen by parameters, not by rewriting the graph (EP7): every
 * body mesh is then one graph shape and shares one program per draw kind (skinned, double-sided). A mesh with no
 * COLOR_0 reads the maps' neutral [1, .5, .5] (`uNoColour`, the constant it was rewritten to); one with no `_AFACE` reads
 * the attribute's default, zero.
 */
export function heldRigGraphs(graphs: Readonly<Record<string, GraphIr>>, profile: NineHeldProfile): Readonly<Record<string, GraphIr>> {
  return Object.fromEntries(profile.meshes.map(row => {
    const source = graphs[row.hull ? 'nine-vm-hull' : 'nine-vm-body'];
    if (source === undefined) throw new Error('Missing held base graph');
    const extra: Record<string, GraphNode> = {};
    const channel = (node: GraphNode): GraphNode => {
      if (node.op === 'vertexColour') {
        extra['heldColour'] = { op: 'vertexColour' };
        extra['heldNoColour'] = { op: 'gt', in: ['heldNoColourParam', .5] };
        extra['heldNoColourParam'] = { op: 'param', param: 'uNoColour' };
        return { op: 'select', in: ['heldNoColour', [1, .5, .5], 'heldColour'] };
      }
      if (node.op === 'attribute' && node.name === 'aFace') return { ...node, default: [0, 0, 0, 0] };
      return node;
    };
    const nodes = Object.fromEntries(Object.entries(source.nodes).map(([id, node]) => [id, channel(node)]));
    const params = { ...source.params };
    if ('heldColour' in extra) params['uNoColour'] = { type: 'float', value: row.attributes.includes('COLOR_0') ? 0 : 1 };
    if (row.hull) params['uHullK'] = { type: 'float', value: row.width };
    else {
      params['uTexOn'] = { type: 'float', value: row.maps === '' ? 0 : 1 };
      for (const [i, axis] of ['X', 'Y', 'Z'].entries()) params[`asset${axis}`] = { type: 'vec3', value: row.rotation.slice(i * 3, i * 3 + 3) };
    }
    return [row.look, sealed({ ...source, nodes: { ...nodes, ...extra }, params })];
  }));
}

/** `graph` checked and its budget set to its own cost, as the look graphs finish (lookGraph.ts) */
function sealed(graph: GraphIr): GraphIr {
  const checked = checkAuthorGraph({ ...graph, budget: { nodes: 4096, samplers: 8, instructions: 8192 } });
  if (!checked.ok) throw new Error([...new Set(checked.errors)].slice(0, 12).join('\n'));
  return { ...checked.graph, budget: { nodes: Math.max(1, checked.cost.nodes), samplers: Math.max(1, checked.cost.samplers), instructions: Math.max(1, checked.cost.instructions) } };
}
