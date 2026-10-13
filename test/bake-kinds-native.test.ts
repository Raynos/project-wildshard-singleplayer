import { BufferAttribute, BufferGeometry, Float16BufferAttribute, Float32BufferAttribute, InstancedMesh, Mesh, MeshStandardMaterial, type Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { expect, it } from 'vitest';
import { bakeKinds } from '../src/sdk/bake/kinds';
import { nativeWholeGeometry } from '../src/game/plugin/geometry';

function isMesh(node: Object3D): node is Mesh { return node instanceof Mesh; }
it('keeps every native kind channel, with explicit semantics taking precedence', async () => {
  const geometry = new BufferGeometry().setAttribute('position', new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 0, 1], 3))
    .setAttribute('normal', new Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0], 3))
    .setAttribute('uv', new Float16BufferAttribute(new Uint16Array([0, 0x3c00, 0x3c00, 0, 0, 0]), 2))
    .setAttribute('moss', new BufferAttribute(new Uint8Array([0, 128, 255]), 1, true))
    .setAttribute('wind', new BufferAttribute(new Int8Array([-128, 1, 127]), 1, true));
  const mesh = new InstancedMesh(geometry, new MeshStandardMaterial(), 1);
  const prior = bakeKinds('pool', [['pool', mesh]], []);
  expect(bakeKinds('pool', [['pool', mesh]], [], { attributes: {} }).glb).toEqual(prior.glb);
  for (const attributes of [undefined, { _MOSS: 'moss' }]) {
    const result = bakeKinds('pool', [['pool', mesh]], [], { nativeAttributes: true, ...(attributes === undefined ? {} : { attributes }) });
    const parsed = await new GLTFLoader().parseAsync(Uint8Array.from(result.glb).buffer, ''), nodes: Mesh[] = [];
    parsed.scene.traverse(node => { if (isMesh(node)) nodes.push(node); });
    const node = nodes[0]; if (node === undefined) throw new Error('Missing native kind');
    const restored = nativeWholeGeometry(node);
    expect(Object.keys(restored.attributes).sort()).toEqual(Object.keys(geometry.attributes).sort());
    for (const [name, channel] of Object.entries(geometry.attributes)) {
      const actual = restored.getAttribute(name);
      expect(actual.array).toEqual(channel.array);
      expect(actual.array.constructor).toBe(channel.array.constructor);
      expect(actual.normalized).toBe(channel.normalized);
      expect(actual.itemSize).toBe(channel.itemSize);
    }
  }
});
