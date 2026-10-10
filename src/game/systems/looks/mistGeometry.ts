// mistGeometry — the geometry of two cheap atmosphere draws (SHARD-PLATFORM M3, ex Nine Dragon's world/build.ts): flat mist
// sheets laid across rectangles at given heights (each sheet in layers a little apart, its band and alpha per vertex for a
// fog shader), and soft billboard puffs over points (each a few camera-facing quads around its centre, a seed per quad
// for a steam shader that lifts and fades them).
//
//   new Mesh(mistSheetsGeometry(SHEETS, RECTS, [{ dy: 0, alpha: 1 }, { dy: -5, alpha: 0.7 }]), sheetMaterial)
//   new Mesh(steamPuffsGeometry(pots, 6, 0.37), steamMaterial)
import { BufferGeometry, Float32BufferAttribute, Uint32BufferAttribute, type Vector3 } from 'three';

/** A mist sheet: its height, its fog band and its alpha. */
export interface MistSheet { readonly y: number; readonly band: number; readonly a: number }
/** A rectangle the sheets span (x0…x1 by z0…z1). */
export interface MistRect { readonly x0: number; readonly x1: number; readonly z0: number; readonly z1: number }
/** A layer of every sheet: its offset under the sheet's height and its alpha scale. */
export interface MistLayer { readonly dy: number; readonly alpha: number }

/** Every sheet over every rectangle in every layer, as quads with `uv`, `aBand` and `aAlpha` (indexed, bounding sphere set). */
export function mistSheetsGeometry(sheets: readonly MistSheet[], rects: readonly MistRect[], layers: readonly MistLayer[]): BufferGeometry {
  const pos: number[] = [], uv: number[] = [], band: number[] = [], alpha: number[] = [], idx: number[] = [];
  let n = 0;
  for (const s of sheets) {
    for (const r of rects) {
      for (const layer of layers) {
        const y = s.y + layer.dy;
        const pts: [number, number, number, number][] = [[r.x0, r.z1, 0, 0], [r.x1, r.z1, 1, 0], [r.x1, r.z0, 1, 1], [r.x0, r.z0, 0, 1]];
        for (const [x, z, u, v] of pts) { pos.push(x, y, z); uv.push(u, v); band.push(s.band); alpha.push(s.a * layer.alpha); }
        idx.push(n, n + 1, n + 2, n, n + 2, n + 3);
        n += 4;
      }
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setAttribute('aBand', new Float32BufferAttribute(band, 1));
  g.setAttribute('aAlpha', new Float32BufferAttribute(alpha, 1));
  g.setIndex(new Uint32BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  return g;
}

/** `perPoint` billboard quads over each point, as `aCenter`, `aCorner` (±1) and `aSeed` ((point · stride + quad / perPoint) mod 1). */
export function steamPuffsGeometry(points: readonly Vector3[], perPoint: number, stride: number): BufferGeometry {
  const center: number[] = [], corner: number[] = [], seed: number[] = [], pos: number[] = [], idx: number[] = [];
  let n = 0;
  points.forEach((p, pi) => {
    for (let j = 0; j < perPoint; j++) {
      const sd = (pi * stride + j / perPoint) % 1;
      for (const [cx, cy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) { center.push(p.x, p.y, p.z); corner.push(cx, cy); seed.push(sd); pos.push(p.x, p.y, p.z); }
      idx.push(n, n + 1, n + 2, n, n + 2, n + 3);
      n += 4;
    }
  });
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('aCenter', new Float32BufferAttribute(center, 3));
  g.setAttribute('aCorner', new Float32BufferAttribute(corner, 2));
  g.setAttribute('aSeed', new Float32BufferAttribute(seed, 1));
  g.setIndex(new Uint32BufferAttribute(idx, 1));
  return g;
}
