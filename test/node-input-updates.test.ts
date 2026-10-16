import { expect, test } from 'vitest';
import { MeshBasicMaterial, PerspectiveCamera } from 'three';
import { NodeFrame, ReferenceNode, MaterialReferenceNode } from 'three/webgpu';
import { uniform } from 'three/tsl';
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

test('inline graph reads keep same-pass edits, custom readers and object-relative holders live', () => {
  const frame = new NodeFrame(), updates = new TextureUpdates(frame), material = new MeshBasicMaterial(); frame.material = material;
  updates.inlineReads = true;
  const owner = { value: 2 }, reference = new ReferenceNode('value', 'float', owner), materialRead = new MaterialReferenceNode('opacity', 'float');
  const objectRead = new ReferenceNode('weight', 'float'), first = { weight: 1 }, second = { weight: 5 };
  const initialize = (node: object, target: object): void => {
    Reflect.set(node, 'reference', target); const update: unknown = Reflect.get(node, 'updateValue');
    if (typeof update !== 'function') throw new Error('Missing stock reference updater'); Reflect.apply(update, node, []);
  };
  initialize(reference, owner); initialize(materialRead, material); initialize(objectRead, first);
  const value = (node: object): unknown => {
    const inner: unknown = Reflect.get(node, 'node');
    return typeof inner === 'object' && inner !== null ? Reflect.get(inner, 'value') : undefined;
  };
  const custom = uniform(0).onObjectUpdate(() => { owner.value++; return owner.value; });
  updates.beginRender(); const nodes = [reference, materialRead, objectRead];
  Reflect.set(frame, 'object', first); updates.update(nodes);
  expect([value(reference), value(materialRead), value(objectRead)]).toEqual([2, 1, 1]);
  expect(updates.inlinedReads).toBe(3);
  owner.value = 7; material.opacity = 0.3; Reflect.set(frame, 'object', second); updates.update(nodes);
  expect([value(reference), value(materialRead), value(objectRead)]).toEqual([7, 0.3, 5]); expect(objectRead.reference).toBe(second);
  // a custom object callback earlier in the same list writes the holder the reference then reads
  updates.update([custom, reference]); expect(value(reference)).toBe(8);
  // a reader replaced after its plan was made goes back to the stock dispatch
  let callbacks = 0; reference.update = () => { callbacks++; };
  updates.update(nodes); expect(callbacks).toBe(1);
  // the row off remakes the plan: every read dispatches through NodeFrame again
  const before = updates.inlinedReads; updates.inlineReads = false; owner.value = 9; Reflect.deleteProperty(reference, 'update');
  updates.update(nodes); expect(updates.inlinedReads).toBe(before); expect(value(reference)).toBe(9);
  updates.endRender(); material.dispose();
});
