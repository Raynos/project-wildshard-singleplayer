// SF69: outside the census harness (Developer on), the per-render scene walk and the per-draw marking are amortized:
// an unchanged node is not re-walked on every render, a changed one is relabelled at once, and every node is still
// revisited within the refresh window.
import { BufferAttribute, BufferGeometry, Group, Mesh, MeshBasicMaterial, PerspectiveCamera, Scene } from 'three';
import { afterEach, expect, it } from 'vitest';
import type { Renderer } from '../../src/engine/render/renderer';
import { installGpuLabels } from '../../src/engine/render/gpuLabels';

const originalWindow: unknown = Reflect.get(globalThis, 'window');
afterEach(() => { Reflect.set(globalThis, 'window', originalWindow); });

/** a geometry that counts how often its attributes are read (the walk's markGeometry reads them once per visit) */
function countedGeometry(): { geometry: BufferGeometry; reads: () => number } {
  const geometry = new BufferGeometry().setAttribute('position', new BufferAttribute(new Float32Array(9), 3));
  const attributes = geometry.attributes;
  let reads = 0;
  Object.defineProperty(geometry, 'attributes', { get: () => { reads++; return attributes; }, configurable: true });
  return { geometry, reads: () => reads };
}

function fakeRenderer(): Renderer {
  const renderer = {} as Renderer; // a stand-in with only the members installGpuLabels wraps
  Object.assign(renderer, { properties: { get: () => ({}) }, render: () => undefined, compile: () => undefined, compileAsync: () => Promise.resolve(), renderBufferDirect: () => undefined });
  return renderer;
}

it('walks a Developer scene once, then only what changed or fell due, and marks a repeated draw once', () => {
  Reflect.set(globalThis, 'window', {});
  const renderer = fakeRenderer();
  installGpuLabels(renderer, () => true); // Developer on
  const { geometry, reads } = countedGeometry();
  const mesh = new Mesh(geometry, new MeshBasicMaterial());
  const scene = new Scene(); const group = new Group(); group.add(mesh); scene.add(group);
  const camera = new PerspectiveCamera();
  renderer.render(scene, camera);
  const first = reads();
  expect(first).toBeGreaterThan(0);
  for (let i = 0; i < 10; i++) renderer.render(scene, camera);
  expect(reads()).toBe(first); // unchanged: not re-walked every render
  const next = countedGeometry();
  mesh.geometry = next.geometry;
  renderer.render(scene, camera);
  expect(next.reads()).toBeGreaterThan(0); // re-dressed: relabelled at once
  const settled = next.reads();
  for (let i = 0; i < 480; i++) renderer.render(scene, camera);
  expect(next.reads() - settled).toBeGreaterThanOrEqual(1); // still revisited within the refresh window
  expect(next.reads() - settled).toBeLessThanOrEqual(6);
  const drawn = next.reads();
  for (let i = 0; i < 5; i++) renderer.renderBufferDirect(camera, scene, mesh.geometry, mesh.material, mesh, { start: 0, count: 3, materialIndex: 0 });
  expect(next.reads() - drawn).toBeLessThanOrEqual(1); // a repeated draw of the same object is marked once
});

it('keeps the full walk on every render under the census harness', () => {
  Reflect.set(globalThis, 'window', { __sc_label_gl: () => undefined, __sc_label_source: () => undefined });
  const renderer = fakeRenderer();
  installGpuLabels(renderer);
  const { geometry, reads } = countedGeometry();
  const scene = new Scene(); scene.add(new Mesh(geometry, new MeshBasicMaterial()));
  const camera = new PerspectiveCamera();
  renderer.render(scene, camera);
  const first = reads();
  renderer.render(scene, camera);
  expect(reads()).toBe(first * 2);
});
