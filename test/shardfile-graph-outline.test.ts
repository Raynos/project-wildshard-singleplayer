import { expect, it } from 'vitest';
import { emptyShardfile } from '@wildshard/sdk/author';
import { parseShardfile } from '@wildshard/game/shardfile/schema';
import { DEFAULT_GRAPH_BUDGET, validateGraph, type GraphIr, type GraphNode } from '@wildshard/engine/core/materialGraph';
import { materialGraphRules } from '../src/game/shardfile/materials';

function outlined(): GraphIr {
  return { version: 1, kind: 'material', model: 'standard', nodes: {
    colour: { op: 'const', value: [0.5, 0.5, 0.5] }, ink: { op: 'const', value: [0.02, 0.02, 0.02] },
    origin: { op: 'objectOrigin' }, local: { op: 'worldToLocal', in: ['origin'] }, geometry: { op: 'positionGeometry' },
    sum: { op: 'add', in: ['local', 'geometry'] }, offset: { op: 'mul', in: ['sum', 0.002] },
    view: { op: 'const', value: [0, 1, 0] }, world: { op: 'viewToWorld', in: ['view'] },
  }, stages: { surface: { colour: 'colour' }, 'vertex.offset': { offset: 'offset' }, outline: { offset: 'offset', colour: 'ink' } } };
}
function product(graph: unknown) {
  const source = emptyShardfile({ slug: 'outlined', name: 'Outline', author: 'Test', seed: 1, revision: 1 });
  return { ...source, look: { ...source.look, materials: { ink: { family: 'graph', graph } } } };
}
it('preserves the outline and object-space inputs through full admission under the existing cost model', () => {
  const program = outlined(), source = parseShardfile(product(program)), entry = source.look.materials['ink'];
  if (entry?.family !== 'graph' || !('graph' in entry)) throw new Error('Missing graph');
  expect(entry.graph).toEqual(program); expect(materialGraphRules(source)).toEqual([]);
  expect(() => parseShardfile(product({ ...program, stages: { ...program.stages, surface: { colour: 'world' } } }))).not.toThrow();
  const full = validateGraph(entry.graph), plain = validateGraph({ ...program, stages: { surface: program.stages.surface, 'vertex.offset': program.stages['vertex.offset'] } });
  if (!full.ok || !plain.ok) throw new Error('Invalid fixture');
  expect(full.cost.nodes).toBeGreaterThan(plain.cost.nodes); expect(full.cost.instructions).toBeGreaterThan(plain.cost.instructions);
});
it.each([
  { ...outlined(), stages: { ...outlined().stages, outline: { offset: 'offset', colour: 'ink', side: 'front' } } },
  { ...outlined(), stages: { ...outlined().stages, outline: { offset: 'offset' } } },
  { ...outlined(), stages: { ...outlined().stages, outline: { offset: [0, 1], colour: 'ink' } } },
  { ...outlined(), nodes: { ...outlined().nodes, albedo: { op: 'albedo' } }, stages: { ...outlined().stages, outline: { offset: 'offset', colour: 'albedo' } } },
  { ...outlined(), stages: { ...outlined().stages, surface: { colour: 'origin' } } },
  { ...outlined(), stages: { ...outlined().stages, surface: { colour: 'local' } } },
  { ...outlined(), nodes: { ...outlined().nodes, world: { op: 'viewToWorld', in: [[0, 1]] } }, stages: { ...outlined().stages, surface: { colour: 'world' } } },
].map((graph, index) => ({ graph, index })))('refuses arbitrary outline state and invalid types/stage inputs through the shardfile slot $index', ({ graph }) => {
  expect(() => parseShardfile(product(graph))).toThrow();
});
it('retains the author raw-node ceiling including unreachable outline inputs', () => {
  const graph = outlined(), nodes: Record<string, GraphNode> = { ...graph.nodes };
  for (let i = Object.keys(nodes).length; i < DEFAULT_GRAPH_BUDGET.nodes; i++) nodes[`unused${i}`] = { op: 'const', value: 0 };
  expect(() => parseShardfile(product({ ...graph, nodes }))).not.toThrow();
  nodes['extra'] = { op: 'const', value: 0 };
  expect(() => parseShardfile(product({ ...graph, nodes }))).toThrow();
});
