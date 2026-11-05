import { expect, test } from 'vitest';
import { DoubleSide } from 'three';
import { compileClassicGraph } from '../src/engine/client/render/graph/glslMaterial';
import { validateGraph } from '@wildshard/format/materialGraph';
import { WILDLIFE_LOOK } from '../src/shards/pine-hollow/generators/wildlifeLook';
import lookGraphs from '../src/shards/pine-hollow/data/lookGraphs.json' with { type: 'json' };
import { authoredGraphs } from './fixtures/authoredGraphs';

const WILDLIFE_GRAPHS = authoredGraphs(lookGraphs.views);

test("Pine's wildlife graph validates in its budget and compiles a posed, double-sided, glowing material", () => {
  const graph = WILDLIFE_GRAPHS[WILDLIFE_LOOK];
  if (graph === undefined) throw new Error('no wildlife graph');
  const checked = validateGraph(graph, { trustedBudget: true });
  expect(checked.ok ? [] : checked.errors).toEqual([]);
  const compiled = compileClassicGraph(graph, { trustedBudget: true });
  try {
    expect(compiled.material.side).toBe(DoubleSide);
    expect(compiled.glsl.program?.outputs.position).toBeTruthy();
    expect(compiled.material.vertexShader).toContain(compiled.glsl.program?.outputs.position ?? 'no position');
    compiled.setParam('glow', 0.8);
  } finally { compiled.material.dispose(); }
});
