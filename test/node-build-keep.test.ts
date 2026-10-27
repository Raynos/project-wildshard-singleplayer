import { expect, test } from 'vitest';
import * as THREE from 'three';
import { NodeUniform, UniformNode } from 'three/webgpu';
import { keepBuild, restoreBuild, type BuildOutput, type GraphShape } from '../src/engine/render/nodes/nodeBuildReuse';

const uniform = (value: number): UniformNode<unknown, unknown> => new UniformNode(value);
const shape = (nodes: UniformNode<unknown, unknown>[]): GraphShape => ({ nodes, signature: 'same' });

test('a kept build holds positions, not the first compile\'s nodes, and binds the second compile on restore', () => {
  const first = [uniform(1), uniform(2)], scene = uniform(9);
  const shared = new NodeUniform('camera', 'float', scene), own = new NodeUniform('tint', 'float', first[1] ?? scene);
  const output: BuildOutput = { vertexShader: 'v', fragmentShader: 'f', uniforms: { vertex: [shared], fragment: [own, shared] },
    uniformGroups: { group: { uniforms: [{ nodeUniform: own }] } }, updateNodes: [first[0] ?? scene] };
  const kept = keepBuild(output, shape(first), []);
  if (kept === null) throw new Error('Missing kept build');
  // nothing of the first compile survives in the kept build: its compile nodes are indices
  expect(JSON.stringify(kept.uniforms.map(row => row.ref))).toBe(JSON.stringify([{ compile: 1 }, { shared: {}, kind: 'UniformNode<number>' }])); // the group's uniform first, then the camera
  expect(kept.updateNodes).toEqual([{ compile: 0 }]);
  const second = [uniform(3), uniform(4)];
  const restored = restoreBuild(kept, shape(second), new THREE.Mesh(), new THREE.MeshBasicMaterial());
  if (typeof restored === 'string') throw new Error(restored);
  expect(restored.uniforms.fragment[0]?.node).toBe(second[1]);
  expect(restored.uniforms.vertex[0]?.node).toBe(scene); // a scene node is shared, held weakly while it lives
  expect(restored.uniforms.fragment[1]).toBe(restored.uniforms.vertex[0]); // one uniform, one object, as in the build
  expect(restored.uniformGroups['group']?.uniforms[0]?.nodeUniform).toBe(restored.uniforms.fragment[0]);
  expect(restored.updateNodes).toEqual([second[0]]);
  expect([restored.vertexShader, restored.fragmentShader]).toEqual(['v', 'f']);
});

test('a kept build reads a scene input by role: a restore binds the current one, and another node holding it fixes it', () => {
  const first = [uniform(1)], width = uniform(512), texture = new THREE.Texture();
  const sized = new NodeUniform('envWidth', 'float', width), own = new NodeUniform('tint', 'float', first[0] ?? width);
  const output: BuildOutput = { vertexShader: 'v', fragmentShader: 'f', uniforms: { vertex: [], fragment: [own, sized] }, uniformGroups: {}, updateNodes: [] };
  const roles = { role: (node: unknown): string | null => node === width ? 'environment:_width' : null, inputs: [texture] };
  const kept = keepBuild(output, shape(first), [], roles);
  if (kept === null) throw new Error('Missing kept build');
  expect(kept.roles).toBe('rebindable');
  expect(kept.uniforms.map(row => row.ref)).toEqual([{ compile: 0 }, { role: 'environment:_width' }]);
  const next = uniform(1024), second = [uniform(2)];
  const restored = restoreBuild(kept, shape(second), new THREE.Mesh(), new THREE.MeshBasicMaterial(), role => role === 'environment:_width' ? next : null);
  if (typeof restored === 'string') throw new Error(restored);
  expect(restored.uniforms.fragment.map(entry => entry.node)).toEqual([second[0], next]);
  expect(restoreBuild(kept, shape(second), new THREE.Mesh(), new THREE.MeshBasicMaterial())).toBe('unbound:environment:_width');
  // a shared node that holds the input itself (not by role) keeps the build to that input
  const holder = new UniformNode<unknown, unknown>(texture), sampled = new NodeUniform('envMap', 'texture', holder);
  const fixed = keepBuild({ ...output, uniforms: { vertex: [], fragment: [own, sized, sampled] } }, shape(first), [], roles);
  expect(fixed?.roles).toBe('fixed');
  expect(keepBuild(output, shape(first), [])?.roles).toBe('none');
});
