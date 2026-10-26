import { BufferGeometry, Float32BufferAttribute } from 'three';
import { expect, test } from 'vitest';
import { compactTileGeometry } from './worldGeometry';

// RM8.1a: a clipped tile's triangle soup welds into indexed, quantized channels without moving a position
test('compacted tile geometry keeps every triangle, exact positions and close normals and colours', () => {
  const soup = new BufferGeometry();
  // two triangles of one quad (shared corners repeated, as worldGeometry clips them) and one apart
  const p = [0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 1, 5.125, 2.5, -3.75, 6, 2.5, -3.75, 5.5, 3.25, -3.75];
  const n = [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0.6, 0, 0.8, 0.6, 0, 0.8, 0.6, 0, 0.8];
  const c = Array.from({ length: 27 }, (_, i) => (i % 3) / 3 + 0.123456);
  soup.setAttribute('position', new Float32BufferAttribute(p, 3));
  soup.setAttribute('normal', new Float32BufferAttribute(n, 3));
  soup.setAttribute('color', new Float32BufferAttribute(c, 3));
  const compact = compactTileGeometry(soup), index = compact.getIndex();
  expect(index?.array).toBeInstanceOf(Uint16Array);
  expect(index?.count).toBe(9);
  expect(compact.getAttribute('position').count).toBe(7); // the quad's two shared corners welded
  expect(compact.getAttribute('normal').array).toBeInstanceOf(Int8Array);
  expect(compact.getAttribute('normal').normalized).toBe(true);
  expect(compact.getAttribute('color').array).toBeInstanceOf(Uint16Array);
  for (let corner = 0; corner < 9; corner++) {
    const at = index?.getX(corner) ?? -1;
    for (let k = 0; k < 3; k++) {
      expect(compact.getAttribute('position').getComponent(at, k)).toBe(soup.getAttribute('position').getComponent(corner, k));
      expect(Math.abs(compact.getAttribute('normal').getComponent(at, k) - soup.getAttribute('normal').getComponent(corner, k))).toBeLessThanOrEqual(0.5 / 127);
      expect(Math.abs(compact.getAttribute('color').getComponent(at, k) - soup.getAttribute('color').getComponent(corner, k))).toBeLessThanOrEqual(0.5 / 65535);
    }
  }
});
