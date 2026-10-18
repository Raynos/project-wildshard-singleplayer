import { describe, expect, it } from 'vitest';
import { decodeHibiscusWorld } from '../src/shards/driftwood-isle/generators/foliageGeometry';

const phone = (): Uint8Array => {
  const buffer = new ArrayBuffer(16 + (6 + 3 * 11) * 4), header = new DataView(buffer);
  header.setUint32(0, 0x31424948, true); header.setUint32(4, 1, true); header.setUint32(8, 3, true); header.setUint32(12, 1, true);
  new Float32Array(buffer, 16).set([-1, 0, -1, 1, 2, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0]);
  return new Uint8Array(buffer);
};
describe('the owned hibiscus world bake', () => {
  it('draws the compacted native shape with independent disposable channels and original copy boxes', () => {
    const bytes = phone(), count = new DataView(bytes.buffer).getUint32(12, true);
    const { geometry, boxes } = decodeHibiscusWorld(bytes, count);
    expect(boxes.length).toBe(count * 6);
    expect(geometry.getAttribute('position').count).toBeGreaterThan(0);
    expect(geometry.getAttribute('aSway').count).toBe(geometry.getAttribute('position').count);
    const position = geometry.getAttribute('position').array, colour = geometry.getAttribute('color').array;
    expect(position.buffer).not.toBe(bytes.buffer);
    expect(colour.buffer).not.toBe(position.buffer);
    expect(boxes.buffer).not.toBe(position.buffer);
    geometry.dispose();
  });
  it('refuses another scatter, truncated data and nonfinite channels before returning geometry', () => {
    const bytes = phone(), count = new DataView(bytes.buffer).getUint32(12, true);
    expect(() => decodeHibiscusWorld(bytes, count + 1)).toThrow('topology');
    expect(() => decodeHibiscusWorld(bytes.subarray(0, -4), count)).toThrow('topology');
    new DataView(bytes.buffer).setFloat32(16 + count * 24, Number.NaN, true);
    expect(() => decodeHibiscusWorld(bytes, count)).toThrow('Nonfinite');
  });
});

