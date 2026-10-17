import { afterEach, expect, test, vi } from 'vitest';
import { BufferAttribute, BufferGeometry, Matrix4, MeshBasicMaterial } from 'three';
import { zlibSync } from 'fflate';
import { Scope } from '../src/engine/app/scope';
import { pageScope } from '../src/engine/app/resources';
import { enterOwner } from '../src/engine/app/ownership';
import { fetchDeflatedBytes } from '../src/engine/core/deflate';
import { fetchLaneBake, readWholeGeometry, unshuffleLanes } from '../src/game/plugin/geometry';
import { provideRuntimeProduct } from '../src/game/shardfile/runtimeProduct';
import { emptyShardfile } from '../src/sdk/author';
import { staticGlb } from '../src/sdk/bake/glb';
import { hashImmutableBytes } from '../src/sdk/immutable';

const owners: Scope[] = [], geometries: BufferGeometry[] = [], materials: MeshBasicMaterial[] = [];
const nativeFetch = globalThis.fetch, nativeDecoder = globalThis.DecompressionStream;
afterEach(() => { vi.restoreAllMocks(); vi.stubGlobal('fetch', nativeFetch); vi.stubGlobal('DecompressionStream', nativeDecoder); for (const owner of owners.splice(0)) owner.dispose(); for (const geometry of geometries.splice(0)) geometry.dispose(); for (const material of materials.splice(0)) material.dispose(); });

function source(owner: Scope): { geometry: BufferGeometry; ref: string; matrix: Matrix4 } {
  owners.push(owner);
  const geometry = new BufferGeometry(), count = 65538, positions = new Float32Array(count * 3);
  for (let i = 0; i < positions.length; i++) positions[i] = Math.sin(i) * (i % 97 - 48);
  geometry.setAttribute('position', new BufferAttribute(positions, 3)); geometries.push(geometry);
  const material = new MeshBasicMaterial(), matrix = new Matrix4().makeTranslation(3.25, -2.5, 8.125); materials.push(material);
  const bytes = staticGlb([{ geometry, material, nativeAttributes: true, compactIndex: true, transform: matrix,
    extras: { wholePartition: { id: 'draw', vertices: { runs: [0, count] }, triangles: { runs: [0, count / 3] }, vertexCount: count, indexCount: 0, index: 'none' } } }]);
  const ref = hashImmutableBytes(bytes), product = emptyShardfile({ slug: 'whole-pace', name: 'Whole pace', author: 'Test', revision: 1, seed: 1 });
  product.files.push({ hash: ref, kind: 'glb', compressed: bytes.length, decoded: bytes.length, gpu: positions.byteLength, triangles: count / 3, draws: 1, dependencies: [], critical: false });
  provideRuntimeProduct({ source: product, assets: new Map([[ref, bytes]]), cached: false }, owner, {
    base: 'https://test.example/shardfiles/whole-pace/', offline: false, firstParty: true,
    fetch: () => Promise.reject(new Error('All test bytes must be admitted')), hash: wire => Promise.resolve(hashImmutableBytes(wire)),
  });
  return { geometry, ref, matrix };
}

test('yields through final validation and bounds without changing source bytes or exact sphere', async () => {
  const owner = new Scope('whole-pace'), fixture = source(owner), original = fixture.geometry, oracle = original.clone(), pause = vi.fn(() => Promise.resolve());
  oracle.computeBoundingSphere();
  try {
    const result = await readWholeGeometry(owner, 'whole-pace', [fixture.ref], pause), view = result.get('draw');
    expect(pause.mock.calls.length).toBeGreaterThan(4);
    expect(view?.geometry.getAttribute('position').array).toEqual(original.getAttribute('position').array);
    expect(view?.geometry.boundingSphere).toEqual(oracle.boundingSphere);
    expect(view?.geometry.boundingBox).toBeNull();
    expect(view?.matrix.elements).toEqual(fixture.matrix.elements);
    expect(result.size).toBe(1);
  } finally { owner.dispose(); oracle.dispose(); }
});

test('a scope closed during finalization disposes the unpublished reconstructed draw', async () => {
  const owner = new Scope('whole-cancel'), fixture = source(owner), disposed = vi.spyOn(BufferGeometry.prototype, 'dispose');
  let turns = 0;
  await expect(readWholeGeometry(owner, 'whole-pace', [fixture.ref], () => {
    if (++turns === 2) owner.dispose();
    return Promise.resolve();
  })).rejects.toThrow('Whole geometry unloaded while reading');
  expect(turns).toBe(2);
  expect(disposed.mock.contexts.some((geometry: unknown) => {
    if (!(geometry instanceof BufferGeometry) || geometry === fixture.geometry) return false;
    const position: unknown = geometry.getAttribute('position');
    return position instanceof BufferAttribute && position.count === 65538;
  })).toBe(true);
});

test('the default reader uses the owned work slice when no pause is supplied', async () => {
  const owner = new Scope('whole-default'), fixture = source(owner), timeout = vi.spyOn(owner, 'timeout');
  let at = 0; vi.spyOn(performance, 'now').mockImplementation(() => { at += 10; return at; });
  try {
    const result = await readWholeGeometry(owner, 'whole-pace', [fixture.ref]);
    expect(result.size).toBe(1); expect(timeout.mock.calls.length).toBeGreaterThan(1);
  } finally { owner.dispose(); }
});

test('closing the default yield owner cannot strand a reconstruction', async () => {
  const owner = new Scope('whole-default-cancel'), fixture = source(owner);
  let at = 0; vi.spyOn(performance, 'now').mockImplementation(() => { at += 10; return at; });
  vi.spyOn(owner, 'timeout').mockImplementation(() => { owner.dispose(); return 0; });
  await expect(readWholeGeometry(owner, 'whole-pace', [fixture.ref])).rejects.toThrow('Whole geometry unloaded while reading');
});

test('bounds native inflate input and yields without changing bytes from a single network chunk', async () => {
  const bytes = new Uint8Array(262_144), chunks: number[] = [];
  let seed = 17;
  for (let i = 0; i < bytes.length; i++) { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; bytes[i] = seed & 255; }
  const compressed = zlibSync(bytes), NativeDecoder = DecompressionStream;
  vi.stubGlobal('DecompressionStream', class {
    readonly readable: ReadableStream<Uint8Array<ArrayBuffer>>;
    readonly writable: WritableStream<BufferSource>;
    constructor(format: CompressionFormat) {
      const boundary = new TransformStream<BufferSource, BufferSource>({ transform(chunk, controller) { chunks.push(chunk.byteLength); controller.enqueue(chunk); } });
      this.readable = boundary.readable.pipeThrough(new NativeDecoder(format)); this.writable = boundary.writable;
    }
  });
  vi.stubGlobal('fetch', () => Promise.resolve(new Response(compressed)));
  const timeout = vi.spyOn(pageScope, 'timeout');
  let at = 0; vi.spyOn(performance, 'now').mockImplementation(() => { at += 10; return at; });
  expect(await fetchDeflatedBytes('https://test.example/bake')).toEqual(bytes);
  expect(Math.max(...chunks)).toBeLessThanOrEqual(16_384);
  expect(chunks.reduce((sum, size) => sum + size, 0)).toBe(compressed.length);
  expect(timeout.mock.calls.length).toBeGreaterThan(1);
});

test('restores every lane byte across paced blocks and refuses partial words', async () => {
  const lanes = new Uint8Array(1_048_576), words = lanes.length / 4, expected = new Uint8Array(lanes.length);
  for (let i = 0; i < words; i++) for (let b = 0; b < 4; b++) { const value = (i * 13 + b * 53) & 255; lanes[b * words + i] = value; expected[i * 4 + b] = value; }
  vi.stubGlobal('fetch', () => Promise.resolve(new Response(zlibSync(lanes))));
  const timeout = vi.spyOn(pageScope, 'timeout');
  let at = 0; vi.spyOn(performance, 'now').mockImplementation(() => { at += 10; return at; });
  expect(await fetchLaneBake('https://test.example/lanes')).toEqual(expected);
  expect(unshuffleLanes(lanes)).toEqual(expected);
  const range = new Uint8Array(lanes.length);
  unshuffleLanes(lanes, range, 2, 5);
  expect(range.slice(8, 20)).toEqual(expected.slice(8, 20));
  expect(range.slice(0, 8)).toEqual(new Uint8Array(8));
  expect(range.slice(20)).toEqual(new Uint8Array(lanes.length - 20));
  expect(() => unshuffleLanes(lanes, lanes)).toThrow('bad output/range');
  expect(() => unshuffleLanes(lanes, range, -1, 5)).toThrow('bad output/range');
  expect(() => unshuffleLanes(lanes, range, 0, words + 1)).toThrow('bad output/range');
  expect(timeout.mock.calls.length).toBeGreaterThan(4);
  vi.stubGlobal('fetch', () => Promise.resolve(new Response(zlibSync(new Uint8Array(3)))));
  await expect(fetchLaneBake('https://test.example/partial')).rejects.toThrow('not whole words');
});

test('refuses HTTP and invalid deflate responses rather than publishing partial bytes', async () => {
  vi.stubGlobal('fetch', () => Promise.resolve(new Response(null, { status: 404 })));
  await expect(fetchDeflatedBytes('https://test.example/missing')).rejects.toThrow('404');
  vi.stubGlobal('fetch', () => Promise.resolve(new Response(new Uint8Array([1, 2, 3]))));
  await expect(fetchDeflatedBytes('https://test.example/invalid')).rejects.toThrow();
});

test('a page-lived bake read survives a retired ambient construction owner', async () => {
  const bytes = new Uint8Array(65_536), retired = new Scope('retired-bake-reader'); owners.push(retired);
  vi.stubGlobal('fetch', () => Promise.resolve(new Response(zlibSync(bytes))));
  let at = 0; vi.spyOn(performance, 'now').mockImplementation(() => { at += 10; return at; });
  enterOwner(retired); retired.dispose();
  try { expect(await fetchDeflatedBytes('https://test.example/page-bake')).toEqual(bytes); }
  finally { enterOwner(null); }
});
