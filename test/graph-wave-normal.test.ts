import { expect, test } from 'vitest';
import * as THREE from 'three';
import { ConstNode, ConvertNode, JoinNode, MathNode, OperatorNode, ReferenceNode, SplitNode, UniformNode, VarNode } from 'three/webgpu';
import { vec2 } from 'three/tsl';
import { compileGraph } from '../src/engine/render/graph/compile';
import { waveDisplace } from '../src/engine/world/waves';
import { graph, gerstnerNormal } from '../src/sdk/materials';
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
    if (typeof object !== 'object' || object === null) throw new Error('Missing wave uniform owner');
    const value: unknown = Reflect.get(object, 'value');
    if (typeof value !== 'number') throw new Error('Expected a wave scalar');
    return [value];
  }
  if (node instanceof ConstNode || node instanceof UniformNode) {
    const value: unknown = node.value;
    if (typeof value === 'number') return [value];
    if (value instanceof THREE.Vector2 || value instanceof THREE.Vector3 || value instanceof THREE.Vector4) return value.toArray();
  }
  if (node instanceof OperatorNode) {
    const a = values(node.aNode), b = values(node.bNode);
    return Array.from({ length: Math.max(a.length, b.length) }, (_, i) => {
      const x = a[i % a.length] ?? 0, y = b[i % b.length] ?? 0;
      if (node.op === '+') return x + y; if (node.op === '-') return x - y;
      if (node.op === '*') return x * y; if (node.op === '/') return x / y;
      throw new Error('Unexpected wave operator');
    });
  }
  if (node instanceof MathNode) {
    const a = values(node.aNode), x = a[0] ?? 0;
    if (node.method === 'normalize') { const length = Math.hypot(...a); return a.map(v => v / length); }
    if (node.method === 'cross') {
      const b = values(node.bNode);
      return [(a[1] ?? 0) * (b[2] ?? 0) - (a[2] ?? 0) * (b[1] ?? 0),
        (a[2] ?? 0) * (b[0] ?? 0) - (a[0] ?? 0) * (b[2] ?? 0),
        (a[0] ?? 0) * (b[1] ?? 0) - (a[1] ?? 0) * (b[0] ?? 0)];
    }
    if (node.method === 'sin') return [Math.sin(x)]; if (node.method === 'cos') return [Math.cos(x)];
    if (node.method === 'fract') return [x - Math.floor(x)];
  }
  throw new Error('Unexpected wave expression');
}

test('the analytic graph normal follows the shared CPU wave surface at rest points', () => {
  const ir: GraphIr = { version: 1, kind: 'material', model: 'unlit',
    params: { at: { type: 'vec2', value: [0, 0] }, clock: { type: 'float', value: 0 }, damp: { type: 'float', value: 1 } },
    nodes: { at: { op: 'param', param: 'at' }, clock: { op: 'param', param: 'clock' }, damp: { op: 'param', param: 'damp' }, normal: { op: 'gerstnerNormal', in: ['at', 'clock', 'damp'] } },
    stages: { surface: { colour: 'normal' } } };
  const compiled = compileGraph(ir);
  try {
    for (const [x, z, t, damp] of [[0, 0, 0, 0], [-13, 27, 9, 0.4], [144, -38, 57, 1]]) {
      if (x === undefined || z === undefined || t === undefined || damp === undefined) throw new Error('Missing wave sample');
      compiled.setParam('at', [x, z]); compiled.setParam('clock', t); compiled.setParam('damp', damp);
      const surface = (px: number, pz: number): THREE.Vector3 => {
        const d = waveDisplace(px, pz, t, damp, { x: 0, y: 0, z: 0 }); return new THREE.Vector3(px + d.x, d.y, pz + d.z);
      };
      const h = 0.001, tx = surface(x + h, z).sub(surface(x - h, z)), tz = surface(x, z + h).sub(surface(x, z - h));
      const expected = tz.cross(tx).normalize().toArray(), actual = values(Reflect.get(compiled.material, 'colorNode'));
      for (const [i, v] of expected.entries()) expect(actual[i]).toBeCloseTo(v, 5);
    }
    expect(validateGraph(graph({ model: 'unlit', surface: { colour: gerstnerNormal(vec2(0), 1, 1) } })).ok).toBe(true);
    expect(validateGraph({ ...ir, nodes: { ...ir.nodes, at: { op: 'const', value: [1, 2, 3] } } }).ok).toBe(false);
  } finally { compiled.material.dispose(); }
});
