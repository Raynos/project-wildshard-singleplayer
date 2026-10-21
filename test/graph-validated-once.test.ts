import { expect, test } from 'vitest';
import { compileGraph } from '../src/engine/render/graph/compile';
import { validateGraph, type GraphIr } from '../src/format/materialGraph';

const glow = (): GraphIr => ({ version: 1, kind: 'material', model: 'unlit', nodes: {}, stages: { surface: { colour: [1, 0.5, 0] } } });

test('compile takes the caller\'s validation of the same graph instead of repeating it (O14)', () => {
  const checked = validateGraph(glow());
  if (!checked.ok) throw new Error(checked.errors.join('; '));
  const compiled = compileGraph(checked.graph, { validated: checked });
  expect(compiled.cost).toBe(checked.cost);
  compiled.material.dispose();
});

test('a validation of another graph is refused', () => {
  const checked = validateGraph(glow());
  if (!checked.ok) throw new Error(checked.errors.join('; '));
  expect(() => compileGraph(glow(), { validated: checked })).toThrow(/another graph/);
});
