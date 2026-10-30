import { checkAuthorGraph, type AuthorGraph as GraphIr, type AuthorGraphNode as GraphNode } from '@wildshard/sdk/bake/materialGraph';
import type { NineHeldProfile } from './heldProfile';

/**
 * A held graph whose GLB channels are chosen by parameters, not by rewriting the graph (EP7): `uNoColour` 1 reads the
 * maps' neutral [1, .5, .5] in place of a missing COLOR_0 (the constant it was rewritten to), 0 the vertex colour, and
 * `aFace` reads its attribute default, zero, where a mesh has no `_AFACE`. The base body and every held body mesh are then
 * one graph shape and share one program per draw kind (skinned, double-sided).
 */
export function heldChannels(source: GraphIr): GraphIr {
  const extra: Record<string, GraphNode> = {};
  const channel = (node: GraphNode): GraphNode => {
    if (node.op === 'vertexColour') {
      extra['heldColour'] = { op: 'vertexColour' };
      extra['heldNoColourParam'] = { op: 'param', param: 'uNoColour' };
      extra['heldNoColour'] = { op: 'gt', in: ['heldNoColourParam', .5] };
      return { op: 'select', in: ['heldNoColour', [1, .5, .5], 'heldColour'] };
    }
    if (node.op === 'attribute' && node.name === 'aFace') return { ...node, default: [0, 0, 0, 0] };
    return node;
  };
  const nodes = Object.fromEntries(Object.entries(source.nodes).map(([id, node]) => [id, channel(node)]));
  const params = 'heldColour' in extra ? { ...source.params, uNoColour: { type: 'float' as const, value: 0 } } : source.params;
  return sealed({ ...source, nodes: { ...nodes, ...extra }, ...(params === undefined ? {} : { params }) });
}

/** Each held mesh's graph from its (channelled) base, its own channels and placement as parameters. */
export function heldRigGraphs(graphs: Readonly<Record<string, GraphIr>>, profile: NineHeldProfile): Readonly<Record<string, GraphIr>> {
  return Object.fromEntries(profile.meshes.map(row => {
    const source = graphs[row.hull ? 'nine-vm-hull' : 'nine-vm-body'];
    if (source === undefined) throw new Error('Missing held base graph');
    const params = { ...source.params };
    if (params['uNoColour'] !== undefined) params['uNoColour'] = { type: 'float', value: row.attributes.includes('COLOR_0') ? 0 : 1 };
    if (row.hull) params['uHullK'] = { type: 'float', value: row.width };
    else {
      params['uTexOn'] = { type: 'float', value: row.maps === '' ? 0 : 1 };
      for (const [i, axis] of ['X', 'Y', 'Z'].entries()) params[`asset${axis}`] = { type: 'vec3', value: row.rotation.slice(i * 3, i * 3 + 3) };
    }
    return [row.look, { ...source, params }];
  }));
}

/** `graph` checked and its budget set to its own cost, as the look graphs finish (lookGraph.ts) */
function sealed(graph: GraphIr): GraphIr {
  const checked = checkAuthorGraph({ ...graph, budget: { nodes: 4096, samplers: 8, instructions: 8192 } });
  if (!checked.ok) throw new Error([...new Set(checked.errors)].slice(0, 12).join('\n'));
  return { ...checked.graph, budget: { nodes: Math.max(1, checked.cost.nodes), samplers: Math.max(1, checked.cost.samplers), instructions: Math.max(1, checked.cost.instructions) } };
}
