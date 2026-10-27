import { BufferAttribute, BufferGeometry, InterleavedBuffer, InterleavedBufferAttribute, Matrix4, Mesh } from 'three';
import { expect, test } from 'vitest';
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
