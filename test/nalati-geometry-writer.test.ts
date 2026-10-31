import { expect, it } from 'vitest';
import * as THREE from 'three';
import { writeGeometry } from '../src/shards/nalati-grasslands/generators/geometryWriter';

it('keeps distinct colliding vertices and the first occurrence of every exact row', () => {
  // These different finite positions share a candidate bucket. Identity is all bits.
  const a = [1065353216, 1073741824, 1077936128], b = [1065353217, 1090520723, 1077936128], c = [0, 0, 0];
  const geometry = new THREE.BufferGeometry(), positions = Uint32Array.from([...a, ...b, ...a, ...c, ...b, ...c]);
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions.buffer), 3));
  geometry.computeBoundingBox();
  const blocks: Uint8Array[] = [], row = writeGeometry(geometry, blocks, 'collision');
  expect(row).toEqual({ attrs: [['position', 'f32', 3, false]], count: 3, index: 'u32', indexCount: 6, box: true, expand: true });
  const values = blocks[0], indices = blocks[1];
  if (values === undefined || indices === undefined) throw new Error('Missing geometry blocks');
  expect(new Uint32Array(values.buffer, values.byteOffset, values.byteLength / 4)).toEqual(Uint32Array.from([...a, ...b, ...c]));
  expect(new Int32Array(indices.buffer, indices.byteOffset, indices.byteLength / 4)).toEqual(Int32Array.from([0, 1, -1, 2, -1, 1]));
});

it('uses every channel bit, including signed zero and distinct NaN payloads', () => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(18), 3));
  geometry.setAttribute('marker', new THREE.BufferAttribute(new Float32Array(Uint32Array.from([0, 0x80000000, 0x7fc00001, 0x7fc00002, 0, 0x80000000]).buffer), 1));
  const blocks: Uint8Array[] = [], row = writeGeometry(geometry, blocks, 'all channels');
  expect(row.attrs).toEqual([['position', 'f32', 3, false], ['marker', 'f32', 1, false]]);
  expect(row.count).toBe(4);
  const indices = blocks[2];
  if (indices === undefined) throw new Error('Missing geometry index block');
  expect(new Int32Array(indices.buffer, indices.byteOffset, indices.byteLength / 4)).toEqual(Int32Array.from([0, 1, 1, 1, -3, 1]));
});

it('retains indexed layout, compact rounding, block padding and ownership', () => {
  const geometry = new THREE.BufferGeometry();
  const position = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]), 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array([0, .5, 1, 1, 0, .5, .5, 1, 0]), 3));
  geometry.setIndex([0, 1, 2]);
  const blocks: Uint8Array[] = [], row = writeGeometry(geometry, blocks, 'compact indexed', true);
  expect(row).toEqual({ attrs: [['position', 'f32', 3, false], ['normal', 'i8', 3, true], ['color', 'u8', 3, true]], count: 3, index: 'u16', indexCount: 3, box: false, expand: false });
  expect(blocks[1]).toEqual(Uint8Array.from([0, 0, 127, 0, 0, 127, 0, 0, 127, 0, 0, 0]));
  expect(blocks[2]).toEqual(Uint8Array.from([0, 128, 255, 255, 0, 128, 128, 255, 0, 0, 0, 0]));
  const before = blocks[0]?.slice(); position.fill(9); expect(blocks[0]).toEqual(before);
  geometry.addGroup(0, 3, 0);
  expect(() => writeGeometry(geometry, [], 'grouped')).toThrow('morphs / groups');
  geometry.clearGroups(); geometry.setAttribute('position', new THREE.BufferAttribute(new Uint16Array(9), 3));
  expect(() => writeGeometry(geometry, [], 'integer')).toThrow('not plain float32');
});
