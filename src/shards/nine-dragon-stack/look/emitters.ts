import { resourceScope } from '@wildshard/engine/app/resources';
// Everything that glows (signs, lanterns, lit shopfronts): the streak cards read these, and the neon SPILL is baked
// once at build time into a per-vertex attribute of the merged kits (the neon lab's integration step 6: no per-pixel
// light loop). Spill = Σ colour × strength / (1 + r² / R²), R = 2.2 · max(w, h) + 1.5, cut at 3R, via a spatial grid.
import { BufferAttribute, type BufferGeometry, type Color, Float32BufferAttribute, type Vector3 } from 'three';

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

/** Bakes the same per-vertex light as the lab while keeping phone WebKit's page thread responsive. */
export async function bakeSpill(geos: readonly BufferGeometry[], emitters: readonly Emitter[]): Promise<void> {
  interface Light { x: number; y: number; z: number; r2: number; invR2: number; r: number; g: number; b: number; spill: number }
  const grid = new Map<number, Light[]>();
  // The build occupies far less than ±1024 cells on each axis. A numeric key avoids millions of
  // short string allocations during the vertex pass (a long GC pause on iOS WebKit).
  const key = (x: number, y: number, z: number): number => (x + 1024) * 4194304 + (y + 1024) * 2048 + z + 1024;
  for (const e of emitters) {
    if (e.spill <= 0) continue;
    const R = 2.2 * Math.max(e.w, e.h) + 1.5;
    const r2 = R * R;
    const light: Light = { x: e.at.x, y: e.at.y, z: e.at.z, r2, invR2: 1 / r2, r: e.color.r, g: e.color.g, b: e.color.b, spill: e.spill };
    const reach = Math.ceil((3 * R) / CELL);
    const cx = Math.floor(e.at.x / CELL), cy = Math.floor(e.at.y / CELL), cz = Math.floor(e.at.z / CELL);
    for (let dx = -reach; dx <= reach; dx++) for (let dy = -reach; dy <= reach; dy++) for (let dz = -reach; dz <= reach; dz++) {
      const k = key(cx + dx, cy + dy, cz + dz);
      let list = grid.get(k);
      if (list === undefined) { list = []; grid.set(k, list); }
      list.push(light);
    }
  }
  let lastYield = performance.now();
  for (const g of geos) {
    const pos = g.getAttribute('position');
    const nor = g.getAttribute('normal');
    if (!(pos instanceof BufferAttribute) || !(nor instanceof BufferAttribute)) continue;
    const pa = pos.array, na = nor.array;
    const out = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const o = i * 3;
      const px = pa[o] ?? 0, py = pa[o + 1] ?? 0, pz = pa[o + 2] ?? 0;
      const list = grid.get(key(Math.floor(px / CELL), Math.floor(py / CELL), Math.floor(pz / CELL)));
      let r = 0, gg = 0, b = 0;
      if (list !== undefined) for (const e of list) {
        const dx = e.x - px, dy = e.y - py, dz = e.z - pz;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 > 9 * e.r2) continue;
        const dot = (na[o] ?? 0) * dx + (na[o + 1] ?? 0) * dy + (na[o + 2] ?? 0) * dz;
        const facing = Math.max(dot / Math.sqrt(Math.max(d2, 1e-4)), 0) * 0.75 + 0.25;
        const k = (e.spill * facing) / (1 + d2 * e.invR2);
        r += e.r * k;
        gg += e.g * k;
        b += e.b * k;
      }
      out[o] = r;
      out[o + 1] = gg;
      out[o + 2] = b;
      if ((i & 8191) === 8191 && performance.now() - lastYield > 24) {
        await new Promise<void>((resolve) => { resourceScope().timeout(0, resolve); });
        lastYield = performance.now();
      }
    }
    g.setAttribute('aSpill', new Float32BufferAttribute(out, 3));
  }
}
