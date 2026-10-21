import { expect, test } from 'vitest';
import { skinGeometry } from '../src/shards/pine-hollow/generators/cragCodec';
import { streamGeometry } from '../src/shards/pine-hollow/generators/streamCodec';

test('Pine bounds only the edge coordinates, preserving native channels and triangle ordinals', () => {
  const position = new Float32Array([-250.98, 3, 4, 2, 5, 250.33, 6, 7, 8]);
  const ao = new Float32Array([0.1, 0.2, 0.3]), index = new Uint16Array([0, 1, 2]);
  const uv = new Float32Array([0, 1, 2, 3, 4, 5]), water = new Float32Array(12).fill(0.5);
  const raw = new Uint8Array(position.byteLength + uv.byteLength + water.byteLength + index.byteLength);
  let at = 0;
  for (const array of [position, uv, water, index]) { raw.set(new Uint8Array(array.buffer), at); at += array.byteLength; }
  const saved = raw.slice(), crag = skinGeometry(position, ao, index), stream = streamGeometry(raw, { bytes: raw.length, vertices: 3, indices: 3, wide: false });
  try {
    for (const shape of [crag, stream]) {
      expect(Array.from(shape.getAttribute('position').array)).toEqual([-250, 3, 4, 2, 5, 250, 6, 7, 8]);
      expect(shape.getIndex()?.array).toEqual(index);
    }
    expect(stream.getAttribute('uv').array).toEqual(uv);
    expect(stream.getAttribute('aWater').array).toEqual(water);
    expect(crag.getAttribute('cdata').getX(1)).toBe(ao[1]);
    expect(raw).toEqual(saved);
    expect(position[0]).toBeLessThan(-250);
  } finally { crag.dispose(); stream.dispose(); }
});
