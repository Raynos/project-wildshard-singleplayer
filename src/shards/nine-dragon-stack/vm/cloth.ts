// Real cloth sway for the jian's red silk tassel and yellow paper talisman (lab P8 "viewmodel", E169): rows on the SDK
// strand cloth (data/cloth.ts), stepped in the viewmodel scene's space (= view space: the vm camera sits at the origin),
// pinned to pivots that ride the sword. Their fixed topology is the SDK's (@wildshard/sdk/kit/clothTopology) in the
// viewmodel's geometry (~1.5 k vertices in all), drawn by the viewmodel program + its ink hull; the fu decal on both faces
// of the talisman.
import type { BufferGeometry } from 'three';
import { ClothSheet, type ClothCapsule, StrandTassel, clothPenetration } from '@wildshard/sdk/looks/strandCloth';
import { tubeTopology, sheetTopology } from '@wildshard/sdk/kit/clothTopology';
import { Geo, type Look } from './geo';
import { CLS } from '../data/vmLook';
import { TALISMAN, TASSEL, TASSEL_DARK_EVERY } from '../data/cloth';

/** a capsule the cloth may not enter (the fist round the grip, the forearm, the guard): segment a → b, radius r */
export type Capsule = ClothCapsule;

/** how deep any point sits inside any capsule (m; 0 = clear) */
export const penetration: typeof clothPenetration = clothPenetration;

function tasselGeo(): BufferGeometry {
  const g = new Geo();
  const silk: Look = { cls: CLS.silk };
  const dark: Look = { cls: CLS.trim };
  tubeTopology(g, TASSEL.cordPts, TASSEL.cordSegs, dark, 0.03);
  for (let s = 0; s < TASSEL.strands; s++) tubeTopology(g, TASSEL.pts, TASSEL.strandSegs, s % TASSEL_DARK_EVERY === 0 ? dark : silk, TASSEL.len);
  return g.build();
}

function sheetGeo(): BufferGeometry {
  const g = new Geo();
  sheetTopology(g, TALISMAN.cols, TALISMAN.rows, { cls: CLS.paper });
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
