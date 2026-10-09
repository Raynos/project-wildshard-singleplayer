// SF69: outside the census harness (Developer on), the per-render scene walk and the per-draw marking are amortized:
// an unchanged node is not re-walked on every render, a changed one is relabelled at once, and every node is still
// revisited within the refresh window.
import { BufferAttribute, BufferGeometry, DataTexture, Group, Mesh, MeshBasicMaterial, PerspectiveCamera, Scene, ShaderMaterial } from 'three';
import { afterEach, expect, it } from 'vitest';
import type { Renderer } from '../../src/engine/render/renderer';
import { installGpuLabels, labelAsset } from '../../src/engine/render/gpuLabels';

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
  Object.assign(renderer, { properties: { has: () => true, get: () => ({}) }, render: () => undefined, compile: () => undefined, compileAsync: () => Promise.resolve(), renderBufferDirect: () => undefined });
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

it('marks a multi-material mesh once across its groups, every material included', () => {
  Reflect.set(globalThis, 'window', {});
  const renderer = fakeRenderer();
  installGpuLabels(renderer, () => true); // Developer on
  const { geometry, reads } = countedGeometry();
  const a = new MeshBasicMaterial(), b = new MeshBasicMaterial();
  const mesh = new Mesh(geometry, [a, b]);
  const scene = new Scene(); scene.add(mesh);
  const camera = new PerspectiveCamera();
  const before = reads();
  for (let i = 0; i < 5; i++) {
    renderer.renderBufferDirect(camera, scene, geometry, a, mesh, { start: 0, count: 3, materialIndex: 0 });
    renderer.renderBufferDirect(camera, scene, geometry, b, mesh, { start: 3, count: 3, materialIndex: 1 });
  }
  expect(reads() - before).toBeLessThanOrEqual(1); // the group's material no longer flips the cache on every draw
});

it('amortizes sampled census draws but flushes late attributes and shader uniforms synchronously on read', () => {
  let flush: (() => void) | undefined;
  const sources = new Map<object, string>();
  Reflect.set(globalThis, 'window', { __sc_gl_sample_labels: true,
    __sc_gl_register_labels: (read: () => void) => { flush = read; },
    __sc_label_gl: () => undefined,
    __sc_label_source: (source: object, _owner: string, asset: string) => { sources.set(source, asset); },
  });
  const renderer = fakeRenderer(); installGpuLabels(renderer, () => false);
  const { geometry, reads } = countedGeometry();
  const scene = new Scene(), material = new ShaderMaterial({ uniforms: { late: { value: null } } }), mesh = new Mesh(geometry, material);
  scene.add(mesh); const camera = new PerspectiveCamera();
  renderer.render(scene, camera);
  renderer.renderBufferDirect(camera, scene, geometry, material, mesh, { start: 0, count: 3, materialIndex: 0 });
  const settled = reads();
  for (let index = 0; index < 20; index++) {
    renderer.render(scene, camera);
    renderer.renderBufferDirect(camera, scene, geometry, material, mesh, { start: 0, count: 3, materialIndex: 0 });
  }
  expect(reads()).toBe(settled);
  const normals = new Float32Array(9);
  geometry.setAttribute('normal', new BufferAttribute(normals, 3));
  expect(sources.has(normals)).toBe(false);
  const pixels = new Uint8Array(16);
  const uniform = material.uniforms['late'];
  if (uniform === undefined) throw new Error('Missing fixture uniform');
  uniform.value = new DataTexture(pixels, 2, 2);
  expect(sources.has(pixels)).toBe(false);
  flush?.();
  expect(sources.get(pixels)).toContain('/uniform/late');
  expect(sources.get(normals)).toContain('/normal');
  expect(reads()).toBeGreaterThan(settled);
});

it('flushes improved native labels without recreating retired renderer properties', () => {
  let flush: (() => void) | undefined;
  const labels = new Map<object, string>(), properties = new WeakMap<object, object>();
  let gets = 0;
  Reflect.set(globalThis, 'window', { __sc_gl_sample_labels: true,
    __sc_gl_register_labels: (read: () => void) => { flush = read; },
    __sc_label_gl: (resource: object, _owner: string, asset: string) => { labels.set(resource, asset); },
  });
  const renderer = fakeRenderer();
  Object.assign(renderer.properties, { has: (resource: object) => properties.has(resource), get: (resource: object) => {
    gets++; const existing = properties.get(resource) ?? {}; properties.set(resource, existing); return existing;
  } });
  installGpuLabels(renderer, () => false);
  const texture = new DataTexture(new Uint8Array(16), 2, 2), handle = {};
  properties.set(texture, { __webglTexture: handle });
  renderer.properties.get(texture);
  labelAsset(texture, 'engine/test', '/fixture/exact-texture');
  flush?.();
  expect(labels.get(handle)).toBe('/fixture/exact-texture/Texture');
  properties.delete(texture);
  const before = gets;
  flush?.();
  expect(gets).toBe(before);
  expect(properties.has(texture)).toBe(false);
});
