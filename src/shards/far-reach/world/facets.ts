import { BufferGeometry, Float32BufferAttribute } from 'three';

export type V3 = readonly [number, number, number];
export type RGB = readonly [number, number, number];

/** A seeded generator for authored shapes (colliders follow it, so it must repeat every load). */
export function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Flat-shaded, vertex-coloured triangles merged into one non-indexed geometry: one draw per built thing. */
export class Facets {
  private readonly pos: number[] = [];
  private readonly col: number[] = [];
  constructor(private readonly jitter = 0.06, private readonly random: () => number = seeded(1)) {}
  tri(a: V3, b: V3, c: V3, color: RGB): void {
    const k = 1 + (this.random() - 0.5) * 2 * this.jitter;
    this.pos.push(...a, ...b, ...c);
    for (let i = 0; i < 3; i++) this.col.push(color[0] * k, color[1] * k, color[2] * k);
  }
  quad(a: V3, b: V3, c: V3, d: V3, color: RGB): void { this.tri(a, b, c, color); this.tri(a, c, d, color); }
  get empty(): boolean { return this.pos.length === 0; }
  geometry(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new Float32BufferAttribute(this.col, 3));
    g.computeVertexNormals(); g.computeBoundingSphere();
    return g;
  }
}
export const mixRGB = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** An oriented box (half-extents in the frame of `m`, centred at local `c`) as 12 flat triangles. */
export function box(f: Facets, m: { applyTo: (p: [number, number, number]) => V3 }, c: V3, hx: number, hy: number, hz: number, color: RGB, under: RGB = color): void {
  const p = (sx: number, sy: number, sz: number): V3 => m.applyTo([c[0] + sx * hx, c[1] + sy * hy, c[2] + sz * hz]);
  const [a, b, cc, d] = [p(-1, 1, -1), p(1, 1, -1), p(1, 1, 1), p(-1, 1, 1)], [e, g, h, k] = [p(-1, -1, -1), p(1, -1, -1), p(1, -1, 1), p(-1, -1, 1)];
  f.quad(a, d, cc, b, color); f.quad(e, g, h, k, under);
  f.quad(d, k, h, cc, color); f.quad(b, g, e, a, color); f.quad(cc, h, g, b, under); f.quad(a, e, k, d, under);
}
