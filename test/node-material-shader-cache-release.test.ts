// @vitest-environment happy-dom
import { expect, test } from 'vitest';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { EngineNodesHandler } from '../src/engine/render/nodes/engineNodesHandler';

// O18: three's renderer releases a material's custom shader cache entry on dispose only for a ShaderMaterial, and its own
// dispose listener is filed before the node handler's. The handler's callback goes first and marks a node material a
// shader material for that one dispatch, so three's listener (filed earlier) releases it; the mark is gone right after.
test('a disposed node material reads as a shader material to the renderer\'s own dispose listener, for that dispatch only', async () => {
  const handler = new EngineNodesHandler(), material = new MeshStandardNodeMaterial(), seen: unknown[] = [];
  material.addEventListener('dispose', () => { seen.push(Reflect.get(material, 'isShaderMaterial')); }); // three's, filed first
  const callback: unknown = Reflect.get(handler, 'disposeListener');
  if (typeof callback !== 'function') throw new Error('Missing handler dispose callback');
  material.addEventListener('dispose', callback as (this: unknown) => void); // the build's
  const disposeFirst: unknown = Reflect.get(handler, 'disposeFirst');
  if (typeof disposeFirst !== 'function') throw new Error('Missing handler listener order');
  Reflect.apply(disposeFirst, handler, [material]);
  material.dispose();
  expect(seen).toEqual([true]);
  await Promise.resolve();
  expect(Reflect.get(material, 'isShaderMaterial')).toBeUndefined();
});
