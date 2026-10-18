import { BufferGeometry, Color, Float32BufferAttribute } from 'three';

/** A falling sheet: white at the lip fading to nothing far below (vertex alpha), a slight outward bow. */
export function fallGeometry(length: number, width: number): BufferGeometry {
  const pos: number[] = [], col: number[] = [], rows = 6, c = new Color();
  for (let r = 0; r < rows; r++) {
    const t0 = r / rows, t1 = (r + 1) / rows, y0 = -t0 * length, y1 = -t1 * length, b0 = Math.sin(t0 * 1.4) * 1.5, b1 = Math.sin(t1 * 1.4) * 1.5;
    const a0 = 1 - t0, a1 = 1 - t1;
    const quad: [number, number, number, number][] = [[-width / 2, y0, b0, a0], [width / 2, y0, b0, a0], [width / 2, y1, b1, a1], [-width / 2, y0, b0, a0], [width / 2, y1, b1, a1], [-width / 2, y1, b1, a1]];
    for (const [x, y, z, a] of quad) { pos.push(x, y, z); c.setRGB(0.95, 0.97, 1); col.push(c.r, c.g, c.b, a * 0.8); }
  }
  const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(pos, 3)); g.setAttribute('color', new Float32BufferAttribute(col, 4));
  return g;
}
