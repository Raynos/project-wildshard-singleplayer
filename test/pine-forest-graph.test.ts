import { expect, test } from 'vitest';
import { compileGraph } from '../src/engine/render/graph/compile';
import { validateGraph } from '../src/format/materialGraph';
import { FOREST_LOOKS, FOREST_TEXTURES } from '../src/shards/pine-hollow/data/forestLook';
import { FOREST_GRAPHS } from '../src/shards/pine-hollow/generators/forestGraphs';

test("Pine's forest graphs validate in their budgets and compile swayed, dissolving trees with lent textures", () => {
  const lent: Record<string, readonly string[]> = {
    [FOREST_LOOKS.bark]: FOREST_TEXTURES.bark, [FOREST_LOOKS.needles]: FOREST_TEXTURES.cards,
    [FOREST_LOOKS.twigs]: FOREST_TEXTURES.cards, [FOREST_LOOKS.far]: FOREST_TEXTURES.far,
  };
  for (const id of Object.values(FOREST_LOOKS)) {
    const graph = FOREST_GRAPHS[id];
    if (graph === undefined) throw new Error(`no ${id}`);
    const checked = validateGraph(graph, { trustedBudget: true });
    expect(checked.ok ? [] : checked.errors, id).toEqual([]);
    for (const name of lent[id] ?? []) expect(graph.params?.[name]?.role, `${id} ${name}`).toBe('lent');
    expect(graph.stages['vertex.offset'], id).toBeDefined();
    expect(graph.stages.surface?.discard, id).toBeDefined();
    // the cards and the bark cast their swayed, dissolving shadow; the impostor casts none
    expect(graph.stages['vertex.offset']?.shadow === true, id).toBe(id !== FOREST_LOOKS.far);
    const compiled = compileGraph(graph, { trustedBudget: true });
    try {
      compiled.setParam('fade', [48, 60]);
      compiled.setParam('viewer', [10, 2, -30]);
    } finally { compiled.material.dispose(); }
  }
  const bark = FOREST_GRAPHS[FOREST_LOOKS.bark];
  const arrays = Object.values(bark?.nodes ?? {}).filter((n) => n.op === 'textureArray').map((n) => n.param);
  expect(new Set(arrays)).toEqual(new Set(FOREST_TEXTURES.bark));
});
