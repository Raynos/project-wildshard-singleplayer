import { expect, test } from 'vitest';
import * as THREE from 'three';
import { ConstNode, ConvertNode, JoinNode, MathNode, Node, OperatorNode, ReferenceNode, SplitNode, UniformNode, VarNode } from 'three/webgpu';
import { vec2 } from 'three/tsl';
import { compileGraph } from '../src/engine/render/graph/compile';
import { windGustAt, windUniforms } from '../src/engine/world/wind';
import { graph, windGustAt as windOp } from '../src/sdk/materials';
import { validateGraph, type GraphIr } from '../src/format/materialGraph';

/** Evaluate this small scalar arithmetic tree, including its live uniform references. */
function values(node: unknown): number[] {
  if (node instanceof VarNode || node instanceof ConvertNode) return values(node.node);
  if (node instanceof JoinNode) return node.nodes.flatMap(values);
  if (node instanceof SplitNode) {
    const source = values(node.node); return node.components.split('').map(c => source['xyzw'.indexOf(c)] ?? 0);
  }
  if (node instanceof ReferenceNode) {
    const object: unknown = Reflect.get(node, 'object');
    if (typeof object !== 'object' || object === null) throw new Error('Missing wind uniform owner');
    const value: unknown = Reflect.get(object, 'value');
    if (typeof value !== 'number') throw new Error('Expected a wind scalar');
    return [value];
  }
  if (node instanceof ConstNode || node instanceof UniformNode) {
    const value: unknown = node.value;
    if (typeof value === 'number') return [value];
    if (value instanceof THREE.Vector2 || value instanceof THREE.Vector3 || value instanceof THREE.Vector4) return value.toArray();
  }
  if (node instanceof OperatorNode) {
    const a = values(node.aNode)[0] ?? 0, b = values(node.bNode)[0] ?? 0;
    if (node.op === '+') return [a + b]; if (node.op === '-') return [a - b];
    if (node.op === '*') return [a * b]; if (node.op === '/') return [a / b];
  }
  if (node instanceof MathNode) {
    const x = values(node.aNode)[0] ?? 0;
    if (node.method === 'sin') return [Math.sin(x)]; if (node.method === 'cos') return [Math.cos(x)];
    if (node.method === 'fract') return [x - Math.floor(x)];
  }
  throw new Error('Unexpected wind expression');
}

test('graph wind samples the CPU gust front and reads the existing live clock', () => {
  const ir: GraphIr = { version: 1, kind: 'material', model: 'unlit',
    params: { point: { type: 'vec2', value: [0, 0] } }, nodes: {
      point: { op: 'param', param: 'point' }, at: { op: 'windGustAt', in: ['point'] },
      clock: { op: 'windTime' }, gust: { op: 'windGust' }, colour: { op: 'combine', in: ['at', 'clock', 'gust'] },
    }, stages: { surface: { colour: 'colour' } } };
  const compiled = compileGraph(ir), time = windUniforms.uWindTime.value, gust = windUniforms.uGust.value;
  try {
    const node: unknown = Reflect.get(compiled.material, 'colorNode');
    if (!(node instanceof Node)) throw new Error('Missing graph wind colour');
    let step = 0;
    for (const [x, z] of [[0, 0], [-31, 16], [244, -183]]) {
      if (x === undefined || z === undefined) throw new Error('Missing sample');
      windUniforms.uWindTime.value = 4 + step * 23; windUniforms.uGust.value = 0.2 + step * 0.3; step++;
      compiled.setParam('point', [x, z]);
      const actual = values(node);
      expect(actual[0]).toBeCloseTo(windGustAt(x, z), 5);
      expect(actual[1]).toBeCloseTo(windUniforms.uWindTime.value, 5);
      expect(actual[2]).toBeCloseTo(windUniforms.uGust.value, 5);
    }
    expect(validateGraph({ ...ir, nodes: { ...ir.nodes, point: { op: 'const', value: [1, 2, 3] } } }).ok).toBe(false);
    expect(validateGraph(graph({ model: 'unlit', surface: { colour: [1, 1, 1], alpha: windOp(vec2(1, 2)) } })).ok).toBe(true);
  } finally { compiled.material.dispose(); windUniforms.uWindTime.value = time; windUniforms.uGust.value = gust; }
});
