// Real cloth sway for the jian's red silk tassel and yellow paper talisman (lab P8 "viewmodel", E169): rows on the SDK
// strand cloth (data/cloth.ts), stepped in the viewmodel scene's space (= view space: the vm camera sits at the origin),
// pinned to pivots that ride the sword. This module builds their fixed topology in the viewmodel's geometry (~1.5 k
// vertices in all), drawn by the viewmodel program + its ink hull; the fu decal on both faces of the talisman.
import type { BufferGeometry } from 'three';
import { ClothSheet, type ClothCapsule, StrandTassel, clothPenetration } from '@wildshard/sdk/looks/strandCloth';
import { Geo, type Look, v3 } from './geo';
import { CLS } from '../data/vmLook';
import { TALISMAN, TASSEL, TASSEL_DARK_EVERY } from '../data/cloth';

/** a capsule the cloth may not enter (the fist round the grip, the forearm, the guard): segment a → b, radius r */
export type Capsule = ClothCapsule;

/** how deep any point sits inside any capsule (m; 0 = clear) */
export const penetration: typeof clothPenetration = clothPenetration;

/** a static tube topology (rings of segs+1) written into a Geo, so the dynamic arrays share its layout */
function tubeTopology(g: Geo, rings: number, segs: number, look: Look, uvLen: number): void {
  const base = g.vertexCount;
  const z = v3(0, 0, 0), up = v3(0, 1, 0);
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

function tasselGeo(): BufferGeometry {
  const g = new Geo();
  const silk: Look = { cls: CLS.silk };
  const dark: Look = { cls: CLS.trim };
  tubeTopology(g, TASSEL.cordPts, TASSEL.cordSegs, dark, 0.03);
  for (let s = 0; s < TASSEL.strands; s++) tubeTopology(g, TASSEL.pts, TASSEL.strandSegs, s % TASSEL_DARK_EVERY === 0 ? dark : silk, TASSEL.len);
  return g.build();
}

function sheetGeo(): BufferGeometry {
  const { cols, rows } = TALISMAN;
  const g = new Geo();
  const paper: Look = { cls: CLS.paper };
  const z = v3(0, 0, 0), n = v3(0, 0, 1);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) g.vert(z, n, c / (cols - 1), 1 - r / (rows - 1), paper);
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const a = r * cols + c, b = a + 1, d = a + cols, e = d + 1;
      g.tri(a, d, b);
      g.tri(b, d, e);
    }
  }
  return g.build();
}

function cordGeo(): BufferGeometry {
  const cg = new Geo();
  tubeTopology(cg, TALISMAN.cordPts + 1, TALISMAN.cordSegs, { cls: CLS.trim }, 0.03);
  return cg.build();
}

/** the red silk tassel */
export class Tassel extends StrandTassel {
  constructor() { super(TASSEL, tasselGeo()); }
}

/** the yellow paper talisman */
export class Talisman extends ClothSheet {
  constructor() { super(TALISMAN, sheetGeo(), cordGeo()); }
}
