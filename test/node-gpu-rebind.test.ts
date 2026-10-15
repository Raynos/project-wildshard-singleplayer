import { expect, test } from 'vitest';
import { BufferGeometry, Float32BufferAttribute } from 'three';
import { gpuOnlyAttributes } from '../src/engine/core/gpuOnly';
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
