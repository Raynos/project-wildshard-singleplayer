import { expect, test } from 'vitest';
import { compileGraph } from '../src/engine/render/graph/compile';
import { validateGraph, type GraphIr } from '../src/format/materialGraph';
import lookGraphs from '../src/shards/nalati-grasslands/data/lookGraphs.json' with { type: 'json' };

const GRAPHS: Readonly<Record<string, unknown>> = lookGraphs;

test("the Storm Titan's cloud, flame and smoke graphs validate, compile and take their live params", () => {
  const params: Readonly<Record<string, Readonly<Record<string, number | readonly number[]>>>> = {
    'nalati-titan-cloud': { t: 12.5, heart: [3, 40, -60], glow: 0.9, flash: 1, alpha: 0.5, fogC: [0.3, 0.32, 0.4], fog: 0.2 },
    'nalati-titan-flame': { t: 12.5, wind: [0.2, -0.1] },
    'nalati-titan-smoke': { t: 12.5, fogC: [0.3, 0.32, 0.4], flash: 0.4 },
  };
  for (const [id, values] of Object.entries(params)) {
    const raw = GRAPHS[id];
    const checked = validateGraph(raw, { trustedBudget: true });
    if (!checked.ok) throw new Error(`${id}: ${checked.errors.join('; ')}`);
    const graph: GraphIr = checked.graph;
    expect(graph.effectState?.fog).toBe(false);
    const compiled = compileGraph(graph, { trustedBudget: true });
    try {
      for (const [name, value] of Object.entries(values)) compiled.setParam(name, value);
    } finally { compiled.material.dispose(); }
  }
  const blend = (id: string): string | undefined => { const r = validateGraph(GRAPHS[id], { trustedBudget: true }); return r.ok ? r.graph.effectState?.blend : 'invalid'; };
  expect(blend('nalati-titan-flame')).toBe('additive');
  expect(blend('nalati-titan-smoke')).toBe('alpha');
});
