import { expect, test } from 'vitest';
import * as THREE from 'three';
import { CSM } from 'three/examples/jsm/csm/CSM.js';
import { ConditionalNode, ConstNode, ConvertNode, MathNode, JoinNode, MeshStandardNodeMaterial, Node, NodeBuilder, NodeFrame, OperatorNode, SplitNode, UniformNode, VarNode } from 'three/webgpu';
import { positionView, vec3 } from 'three/tsl';
import { compileGraph } from '../src/engine/render/graph/compile';
import { EngineDirectionalLightNode } from '../src/engine/render/nodes/cascadeLightNode';
import { registerCascades } from '../src/engine/world/cascadeLights';

/** Evaluate the actual light result's small arithmetic tree at a view depth. */
function values(node: unknown, depth: number): number[] {
  if (node === positionView) return [0, 0, -depth];
  if (node instanceof JoinNode) return node.nodes.flatMap(n => values(n, depth));
  if (node instanceof ConvertNode || node instanceof VarNode) return values(node.node, depth);
  if (node instanceof SplitNode) { const a = values(node.node, depth); return node.components.split('').map(c => a['xyzw'.indexOf(c)] ?? 0); }
  if (node instanceof ConditionalNode) return values((values(node.condNode, depth)[0] ?? 0) !== 0 ? node.ifNode : node.elseNode, depth);
  if (node instanceof ConstNode || node instanceof UniformNode) {
    if (node instanceof UniformNode) node.update(new NodeFrame());
    const v: unknown = node.value;
    if (typeof v === 'number' || typeof v === 'boolean') return [Number(v)];
    if (v instanceof THREE.Vector2 || v instanceof THREE.Vector3) return v.toArray();
  }
  if (node instanceof OperatorNode) {
    const a = values(node.aNode, depth), b = values(node.bNode, depth);
    return Array.from({ length: Math.max(a.length, b.length) }, (_, i) => {
      const x = a[i % a.length] ?? 0, y = b[i % b.length] ?? 0;
      if (node.op === '+') return x + y; if (node.op === '-') return x - y;
      if (node.op === '*') return x * y; if (node.op === '/') return x / y;
      if (node.op === '<') return Number(x < y); if (node.op === '>=') return Number(x >= y);
      if (node.op === '&&') return Number(x !== 0 && y !== 0);
      throw new Error('Unexpected cascade operator');
    });
  }
  if (node instanceof MathNode) {
    const a = values(node.aNode, depth), x = a[0] ?? 0;
    if (node.method === 'negate') return a.map(n => -n);
    if (node.method === 'min') return [Math.min(x, values(node.bNode, depth)[0] ?? 0)];
    if (node.method === 'clamp') return [THREE.MathUtils.clamp(x, values(node.bNode, depth)[0] ?? 0, values(node.cNode, depth)[0] ?? 0)];
  }
  throw new Error('Unexpected cascade node');
}

test('a nonlinear graph sun contributes nothing outside its cascade slice', () => {
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(60, 1, 1, 101);
  const csm = new CSM({ parent: scene, camera, cascades: 2, maxFar: 101 });
  csm.breaks.splice(0, csm.breaks.length, 0.4, 1);
  registerCascades({ csm, ghosts: [], fade: { value: 1 } });
  const light = csm.lights[0]; if (light === undefined) throw new Error('Missing cascade');
  const node = new EngineDirectionalLightNode(light);
  Reflect.set(node, 'baseColorNode', vec3(1)); Reflect.set(node, 'colorNode', vec3(0)); // Fully shadowed: the hook may still retain a lit floor.
  const builder: unknown = Object.create(NodeBuilder.prototype);
  if (!(builder instanceof NodeBuilder)) throw new Error('Missing builder');
  const direct = node.setupDirect(builder); if (direct === undefined) throw new Error('Missing light');
  const compiled = compileGraph({ version: 1, kind: 'material', model: 'standard', nodes: {},
    stages: { surface: { colour: [1, 1, 1] }, lighting: { sun: [1, 0, 0] } } });
  try {
    const material = compiled.material; if (!(material instanceof MeshStandardNodeMaterial)) throw new Error('Missing lit material');
    let contribution: unknown;
    const diffuse = new Node<'vec3'>('vec3'); Reflect.set(diffuse, 'addAssign', (value: unknown) => { contribution = value; return diffuse; });
    material.setupLightingModel().direct({ ...direct, lightNode: node,
      reflectedLight: { directDiffuse: diffuse, directSpecular: vec3(0), indirectDiffuse: vec3(0), indirectSpecular: vec3(0) } }, builder);
    expect(values(contribution, 10)[0]).toBeGreaterThan(0);
    expect(values(contribution, 80).every(n => Math.abs(n) < 1e-6)).toBe(true);
  } finally { compiled.material.dispose(); csm.dispose(); csm.remove(); }
});
