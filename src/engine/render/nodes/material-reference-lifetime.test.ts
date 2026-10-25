// @vitest-environment happy-dom
import { expect, test } from 'vitest';
import { MaterialReferenceNode, MeshStandardNodeMaterial, NodeFrame } from 'three/webgpu';
import { materialOpacity } from 'three/tsl';
import { Scope } from '../../app/scope';
import { EngineNodesHandler } from './engineNodesHandler';
import { realGc } from '@wildshard/engine/test/realGc';

function cachedOpacity(): MaterialReferenceNode {
  const get: unknown = Reflect.get(materialOpacity, 'getCache');
  if (typeof get !== 'function') throw new Error('Missing stock material cache');
  const node: unknown = Reflect.apply(get, materialOpacity, ['opacity', 'float']);
  if (!(node instanceof MaterialReferenceNode)) throw new Error('Missing cached material reference');
  return node;
}

function retiredMaterial(handler: EngineNodesHandler, node: MaterialReferenceNode): WeakRef<Scope> {
  const scope = new Scope('retired compiled material'), material = new MeshStandardNodeMaterial(), frame = new NodeFrame();
  material.name = 'under-moss'; material.onBeforeCompile = () => { if (scope.disposed) throw new Error('Retired material'); };
  scope.own(material); frame.material = material; node.updateReference(frame); node.update(frame);
  const cache: unknown = Reflect.get(handler, 'programCache'), callback: unknown = Reflect.get(handler, 'disposeListener');
  if (!(cache instanceof Map) || typeof callback !== 'function') throw new Error('Missing handler program lifetime');
  cache.set(material, new Map([[{}, { uniformsGroups: [], updateNodes: [node] }]]));
  material.addEventListener('dispose', () => { Reflect.apply(callback, material, []); });
  const ref = new WeakRef(scope); scope.dispose(); return ref;
}

test('a cached stock material reference releases the retired material Scope', async () => {
  await realGc('src/engine/render/nodes/material-reference-lifetime.test.ts', 'a cached stock material reference releases the retired material Scope', async collect => {
    const handler = new EngineNodesHandler(), node = cachedOpacity();
    await collect(retiredMaterial(handler, node));
    expect(cachedOpacity()).toBe(node);
    const current = new MeshStandardNodeMaterial(), frame = new NodeFrame();
    current.opacity = .37; frame.material = current; node.updateReference(frame); node.update(frame);
    expect(Reflect.get(node, 'reference')).toBe(current);
    expect(Reflect.get(node.node ?? {}, 'value')).toBe(.37);
    Reflect.set(node, 'reference', null); current.dispose();
  });
});

test('a cold material releases its last reference but cannot clear a newer target', () => {
  const handler = new EngineNodesHandler(), node = cachedOpacity(), frame = new NodeFrame();
  const first = new MeshStandardNodeMaterial(), current = new MeshStandardNodeMaterial();
  const callback: unknown = Reflect.get(handler, 'disposeListener');
  if (typeof callback !== 'function') throw new Error('Missing handler lifetime');
  for (const material of [first, current]) {
    Reflect.set(material, '_latestBuilder', { updateNodes: [node] });
    material.addEventListener('dispose', () => { Reflect.apply(callback, material, []); });
  }
  frame.material = first; node.updateReference(frame);
  frame.material = current; node.updateReference(frame);
  first.dispose();
  expect(Reflect.get(node, 'reference')).toBe(current);
  current.dispose();
  expect(Reflect.get(node, 'reference')).toBeNull();
});
