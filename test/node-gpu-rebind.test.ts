import { expect, test } from 'vitest';
import { BufferAttribute, BufferGeometry, DynamicDrawUsage, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, SkinnedMesh } from 'three';
import { gpuOnlyAttributes, gpuOnlyTrees } from '../src/engine/core/gpuOnly';
import { EngineNodesHandler } from '../src/engine/render/nodes/engineNodesHandler';

test('node recompiles retain uploaded-only buffers and refresh only changed bindings', async () => {
  const geometry = new BufferGeometry();
  const position = new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3);
  const sway = new Float32BufferAttribute([0, 0.5, 1], 1), added = new Float32BufferAttribute([1, 1, 1], 1);
  geometry.setAttribute('position', position); geometry.setAttribute('sway', sway);
  gpuOnlyAttributes(geometry, 'node rebind behaviour'); sway.onUploadCallback();
  const retired: boolean[] = [];
  geometry.addEventListener('dispose', () => { retired.push(geometry.getAttribute('sway') === sway); });
  const handler = new EngineNodesHandler(), update: unknown = Reflect.get(handler, 'updateGeometryAttributes');
  if (typeof update !== 'function') throw new Error('Missing node geometry binding');
  const build = (name: string, attribute: Float32BufferAttribute): void => {
    Reflect.apply(update, handler, [{ bufferAttributes: [{ name, node: { attribute } }] }, geometry]);
  };
  try {
    build('sway', sway); await Promise.resolve();
    expect(retired).toEqual([]);
    build('instancePart', added); await Promise.resolve();
    expect(retired).toEqual([false]);
    expect(geometry.getAttribute('sway')).toBe(sway);
    expect(sway.count).toBe(3); expect(sway.array.byteLength).toBe(0);
    expect(geometry.getAttribute('instancePart')).toBe(added);
    build('instancePart', added); await Promise.resolve();
    expect(retired).toHaveLength(1);
  } finally { geometry.dispose(); }
  expect(retired).toEqual([false, true]);
});

test('static tree uploads retain picking, dynamic, skin and morph readers', () => {
  const geometry = new BufferGeometry();
  const position = new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3);
  const normal = new Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0], 3);
  const dynamic = new Float32BufferAttribute([1, 2, 3], 1).setUsage(DynamicDrawUsage);
  geometry.setAttribute('position', position); geometry.setAttribute('normal', normal); geometry.setAttribute('changing', dynamic);
  geometry.setIndex([0, 1, 2]);
  const skin = geometry.clone(), morph = geometry.clone();
  morph.morphAttributes.position = [position.clone()];
  const root = new Group(), material = new MeshBasicMaterial();
  root.add(new Mesh(geometry, material), new Mesh(geometry, material), new SkinnedMesh(skin, material), new Mesh(morph, material));
  try {
    expect(gpuOnlyTrees([root, root], 'static trees')).toBe(normal.array.byteLength);
    for (const shape of [geometry, skin, morph]) for (const attribute of Object.values(shape.attributes)) { if (attribute instanceof BufferAttribute) attribute.onUploadCallback(); }
    expect(normal.array.byteLength).toBe(0); expect(normal.count).toBe(3);
    expect(position.array.byteLength).toBe(36); expect(geometry.index?.array.byteLength).toBe(6);
    expect(dynamic.array.byteLength).toBe(12);
    expect(skin.getAttribute('normal').array.byteLength).toBe(36);
    expect(morph.getAttribute('normal').array.byteLength).toBe(36);
    expect(geometry.boundingBox).not.toBeNull(); expect(geometry.boundingSphere).not.toBeNull();
  } finally { geometry.dispose(); skin.dispose(); morph.dispose(); material.dispose(); }
});
