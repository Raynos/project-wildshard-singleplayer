import type { GraphIr, GraphNode } from '@wildshard/format/materialGraph';
import rows from '../data/heldProfile.generated.json' with { type: 'json' };

/** Select original GLB channels at build time; no per-vertex startup repair. */
export function heldRigGraphs(graphs: Readonly<Record<string, GraphIr>>): Readonly<Record<string, GraphIr>> {
  return Object.fromEntries(rows.map(row => {
    const source = graphs[row.hull ? 'nine-vm-hull' : 'nine-vm-body'];
    if (source === undefined) throw new Error('Missing held base graph');
    const channel = (node: GraphNode): GraphNode => {
      if (node.op === 'vertexColour' && !row.attributes.includes('COLOR_0')) return { op: 'const', value: [1, .5, .5] };
      if (node.op !== 'attribute') return node;
      if (node.name === 'aFace' && !row.attributes.includes('_AFACE')) return { op: 'const', value: [0, 0, 0, 0] };
      return node;
    };
    const params = { ...source.params };
    if (row.hull) params['uHullK'] = { type: 'float', value: row.width };
    else {
      params['uTexOn'] = { type: 'float', value: row.maps === '' ? 0 : 1 };
      for (const [i, axis] of ['X', 'Y', 'Z'].entries()) params[`asset${axis}`] = { type: 'vec3', value: row.rotation.slice(i * 3, i * 3 + 3) };
    }
    return [row.look, { ...source, nodes: Object.fromEntries(Object.entries(source.nodes).map(([id, node]) => [id, channel(node)])), params }];
  }));
}
