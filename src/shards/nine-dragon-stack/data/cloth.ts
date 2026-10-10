// Nine Dragon's living cloth as data (SHARD-PLATFORM M3): the jian's red silk tassel and yellow paper talisman as rows on
// the SDK strand cloth (@wildshard/sdk/looks/strandCloth). vm/cloth.ts builds their topology in the viewmodel's
// geometry; vm/fpArms.ts steps them against the fist, the forearm and the guard.
import type { ClothSheetRow, StrandTasselRow } from '@wildshard/sdk/looks/strandCloth';

/** the red silk tassel: bushy and long, prominent in front of the grip (round-6 style A, target-1) */
export const TASSEL = {
  strands: 24, pts: 9, len: 0.17, cordPts: 4, cordLen: 0.034, capR: 0.0135, strandR: 0.0036, cap: 0.024,
  cordSegs: 6, strandSegs: 5, cordRadius: 0.0032, strandTaper: [1.15, 0.5, 0.85, 0.3],
  substeps: 4, cordDamp: 0.985, strandDamp: 0.975, cordIters: 3, strandIters: 2,
  bundle: 220, bundleFall: 0.9, bundleWiden: 0.16, restDrop: 0.014, restWiden: 0.12, bend: 0.12, cordPad: 0.003,
  spread: [0.17, 0.55, 0.45, 3.3],
  // a slow noise push across the view
  breezeX: [0.9, 0.37, 0, 0, 3.2],
  breezeZ: [1.3, 0.61, 0, 9, 2.4],
  attributes: { normals: ['normal', 'aNs'], hull: 'aHullN' },
} as const satisfies StrandTasselRow;

/** every third strand is the dark trim silk */
export const TASSEL_DARK_EVERY = 3;

/** the paper talisman: a 4 × 10 point sheet on a short cord; paper is stiff (bend constraints across two cells) */
export const TALISMAN = {
  cols: 4, rows: 10, w: 0.058, h: 0.165, cordPts: 3, cordLen: 0.03, cordSegs: 5, cordRadius: 0.0014,
  substeps: 4, cordDamp: 0.98, sheetDamp: 0.965, cordIters: 2, iters: 3,
  shear: 0.6, bendRows: 0.5, bendCols: 0.7, pad: 0.004,
  // the breeze ruffles the lower rows more
  flutterPow: 1.2,
  flutter: [2.3, 0.7, 0.31, 0, 9],
  sway: [1.1, 0.2, 0, 0, 3],
  attributes: { normals: ['normal', 'aNs'], hull: 'aHullN' },
} as const satisfies ClothSheetRow;
