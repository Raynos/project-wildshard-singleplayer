import { BufferAttribute, BufferGeometry, InterleavedBuffer, InterleavedBufferAttribute, Matrix4, Mesh } from 'three';
import { expect, test, vi } from 'vitest';
import { assembleWholeGeometryViews } from '../src/game/plugin/geometry';

const positions = [[0, 0, 0], [8, 0, 0], [0, 4, 0], [8, 4, 0]];
function partition(vertices: number[], triangle: number, gridded: boolean): Mesh {
  const geometry = new BufferGeometry(), integers = new Int16Array(vertices.length * 4), paint = new Uint8Array(vertices.length * 8), uv = new Float32Array(vertices.length * 4);
  for (const [local, vertex] of vertices.entries()) {
    integers.set(positions[vertex] ?? [], local * 4); integers[local * 4 + 3] = -1234;
    paint.set([239, vertex * 30, 42, 255, 77, 91, 17, 83], local * 8);
    uv.set([777, vertex / 4, -vertex / 8, 888], local * 4);
  }
  geometry.setAttribute('position', new InterleavedBufferAttribute(new InterleavedBuffer(integers, 4), 3, 0));
  geometry.setAttribute('color', new InterleavedBufferAttribute(new InterleavedBuffer(paint, 8), 4, 1, true));
  geometry.setAttribute('uv', new InterleavedBufferAttribute(new InterleavedBuffer(uv, 4), 2, 1));
  geometry.setAttribute('_half', new BufferAttribute(new Uint16Array(vertices.flatMap(vertex => [0x3c00 + vertex, 0x8000])), 2));
  geometry.setIndex([0, 1, 2]);
  const node = new Mesh(geometry);
  node.userData['nativeAttributes'] = {
    position: { semantic: 'POSITION', storage: 'Int16Array', normalized: false, itemSize: 3 },
    color: { semantic: 'COLOR_0', storage: 'Uint8Array', normalized: true, itemSize: 4 },
    uv: { semantic: 'TEXCOORD_0', storage: 'Float32Array', normalized: false, itemSize: 2 },
    half: { semantic: '_HALF', storage: 'Float16Array', normalized: false, itemSize: 2 },
  };
  node.userData['matrix64'] = new Matrix4().makeTranslation(3, 7, -8).elements;
  node.userData['wholePartition'] = { id: 'source', vertices, triangles: [triangle], vertexCount: 4, indexCount: 6, index: 'u16',
    ...(gridded ? { grid: { origin: [0.125, -1.75, 4.25], step: 0.0625 } } : {}) };
  return node;
}
function facts(geometry: BufferGeometry): unknown {
  return { attributes: Object.fromEntries(Object.entries(geometry.attributes).map(([name, attribute]) => [name, {
    storage: attribute.array.constructor.name, size: attribute.itemSize, normalized: attribute.normalized,
    bytes: new Uint8Array(attribute.array.buffer, attribute.array.byteOffset, attribute.array.byteLength),
  }])), index: geometry.index?.array, box: geometry.boundingBox, sphere: geometry.boundingSphere };
}

test.each([false, true])('owned strided assembly matches the complete borrowed result (grid=%s)', gridded => {
  const nodes = [partition([0, 1, 2], 0, gridded), partition([1, 3, 2], 1, gridded)];
  const originals = nodes.map(node => ({ attributes: { ...node.geometry.attributes }, words: facts(node.geometry) }));
  const borrowed = assembleWholeGeometryViews(nodes), owned = assembleWholeGeometryViews(nodes, 'take');
  try {
    const before = borrowed.get('source'), after = owned.get('source');
    if (before === undefined || after === undefined) throw new Error('Missing assembled source');
    expect(facts(after.geometry)).toEqual(facts(before.geometry)); expect(after.matrix).toEqual(before.matrix);
    for (const [index, node] of nodes.entries()) {
      const original = originals[index]; if (original === undefined) throw new Error('Missing original');
      expect(facts(node.geometry)).toEqual(original.words);
      for (const [name, attribute] of Object.entries(original.attributes)) expect(node.geometry.getAttribute(name)).toBe(attribute);
    }
  } finally {
    for (const view of [...borrowed.values(), ...owned.values()]) view.geometry.dispose();
    for (const node of nodes) node.geometry.dispose();
  }
});

test.each(['borrow', 'take'] as const)('strided shared vertices still refuse conflicting bytes (%s)', ownership => {
  const first = partition([0, 1, 2], 0, true), second = partition([1, 3, 2], 1, true);
  second.geometry.getAttribute('color').setX(0, 0);
  expect(() => assembleWholeGeometryViews([first, second], ownership)).toThrow('shared vertex differs');
  first.geometry.dispose(); second.geometry.dispose();
});


test.each(['borrow', 'take'] as const)('grid restoration writes final Float32 ordinals once and keeps rounded sharing (%s)', ownership => {
  const nodes = [partition([0, 1, 2], 0, true), partition([1, 3, 2], 1, true)];
  // Different double-precision grid results that round to the same original
  // Float32 vertex remain legal, exactly as the former temporary attribute.
  const second = nodes[1]; if (second === undefined) throw new Error('Missing shared grid node');
  second.userData['wholePartition'] = { id: 'source', vertices: [1, 3, 2], triangles: [1], vertexCount: 4, indexCount: 6, index: 'u16',
    grid: { origin: [0.125, -1.75, 4.25], step: 0.0625000001 } };
  const expected = Float32Array.from(positions.flatMap(point => [(point[0] ?? 0) * 0.0625 + 0.125, (point[1] ?? 0) * 0.0625 - 1.75, (point[2] ?? 0) * 0.0625 + 4.25]));
  const originals = nodes.map(node => facts(node.geometry)), assigned = vi.spyOn(BufferGeometry.prototype, 'setAttribute');
  const result = assembleWholeGeometryViews(nodes, ownership);
  try {
    const view = result.get('source'), position: unknown = view?.geometry.getAttribute('position');
    if (!(position instanceof BufferAttribute)) throw new Error('Missing restored positions');
    expect(result.size).toBe(1);
    expect(new Uint8Array(position.array.buffer, position.array.byteOffset, position.array.byteLength)).toEqual(new Uint8Array(expected.buffer));
    expect(position.normalized).toBe(false); expect(position.itemSize).toBe(3);
    expect(view?.geometry.index?.array).toEqual(Uint16Array.from([0, 1, 2, 1, 3, 2]));
    expect(view?.matrix).toEqual(new Matrix4().makeTranslation(3, 7, -8));
    const floats = assigned.mock.calls.filter(([name, attribute]) => name === 'position' && attribute instanceof BufferAttribute && attribute.array instanceof Float32Array);
    expect(floats).toHaveLength(1); // The final output, with no per-partition temporary.
    expect(nodes.map(node => facts(node.geometry))).toEqual(originals);
  } finally {
    assigned.mockRestore(); for (const view of result.values()) view.geometry.dispose(); for (const node of nodes) node.geometry.dispose();
  }
});

test.each(['borrow', 'take'] as const)('different restored shared grid words still refuse (%s)', ownership => {
  const first = partition([0, 1, 2], 0, true), second = partition([1, 3, 2], 1, true);
  second.userData['wholePartition'] = { id: 'source', vertices: [1, 3, 2], triangles: [1], vertexCount: 4, indexCount: 6, index: 'u16',
    grid: { origin: [0.125, -1.75, 4.25], step: 0.125 } };
  try { expect(() => assembleWholeGeometryViews([first, second], ownership)).toThrow('Whole shared vertex differs'); }
  finally { first.geometry.dispose(); second.geometry.dispose(); }
});

test.each(['storage', 'normalized', 'width'] as const)('invalid grid %s still refuses and disposes only temporary input', mode => {
  const node = partition([0, 1, 2], 0, true), storage = mode === 'storage' ? 'Float32Array' : 'Int16Array';
  const width = mode === 'width' ? 4 : 3, normalized = mode === 'normalized';
  node.geometry.setAttribute('position', new BufferAttribute(mode === 'storage' ? new Float32Array(12) : new Int16Array(12), width, normalized));
  node.userData['nativeAttributes'] = { position: { semantic: 'POSITION', storage, normalized, itemSize: width } };
  const before = facts(node.geometry), disposed = vi.spyOn(BufferGeometry.prototype, 'dispose');
  try {
    expect(() => assembleWholeGeometryViews([node], 'take')).toThrow('Whole grid needs Int16 positions');
    expect(disposed.mock.contexts).toHaveLength(1);
    expect(disposed.mock.contexts[0]).not.toBe(node.geometry);
    expect(facts(node.geometry)).toEqual(before);
  } finally { disposed.mockRestore(); node.geometry.dispose(); }
});


test.each(['borrow', 'take'] as const)('signed grid extremes retain the original Float32 write boundary (%s)', ownership => {
  const samples = [[-32768, -1, 32767], [12, 0, -23], [-237, 32767, 100], [32767, -32768, 5]] as const;
  const ordinals = [[0, 1, 2], [1, 3, 2]], origin = [0.1000000000003, -1 / 3, 4.25000000000001] as const;
  const step = 0.00031250000000000006, nodes = [partition([0, 1, 2], 0, true), partition([1, 3, 2], 1, true)];
  for (const [index, node] of nodes.entries()) {
    const attribute: unknown = node.geometry.getAttribute('position'), vertices = ordinals[index];
    if (!(attribute instanceof InterleavedBufferAttribute) || vertices === undefined) throw new Error('Missing signed grid fixture');
    for (const [local, vertex] of vertices.entries()) {
      const sample = samples[vertex]; if (sample === undefined) throw new Error('Missing signed grid vertex');
      attribute.setXYZ(local, sample[0], sample[1], sample[2]);
    }
    node.userData['wholePartition'] = { id: 'source', vertices, triangles: [index], vertexCount: 4, indexCount: 6, index: 'u16', grid: { origin, step } };
  }
  // Independent former temporary-array oracle, including non-binary scale and
  // origins at both signed Int16 limits; compare raw Float32 words, no tolerance.
  const expected = Float32Array.from(samples.flatMap(([x, y, z]) => [x * step + origin[0], y * step + origin[1], z * step + origin[2]]));
  const result = assembleWholeGeometryViews(nodes, ownership);
  try {
    const actual: unknown = result.get('source')?.geometry.getAttribute('position');
    if (!(actual instanceof BufferAttribute)) throw new Error('Missing signed grid output');
    expect(new Uint8Array(actual.array.buffer, actual.array.byteOffset, actual.array.byteLength)).toEqual(new Uint8Array(expected.buffer));
  } finally { for (const view of result.values()) view.geometry.dispose(); for (const node of nodes) node.geometry.dispose(); }
});
