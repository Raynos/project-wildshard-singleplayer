// clothTopology — the fixed topology a strand cloth or a cloth sheet is drawn over (SHARD-PLATFORM M3, ex Nine Dragon's
// vm/cloth.ts, E169): written into a class kit at the origin, so the cloth's step only rewrites positions and normals in
// the same layout every frame. A tube is `rings` rings of `segs + 1` vertices (u round, v along, a faint slub in the
// detail map), a sheet `cols` × `rows` vertices facing +z (u across, v down).
//
//   tubeTopology(g, TASSEL.pts, TASSEL.strandSegs, { cls: CLS.silk }, TASSEL.len);
import { Vector3 } from 'three';
import type { ClassKit, ClassLook } from './classKit';

/** a static tube topology (`rings` rings of `segs + 1` vertices, v running 0..`uvLen` along it) written into `g` */
export function tubeTopology(g: ClassKit, rings: number, segs: number, look: ClassLook, uvLen: number): void {
  const base = g.vertexCount;
  const z = new Vector3(0, 0, 0), up = new Vector3(0, 1, 0);
  for (let i = 0; i < rings; i++) {
    for (let k = 0; k <= segs; k++) g.vert(z, up, k / segs, (i / (rings - 1)) * uvLen, look, [0, 0, 0, 0], [1, 0.5, 0.5 + 0.12 * Math.sin(k * 2.1 + i)]);
  }
  const row = segs + 1;
  for (let i = 0; i < rings - 1; i++) {
    for (let k = 0; k < segs; k++) {
      const a = base + i * row + k, b = a + 1, c = a + row, d = c + 1;
      g.tri(a, c, b);
      g.tri(b, c, d);
    }
  }
}

/** a static sheet topology (`cols` × `rows` vertices facing +z, u across, v from 1 at the top row to 0) written into an
 *  empty `g` */
export function sheetTopology(g: ClassKit, cols: number, rows: number, look: ClassLook): void {
  const z = new Vector3(0, 0, 0), n = new Vector3(0, 0, 1);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) g.vert(z, n, c / (cols - 1), 1 - r / (rows - 1), look);
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const a = r * cols + c, b = a + 1, d = a + cols, e = d + 1;
      g.tri(a, d, b);
      g.tri(b, d, e);
    }
  }
}
