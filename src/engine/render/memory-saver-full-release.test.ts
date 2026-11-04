import { textureUploadRenderer as uploadRenderer } from '../test/textureUploadRenderer';
import { afterEach, expect, test, vi } from 'vitest';
import { BufferAttribute, BufferGeometry, Mesh, MeshBasicMaterial, PerspectiveCamera, Scene, SkinnedMesh } from 'three';
import { installMemorySaver } from './memorySaver';
import { installFrameCounter } from './frameCounter';
import { arrayReleased } from './releasedArrays';

// D227(b): Debug ▸ Release positions and index. With it on, the Memory saver also gives up a static geometry's position
// (only once its bounds are set) and its index after upload; a reader gets the GPU's bytes back. Off, both stay.
class FakeBuffer { readonly id = Symbol('buffer'); }
class FakeGl {
  readonly ARRAY_BUFFER = 1; readonly ELEMENT_ARRAY_BUFFER = 2; readonly ARRAY_BUFFER_BINDING = 3; readonly ELEMENT_ARRAY_BUFFER_BINDING = 4; readonly COPY_READ_BUFFER = 5;
  readonly bound = new Map<number, FakeBuffer | null>();
  readonly store = new Map<FakeBuffer, Uint8Array>();
  readonly queried: number[] = [];
  bindBuffer(target: number, buffer: FakeBuffer | null): void { this.bound.set(target, buffer); }
  bufferData(target: number, data: ArrayBufferView): void {
    const buffer = this.bound.get(target); if (buffer) this.store.set(buffer, new Uint8Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)));
  }
  getParameter(name: number): FakeBuffer | null { this.queried.push(name); return this.bound.get(name === this.ARRAY_BUFFER_BINDING ? this.ARRAY_BUFFER : this.ELEMENT_ARRAY_BUFFER) ?? null; }
  isBuffer(buffer: FakeBuffer): boolean { return this.store.has(buffer); }
  getBufferSubData(target: number, _offset: number, into: ArrayBufferView): void {
    const buffer = this.bound.get(target), bytes = buffer ? this.store.get(buffer) : undefined;
    if (bytes !== undefined) new Uint8Array(into.buffer, into.byteOffset, into.byteLength).set(bytes);
  }
}

const globals = ['WebGL2RenderingContext', 'WebGLBuffer'].map(key => ({ key, descriptor: Object.getOwnPropertyDescriptor(globalThis, key) }));
afterEach(() => {
  for (const { key, descriptor } of globals) {
    if (descriptor === undefined) Reflect.deleteProperty(globalThis, key);
    else Object.defineProperty(globalThis, key, descriptor);
  }
});

function scene(fullRelease: boolean, bounded: boolean) {
  vi.stubGlobal('WebGL2RenderingContext', FakeGl); vi.stubGlobal('WebGLBuffer', FakeBuffer);
  const gl = new FakeGl(), renderer = uploadRenderer();
  Object.defineProperty(renderer, 'getContext', { value: () => gl });
  installFrameCounter(renderer); installMemorySaver(renderer, { fullRelease });
  const world = new Scene(), camera = new PerspectiveCamera(), material = new MeshBasicMaterial(), sentinel = new SkinnedMesh(new BufferGeometry(), material);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), 3));
  geometry.setAttribute('normal', new BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]), 3));
  geometry.setIndex(new BufferAttribute(new Uint16Array([0, 1, 2]), 1));
  if (bounded) { geometry.computeBoundingBox(); geometry.computeBoundingSphere(); }
  // three's upload of each channel (WebGLAttributes.createBuffer: bind, then bufferData)
  const index = geometry.index; if (index === null) throw new Error('fixture index');
  for (const [target, attribute] of [[gl.ARRAY_BUFFER, geometry.getAttribute('position')], [gl.ARRAY_BUFFER, geometry.getAttribute('normal')], [gl.ELEMENT_ARRAY_BUFFER, index]] as const) {
    if (!(attribute instanceof BufferAttribute)) throw new Error('fixture attribute');
    gl.bindBuffer(target, new FakeBuffer()); gl.bufferData(target, attribute.array);
  }
  const draw = (object: Mesh): void => { renderer.renderBufferDirect(camera, world, object.geometry, material, object, { start: 0, count: 0, materialIndex: 0 }); };
  draw(new Mesh(geometry, material));
  for (let frame = 0; frame < 240; frame++) renderer.render(world, camera);
  draw(sentinel); // a skinned draw settles the queue without tracking another geometry
  return { gl, geometry, index, close: () => { geometry.dispose(); sentinel.geometry.dispose(); material.dispose(); } };
}

test('off: position and index stay on the CPU, and no index upload is queried', () => {
  const { gl, geometry, index, close } = scene(false, true);
  try {
    expect(arrayReleased(geometry.getAttribute('normal'))).toBe(true);
    expect(arrayReleased(geometry.getAttribute('position'))).toBe(false);
    expect(arrayReleased(index)).toBe(false);
    expect(gl.queried).not.toContain(gl.ELEMENT_ARRAY_BUFFER_BINDING);
  } finally { close(); }
});

test('on: a bounded geometry gives up position and index, and a reader gets the uploaded bytes back', () => {
  const { geometry, index, close } = scene(true, true);
  try {
    const position = geometry.getAttribute('position');
    expect(arrayReleased(position)).toBe(true); expect(arrayReleased(index)).toBe(true);
    expect(position.count).toBe(3); expect(index.count).toBe(3);
    expect([...index.array]).toEqual([0, 1, 2]);
    expect(index.array).toBeInstanceOf(Uint16Array);
    expect(position.getX(1)).toBe(1);
    expect(arrayReleased(index)).toBe(false); expect(arrayReleased(position)).toBe(false);
  } finally { close(); }
});

test('on: a geometry without bounds keeps position (the first cull would read it back) but gives up its index', () => {
  const { geometry, index, close } = scene(true, false);
  try {
    expect(arrayReleased(geometry.getAttribute('position'))).toBe(false);
    expect(arrayReleased(index)).toBe(true);
  } finally { close(); }
});
