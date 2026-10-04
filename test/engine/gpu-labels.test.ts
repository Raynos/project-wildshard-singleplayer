import { BufferAttribute, BufferGeometry, DataTexture, Group, InstancedMesh, MeshBasicMaterial } from 'three';
import { afterEach, expect, it } from 'vitest';
import { labelAsset, labelledCreation, labelObjectTree } from '../../src/engine/render/gpuLabels';

const originalWindow: unknown = Reflect.get(globalThis, 'window');
afterEach(() => { Reflect.set(globalThis, 'window', originalWindow); });
it('labels actual geometry, instance and texture upload sources with their file or registered piece identity', () => {
  const sources = new Map<object, { owner: string; asset: string }>();
  Reflect.set(globalThis, 'window', {
    __sc_label_gl: () => undefined,
    __sc_label_source: (source: object, owner: string, asset: string) => { sources.set(source, { owner, asset }); },
  });
  const positions = new Float32Array(9), pixels = new Uint8Array(16);
  const geometry = labelAsset(new BufferGeometry().setAttribute('position', new BufferAttribute(positions, 3)), 'file-loader', '/assets/tree.glb#trunk');
  const texture = labelAsset(new DataTexture(pixels, 2, 2), 'texture-loader', '/assets/bark.ktx2');
  const mesh = new InstancedMesh(geometry, new MeshBasicMaterial({ map: texture }), 2);
  mesh.name = 'trees';
  const root = new Group(); root.add(mesh);
  labelObjectTree(root, 'pine/tree-stand', 'forest.ts#Tree stand');
  expect(sources.get(positions)).toEqual({ owner: 'file-loader', asset: '/assets/tree.glb#trunk/position' });
  expect(sources.get(pixels)).toEqual({ owner: 'texture-loader', asset: '/assets/bark.ktx2' });
  expect(sources.get(mesh.instanceMatrix.array)).toEqual({ owner: 'pine/tree-stand', asset: 'forest.ts#Tree stand/trees/instanceMatrix' });
});
it('normal gameplay does not inspect a registered tree or wrap its creation', () => {
  Reflect.set(globalThis, 'window', {});
  const root = new Group();
  Object.defineProperty(root, 'children', { get: () => { throw new Error('Unexpected census walk'); } });
  labelObjectTree(root, 'piece', 'world.ts');
  const object = {};
  expect(labelAsset(object, 'piece', 'world.ts')).toBe(object);
  expect(labelledCreation('piece', 'world.ts', () => object)).toBe(object);
});
