import { expect, test } from 'vitest';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { compileGraph } from './compile';
import { copyNodeMaterialAccessors } from '../nodeMaterialCopy';
import type { GraphIr } from '@wildshard/format/materialGraph';

// D189: three r186's NodeMaterial.copy never reaches Material.copy, so a node material's clone lost alphaTest and a cut-out
// card cloned for a cell clip drew as an opaque quad
test('the helper restores the Material accessors three\'s NodeMaterial.copy drops', () => {
  const source = new MeshStandardNodeMaterial(); source.alphaTest = 0.45;
  const copy = source.clone();
  expect(copy.alphaTest).toBe(0);
  copyNodeMaterialAccessors(copy, source);
  expect(copy.alphaTest).toBe(0.45);
  source.dispose(); copy.dispose();
});

test.each(['standard', 'unlit', 'toon'] as const)('a compiled %s graph\'s clone keeps its alpha cutoff', model => {
  const ir: GraphIr = { version: 1, kind: 'material', model, nodes: {}, stages: { surface: { colour: [1, 1, 1], alpha: 0.75, alphaCutoff: 0.5 } } };
  const material = compileGraph(ir).material, copy = material.clone();
  expect(material.alphaTest).toBe(0.5);
  expect(copy.alphaTest).toBe(0.5);
  expect(copy.constructor).toBe(material.constructor);
  material.dispose(); copy.dispose();
});
