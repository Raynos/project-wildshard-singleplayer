import { expect, test } from 'vitest';
import { compileGraph } from '../src/engine/render/graph/compile';
import { validateGraph } from '../src/format/materialGraph';
import { CRAG_LOOK } from '../src/shards/pine-hollow/data/cragLook';
import lookGraphs from '../src/shards/pine-hollow/data/lookGraphs.json' with { type: 'json' };
import { authoredGraphs } from './fixtures/authoredGraphs';

const CRAG_GRAPHS = authoredGraphs(lookGraphs.runtime);

test("Pine's crag graph validates in its budget and compiles a lit, sun-reach-scaled granite with lent textures", () => {
  const graph = CRAG_GRAPHS[CRAG_LOOK];
  if (graph === undefined) throw new Error('no crag graph');
  const checked = validateGraph(graph, { trustedBudget: true });
  expect(checked.ok ? [] : checked.errors).toEqual([]);
  // the kit's vertex data under graph-legal names; every texture is lent by world/crags.ts
  const attributes = Object.values(graph.nodes).filter((n) => n.op === 'attribute').map((n) => n.name);
  expect(new Set(attributes)).toEqual(new Set(['aCdata', 'aCtint']));
  for (const name of ['rockMap', 'rockNormal', 'rockArm', 'gritMap', 'gritNormal']) expect(graph.params?.[name]?.role).toBe('lent');
  expect(graph.stages['vertex.scale']?.sun).toBeDefined();
  expect(graph.stages['vertex.scale']?.fog).toBeDefined();
  const compiled = compileGraph(graph, { trustedBudget: true });
  try {
    compiled.setParam('caveFill', 0.4);
    expect(() => { compiled.setParam('caveFill', 9); }).toThrow();
  } finally { compiled.material.dispose(); }
});
