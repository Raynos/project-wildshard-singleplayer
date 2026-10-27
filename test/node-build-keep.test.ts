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
  expect(JSON.stringify(kept.uniforms.map(row => row.ref))).toBe(JSON.stringify([{ compile: 1 }, { shared: {} }])); // the group's uniform first, then the camera
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
