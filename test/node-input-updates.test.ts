import { expect, test } from 'vitest';
import { Mesh, MeshBasicMaterial, PerspectiveCamera } from 'three';
import { NodeFrame, ReferenceNode, MaterialReferenceNode } from 'three/webgpu';
import { modelWorldMatrix, objectGroup, uniform } from 'three/tsl';
import { TextureUpdates } from '../src/engine/render/nodes/textureUpdates';

test('render nodes run once per pass while custom object callbacks, shadow cameras and nested renders stay live', () => {
  const frame = new NodeFrame(), updates = new TextureUpdates(frame), camera = new PerspectiveCamera(), shadow = new PerspectiveCamera();
  const seen: string[] = [], objects: number[] = [];
  frame.camera = camera;
  const rendered = uniform(0).onRenderUpdate(() => { seen.push(frame.camera === camera ? 'main' : 'shadow'); return seen.length; });
  const custom = uniform(0).onObjectUpdate(() => { objects.push(objects.length); return objects.length; });
  const nodes = [rendered, custom];
  updates.beginRender(); updates.update(nodes); updates.update(nodes);
  frame.camera = shadow; updates.update(nodes); updates.update(nodes);
  frame.camera = camera; updates.update(nodes);
  updates.beginRender(); updates.update(nodes); updates.endRender(); updates.update(nodes); updates.endRender();
  expect(seen).toEqual(['main', 'shadow', 'main', 'main', 'main']); expect(objects).toHaveLength(7);
});

test('stock reference sources and live same-frame material edits remain current; custom readers still dispatch', () => {
  const frame = new NodeFrame(), updates = new TextureUpdates(frame), material = new MeshBasicMaterial(); frame.material = material;
  const owner = { value: 2 }, reference = new ReferenceNode('value', 'float', owner), materialRead = new MaterialReferenceNode('opacity', 'float');
  // Populate their actual stock uniforms without a builder.
  const initialize = (node: object, target: object): void => {
    Reflect.set(node, 'reference', target); const update: unknown = Reflect.get(node, 'updateValue');
    if (typeof update !== 'function') throw new Error('Missing stock reference updater'); Reflect.apply(update, node, []);
  };
  initialize(reference, owner);
  initialize(materialRead, material);
  const custom = uniform(0).onObjectUpdate(() => { owner.value++; return owner.value; });
  updates.beginRender(); const nodes = [reference, materialRead]; updates.update(nodes); updates.update(nodes);
  expect(Reflect.get(reference.node ?? {}, 'value')).toBe(2);
  owner.value = 7; material.opacity = 0.3; updates.update(nodes);
  expect(Reflect.get(reference.node ?? {}, 'value')).toBe(7); expect(Reflect.get(materialRead.node ?? {}, 'value')).toBe(0.3);
  updates.update([custom, reference]); expect(Reflect.get(reference.node ?? {}, 'value')).toBe(8);
  let callbacks = 0; reference.update = () => { callbacks++; };
  updates.update(nodes); updates.update(nodes); expect(callbacks).toBe(2); updates.endRender(); material.dispose();
});

test('the model world matrix follows each drawn object and the object group is marked on every draw', () => {
  const frame = new NodeFrame(), updates = new TextureUpdates(frame), a = new Mesh(), b = new Mesh();
  const matrix: unknown = Reflect.get(modelWorldMatrix, 'uniformNode');
  if (typeof matrix !== 'object' || matrix === null) throw new Error('Missing stock model matrix uniform');
  const nodes = [modelWorldMatrix, objectGroup], version = objectGroup.version;
  updates.beginRender();
  frame.object = a; updates.update(nodes);
  expect(Reflect.get(matrix, 'value')).toBe(a.matrixWorld); expect(Reflect.get(modelWorldMatrix, 'object3d')).toBe(a);
  frame.object = b; updates.update(nodes);
  expect(Reflect.get(matrix, 'value')).toBe(b.matrixWorld);
  expect(objectGroup.version).toBe(version + 2);
  updates.endRender();
});
