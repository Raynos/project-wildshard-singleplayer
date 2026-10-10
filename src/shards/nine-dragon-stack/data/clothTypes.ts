// Nine Dragon authoring row shapes; these declarations have no runtime dependency.
/** Nine Dragon’s authored ClothBreeze row shape. */
export type ClothBreeze = readonly [time: number, index: number, second: number, offset: number, amp: number];
/** Nine Dragon’s authored ClothAttributes row shape. */
export interface ClothAttributes { readonly normals: readonly string[]; readonly hull: string }
/** Nine Dragon’s authored StrandTasselRow row shape. */
export interface StrandTasselRow {
  readonly strands: number;
  readonly pts: number;
  readonly len: number;
  readonly cordPts: number;
  readonly cordLen: number;
  /** the cap's radius: the strands' roots ring it */
  readonly capR: number;
  readonly strandR: number;
  /** the cap's length along the chain (the strands start below it) */
  readonly cap: number;
  readonly cordSegs: number;
  readonly strandSegs: number;
  readonly cordRadius: number;
  /** a strand's radius: strandR · (a − b · u) · (c + d · hash(strand)) */
  readonly strandTaper: readonly [number, number, number, number];
  readonly substeps: number;
  readonly cordDamp: number;
  readonly strandDamp: number;
  readonly cordIters: number;
  readonly strandIters: number;
  /** the bundle spring: bundle / (1 + i · bundleFall) toward a rest line widening by bundleWiden a point */
  readonly bundle: number;
  readonly bundleFall: number;
  readonly bundleWiden: number;
  /** the hanging start: the strands begin restDrop under the cord's end, widening restWiden a point */
  readonly restDrop: number;
  readonly restWiden: number;
  /** the two-apart bend constraint's stiffness */
  readonly bend: number;
  readonly cordPad: number;
  /** the root spread: angle = s / strands · 2π + (s mod 2) · twist, radius = min + vary · hash(s + seed) */
  readonly spread: readonly [twist: number, min: number, vary: number, seed: number];
  readonly breezeX: ClothBreeze;
  readonly breezeZ: ClothBreeze;
  readonly attributes: ClothAttributes;
}
/** Nine Dragon’s authored ClothSheetRow row shape. */
export interface ClothSheetRow {
  readonly cols: number;
  readonly rows: number;
  readonly w: number;
  readonly h: number;
  readonly cordPts: number;
  readonly cordLen: number;
  readonly cordSegs: number;
  readonly cordRadius: number;
  readonly substeps: number;
  readonly cordDamp: number;
  readonly sheetDamp: number;
  readonly cordIters: number;
  readonly iters: number;
  /** shear and bend stiffness: the diagonals, two rows apart, two columns apart */
  readonly shear: number;
  readonly bendRows: number;
  readonly bendCols: number;
  readonly pad: number;
  /** how the breeze grows down the sheet: (row / (rows − 1)) ** flutterPow */
  readonly flutterPow: number;
  /** the push along the item's facing (index = column, second = row) and across x (index = row) */
  readonly flutter: ClothBreeze;
  readonly sway: ClothBreeze;
  readonly attributes: ClothAttributes;
}
