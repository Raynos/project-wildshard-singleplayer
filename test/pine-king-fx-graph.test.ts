import { expect, test } from 'vitest';
import { compileGraph } from '../src/engine/render/graph/compile';
import { validateGraph } from '../src/format/materialGraph';
import { PINE_GRAPHS } from '../src/shards/pine-hollow/generators/lookMaterials';
import { KING_FX_LOOKS } from '../src/shards/pine-hollow/generators/kingFxLook';
import lookGraphs from '../src/shards/pine-hollow/data/lookGraphs.json' with { type: 'json' };
import { authoredGraphs } from './fixtures/authoredGraphs';

const KING_FX_GRAPHS = authoredGraphs(lookGraphs.runtime);

test("the Antler King's fog wall and lantern flame graphs validate, compile and take their live params", () => {
  for (const id of Object.values(KING_FX_LOOKS)) {
    const graph = KING_FX_GRAPHS[id];
    if (graph === undefined) throw new Error(`no graph ${id}`);
    expect(PINE_GRAPHS[id]).toEqual(graph);
    const checked = validateGraph(graph, { trustedBudget: true });
    expect(checked.ok ? [] : checked.errors).toEqual([]);
    expect(graph.effectState?.fog).toBe(false);
    const compiled = compileGraph(graph, { trustedBudget: true });
    try {
      compiled.setParam('alpha', 0.92);
      compiled.setParam('colour', [0.3, 0.32, 0.36]);
      expect(() => { compiled.setParam('alpha', 2); }).toThrow();
    } finally { compiled.material.dispose(); }
  }
  expect(KING_FX_GRAPHS[KING_FX_LOOKS.fog]?.effectState?.blend).toBe('alpha');
  expect(KING_FX_GRAPHS[KING_FX_LOOKS.flame]?.effectState?.blend).toBe('additive');
});
