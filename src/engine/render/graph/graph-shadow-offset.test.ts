// DW23 (sp-x6's bisect, 180df449c9): a graph's `shadow.offset` moves where its received shadow is looked up. TSL applies it
// (receivedShadowPositionNode = positionWorld + offset); the classic GLSL program must too: at the world position three's
// per-vertex shadow coordinates are made from, restored after.
import { expect, test } from 'vitest';
import type { GraphIr } from '@wildshard/format/materialGraph';
import { emitClassicGraph, graphShaders } from './glslProgram';

const lit = (stages: GraphIr['stages']): GraphIr => ({ version: 1, kind: 'material', model: 'standard',
  params: { sunward: { type: 'vec3', value: [0.5, 0.25, 0] } },
  nodes: { sunwardP: { op: 'param', param: 'sunward' } }, stages: { surface: { colour: [0.8, 0.7, 0.6] }, ...stages } });

test('the GLSL shadow lookup moves by the graph\'s shadow.offset and restores the world position after it', () => {
  const vertex = graphShaders(emitClassicGraph(lit({ 'shadow.offset': { offset: 'sunwardP' } }))).vertexShader;
  const moved = vertex.indexOf('worldPosition.xyz +='), lookup = vertex.indexOf('#include <shadowmap_vertex>'), restored = vertex.indexOf('worldPosition = wsUnshadowedWorld;');
  expect(moved).toBeGreaterThan(vertex.indexOf('#include <worldpos_vertex>'));
  expect(lookup).toBeGreaterThan(moved); expect(restored).toBeGreaterThan(lookup);
  expect(vertex.slice(moved, lookup)).toMatch(/sunward/u);
});

test('a graph without shadow.offset keeps three\'s own shadow lookup untouched', () => {
  const vertex = graphShaders(emitClassicGraph(lit({}))).vertexShader;
  expect(vertex).toContain('#include <shadowmap_vertex>');
  expect(vertex).not.toContain('wsUnshadowedWorld');
});
