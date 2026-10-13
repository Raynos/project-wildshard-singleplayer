/** Borrowed double-precision rows for exact append between author and runtime writers. */
export interface TangentRows {
  readonly n: number;
  readonly pos: readonly number[];
  readonly nor: readonly number[];
  readonly col: readonly number[];
  readonly face: readonly number[];
  readonly tan: readonly number[];
  readonly pat: readonly number[];
  readonly misc: readonly number[];
  readonly idx: readonly number[];
}

/** Only synchronous readers may borrow these arrays; release invalidates their source. */
export interface TangentSource { geometryRows: () => TangentRows }
