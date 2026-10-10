import { expect, it } from 'vitest';
import { emptyShardfile } from '@wildshard/sdk/author';
import { parseShardfile } from '@wildshard/game/shardfile/schema';
import { DEFAULT_GRAPH_BUDGET, validateGraph, type GraphIr, type GraphNode } from '@wildshard/engine/core/materialGraph';
import { materialGraphRules } from '../src/game/shardfile/materials';
import { parseFamilyMaterial, parsePainterlyLook, parseToonLook } from '../src/engine/render/families/params';
import { painterlyGraph, PRESET_GRAPH_BUDGET, toonGraph } from '../src/engine/render/graph/presets';

const lighting = (): GraphIr => ({
  version: 1, kind: 'material', model: 'standard', flatShading: true,
  params: { specular: { type: 'float', value: 0.2, bind: { state: 'shared.wet' } }, tint: { type: 'colour', value: [0.2, 0.3, 0.4], bind: { day: 'fog.colour' } } },
  nodes: {
    colour: { op: 'const', value: [0.2, 0.4, 0.6] },
    n: { op: 'normalView' }, l: { op: 'sunDirection' }, c: { op: 'sunColour' }, sh: { op: 'sunShadow' }, a: { op: 'albedo' },
    ndl: { op: 'dot', in: ['n', 'l'] }, band: { op: 'step', in: [0.2, 'ndl'] }, k: { op: 'mul', in: ['band', 'sh'] },
    ca: { op: 'mul', in: ['c', 'a'] }, sun: { op: 'mul', in: ['ca', 'k'] }, specular: { op: 'param', param: 'specular' },
    irr: { op: 'irradiance' }, tint: { op: 'param', param: 'tint' }, amb0: { op: 'add', in: ['irr', 'tint'] }, amb: { op: 'mul', in: ['amb0', 'a'] },
    lc: { op: 'litColour' }, graded: { op: 'mul', in: ['lc', 1.1] },
  },
  stages: { surface: { colour: 'colour', roughness: 0.8 }, lighting: { sun: 'sun', sunSpecular: 'specular', ambient: 'amb', grade: 'graded' } },
});
const product = (graph: unknown) => {
  const base = emptyShardfile({ slug: 'lit-graph', name: 'Lighting', author: 'Local', seed: 1, revision: 1 });
  base.state.shared.push({ id: 1, name: 'wet', type: 'f64', privacy: 'public', default: 0.2 });
  base.look.keys.push({ time: 0, sky: { zenith: [0, 0, 0], horizon: [1, 1, 1] }, fog: { colour: [0.2, 0.3, 0.4], density: 0 }, sun: { colour: [1, 1, 1], intensity: 1 }, ambient: { sky: [1, 1, 1], ground: [0, 0, 0], intensity: 1 } });
  return { ...base, look: { ...base.look, materials: { lit: { family: 'graph', graph } } } };
};
it('preserves lighting and flatShading through full admission with scoped state and day bindings', () => {
  const program = lighting(), source = parseShardfile(product(program)), material = source.look.materials['lit'];
  if (material?.family !== 'graph' || !('graph' in material)) throw new Error('expected graph material');
  expect(material.graph).toEqual(program); expect(materialGraphRules(source)).toEqual([]);
  const checked = validateGraph(material.graph);
  if (!checked.ok) throw new Error(checked.errors.join('; '));
  expect(checked.cost.nodes).toBeLessThan(DEFAULT_GRAPH_BUDGET.nodes);
  expect(checked.cost.instructions).toBeLessThan(DEFAULT_GRAPH_BUDGET.instructions);
  expect(checked.cost.samplers).toBe(0);
  expect(() => parseShardfile(product({ ...program, params: { ...program.params, specular: { type: 'float', value: 1, bind: { state: 'shared.missing' } } } }))).toThrow();
  expect(() => parseShardfile(product({ ...program, params: { ...program.params, tint: { type: 'float', value: 1, bind: { day: 'fog.colour' } } } }))).toThrow();
});
it.each([
  { ...lighting(), flatShading: 'true' },
  { ...lighting(), model: 'unlit' },
  { ...lighting(), stages: { surface: lighting().stages.surface, lighting: { ambient: 'amb' } } },
  { ...lighting(), stages: { ...lighting().stages, lighting: { sun: 'amb' } } },
  { ...lighting(), stages: { ...lighting().stages, lighting: { sun: 'sun', sunSpecular: 'ca' } } },
  { ...lighting(), stages: { ...lighting().stages, lighting: { sun: 'sun', ambient: 'graded' } } },
  { ...lighting(), stages: { ...lighting().stages, lighting: { sun: 'sun', grade: 'sun' } } },
  { ...lighting(), stages: { ...lighting().stages, lighting: { sun: 'sun', shader: 'void main() {}' } } },
])('refuses malformed lighting data or stage-local inputs through the shardfile slot: %o', (program) => {
  expect(() => parseShardfile(product(program))).toThrow();
});
it('retains the exact raw-node cap with a lighting stage, including unreachable nodes', () => {
  const program = lighting(), nodes: Record<string, GraphNode> = { ...program.nodes };
  for (let i = Object.keys(nodes).length; i < DEFAULT_GRAPH_BUDGET.nodes; i++) nodes[`unused${i}`] = { op: 'const', value: 0 };
  expect(() => parseShardfile(product({ ...program, nodes }))).not.toThrow();
  nodes['oneTooMany'] = { op: 'const', value: 0 };
  expect(() => parseShardfile(product({ ...program, nodes }))).toThrow();
  const source = parseShardfile(product(program)); source.look.materials['lit'] = { family: 'graph', graph: { ...program, nodes } };
  expect(materialGraphRules(source).join('; ')).toContain('all nested nodes counted');
});
it('charges lighting instructions to the same author budget without a trusted-preset override', () => {
  const program = lighting(), nodes: Record<string, GraphNode> = { ...program.nodes };
  let total = 'lc';
  for (let i = 0; i < 13; i++) {
    nodes[`noise${i}`] = { op: 'noise', in: [[0.1, 0.2, 0.3]] };
    nodes[`sum${i}`] = { op: 'add', in: [total, `noise${i}`] }; total = `sum${i}`;
  }
  const expensive: GraphIr = { ...program, nodes, stages: { ...program.stages, lighting: { sun: 'sun', grade: total } } };
  expect(() => parseShardfile(product(expensive))).toThrow();
  const source = parseShardfile(product(program)); source.look.materials['lit'] = { family: 'graph', graph: expensive };
  expect(materialGraphRules(source).join('; ')).toContain('instructions (at most 480)');
});
it('keeps large trusted lighting presets distinct from the bounded authored graph budget', () => {
  const toon = parseFamilyMaterial({ family: 'toon', colour: [0.85, 0.6, 0.4] });
  const paint = parseFamilyMaterial({ family: 'painterly', colour: [0.5, 0.7, 0.3], sway: 0.1 });
  if (toon.family !== 'toon' || paint.family !== 'painterly') throw new Error('preset families');
  const wet = toonGraph(toon, parseToonLook({ caustics: { level: 1.5, strength: 0.5 } }));
  const sway = painterlyGraph(paint, parsePainterlyLook({}));
  for (const [graph, instructions] of [[wet, 661], [sway, 546]] as const) {
    const result = validateGraph(graph, { budget: PRESET_GRAPH_BUDGET });
    if (!result.ok) throw new Error(result.errors.join('; '));
    expect(result).toMatchObject({ ok: true, cost: { instructions } });
    expect(result.cost.nodes).toBeGreaterThan(DEFAULT_GRAPH_BUDGET.nodes);
    const author = validateGraph(graph);
    if (author.ok) throw new Error('Expected raw-node refusal');
    expect(author.errors.join('; ')).toMatch(/nodes \(at most 160\)/);
    expect(() => parseShardfile(product(graph))).toThrow();
  }
});
