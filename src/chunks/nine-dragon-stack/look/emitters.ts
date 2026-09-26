// Everything that glows (signs, lanterns, lit shopfronts): the streak cards read these, and the neon SPILL is baked
// once at build time into a per-vertex attribute of the merged kits (the neon lab's integration step 6: no per-pixel
// light loop). Spill = Σ colour × strength / (1 + r² / R²), R = 2.2 · max(w, h) + 1.5, cut at 3R, via a spatial grid.
import { type BufferGeometry, type Color, Float32BufferAttribute, Vector3 } from 'three';

export interface Emitter {
  at: Vector3;
  /** linear colour (the saturated hue) */
  color: Color;
  /** size of the glowing face, metres */
  w: number;
  h: number;
  /** reflection strength (streak cards) */
  power: number;
  /** spill strength on walls and ground (0 = none) */
  spill: number;
}

const CELL = 8;

export function bakeSpill(geos: readonly BufferGeometry[], emitters: readonly Emitter[]): void {
  const grid = new Map<string, Emitter[]>();
  const key = (x: number, y: number, z: number): string => `${x},${y},${z}`;
  for (const e of emitters) {
    if (e.spill <= 0) continue;
    const R = 2.2 * Math.max(e.w, e.h) + 1.5;
    const reach = Math.ceil((3 * R) / CELL);
    const cx = Math.floor(e.at.x / CELL), cy = Math.floor(e.at.y / CELL), cz = Math.floor(e.at.z / CELL);
    for (let dx = -reach; dx <= reach; dx++) for (let dy = -reach; dy <= reach; dy++) for (let dz = -reach; dz <= reach; dz++) {
      const k = key(cx + dx, cy + dy, cz + dz);
      let list = grid.get(k);
      if (list === undefined) { list = []; grid.set(k, list); }
      list.push(e);
    }
  }
  const p = new Vector3(), n = new Vector3(), d = new Vector3();
  for (const g of geos) {
    const pos = g.getAttribute('position');
    const nor = g.getAttribute('normal');
    const out = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      p.set(pos.getX(i), pos.getY(i), pos.getZ(i));
      n.set(nor.getX(i), nor.getY(i), nor.getZ(i));
      const list = grid.get(key(Math.floor(p.x / CELL), Math.floor(p.y / CELL), Math.floor(p.z / CELL)));
      if (list === undefined) continue;
      let r = 0, gg = 0, b = 0;
      for (const e of list) {
        d.subVectors(e.at, p);
        const r2 = d.lengthSq();
        const R = 2.2 * Math.max(e.w, e.h) + 1.5;
        if (r2 > 9 * R * R) continue;
        const facing = Math.max(n.dot(d) / Math.sqrt(Math.max(r2, 1e-4)), 0) * 0.75 + 0.25;
        const k = (e.spill * facing) / (1 + r2 / (R * R));
        r += e.color.r * k;
        gg += e.color.g * k;
        b += e.color.b * k;
      }
      out[i * 3] = r;
      out[i * 3 + 1] = gg;
      out[i * 3 + 2] = b;
    }
    g.setAttribute('aSpill', new Float32BufferAttribute(out, 3));
  }
}
