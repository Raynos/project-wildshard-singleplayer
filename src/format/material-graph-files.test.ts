import { expect, test } from 'vitest';
import * as v from 'valibot';
import { INLINE_GRAPH_REFUSAL, MaterialsSchema, inlineGraphRules, materialGraphIr } from './materials';

const graph = { version: 1, kind: 'material', model: 'toon', nodes: { paint: { op: 'const', type: 'vec3', value: [1, 1, 1] } }, stages: { surface: { colour: 'paint' } } };

test('a built product refuses an inline catalogue graph with its reason (D74: the SDK lowers it into a graph file)', () => {
  // the authored declaration still parses with its inline graph; product admission is the wire boundary
  const authored = v.parse(MaterialsSchema, { cel: { family: 'graph', graph }, file: { family: 'graph', file: 'a'.repeat(64) } });
  expect(inlineGraphRules(authored)).toEqual([`material cel: ${INLINE_GRAPH_REFUSAL}`]);
  expect(INLINE_GRAPH_REFUSAL).toBe('material catalogue holds no inline graph: the SDK lowers an authored graph into a graph file { family: "graph", file }');
});

test('a reader takes a graph file only', () => {
  const bytes = new TextEncoder().encode(JSON.stringify(graph)), file = 'a'.repeat(64);
  expect(materialGraphIr({ family: 'graph', file }, hash => (hash === file ? bytes : undefined)).model).toBe('toon');
  const inline = v.parse(MaterialsSchema, { cel: { family: 'graph', graph } })['cel'];
  if (inline === undefined) throw new Error('Missing fixture entry');
  expect(() => materialGraphIr(inline, () => undefined)).toThrow('material graph IR needs a graph file');
});
