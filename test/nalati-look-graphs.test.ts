import { expect, test } from 'vitest';
import { compileGraph } from '../src/engine/render/graph/compile';
import { validateGraph } from '../src/format/materialGraph';
import lookGraphs from '../src/shards/nalati-grasslands/data/lookGraphs.json' with { type: 'json' };

const GRAPHS: Readonly<Record<string, unknown>> = lookGraphs;

/** the graphs that replaced Nalati's hand-written GLSL programs, with the live params their runtime writes */
const LIVE: Readonly<Record<string, Readonly<Record<string, number | readonly number[]>>>> = {
  'nalati-motes': { drift: [3, -2], px: 900, opacity: 0.5 },
  'nalati-rain': { offset: [1, 2, 3], velocity: [1, -9, 0.5], length: 0.9, colour: [0.5, 0.55, 0.6], alpha: 0.3 },
  'nalati-crag': { rockMean: [0.4, 0.42, 0.45], scale: [0.1, 0.05], snowBand: [40, 52], shade: [0.1, 0.14, 0.3], rim: [1.4, 1.2, 0.9], wet: 0.5 },
  'nalati-crag-phone': { rockMean: [0.4, 0.42, 0.45], scale: [0.1, 0.05], snowBand: [40, 52] },
  'nalati-riders': { clock: 12.5, shade: [0.1, 0.14, 0.3], rim: [1.4, 1.2, 0.9], wet: 0.2 },
};

test("Nalati's former GLSL programs validate as look graphs, compile and take their live params", () => {
  const painted = validateGraph(GRAPHS['nalati-fog'], { trustedBudget: true });
  if (!painted.ok) throw new Error(painted.errors.join('; '));
  const fog = compileGraph(painted.graph, { trustedBudget: true });
  try {
    for (const [id, values] of Object.entries(LIVE)) {
      const checked = validateGraph(GRAPHS[id], { trustedBudget: true });
      if (!checked.ok) throw new Error(`${id}: ${checked.errors.join('; ')}`);
      const compiled = compileGraph(checked.graph, { trustedBudget: true, fog: () => { if (fog.fog === null) throw new Error('Missing painted fog'); return fog.fog; } });
      try {
        for (const [name, value] of Object.entries(values)) compiled.setParam(name, value);
      } finally { compiled.material.dispose(); }
    }
  } finally { fog.material.dispose(); }
  const motes = validateGraph(GRAPHS['nalati-motes'], { trustedBudget: true });
  expect(motes.ok && motes.graph.primitive).toBe('points');
});
