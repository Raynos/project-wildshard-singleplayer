import { CONTENT_CAPS as C } from './contentBounds';

/** Shared resident-cost input: dependency-deduplicated category bytes, including persistent CPU and GPU data. */
export interface ContentCostInput {
  l0: number; l1: number; far: number; libraries: number; sims: number; commons: number;
  products?: number; near?: number;
  /** Actual concurrent decode headroom; zero when no overlap is present. */
  overlap: number;
  /** Calibrated base after any explicitly split renderer-component credit. */
  engineBase?: number;
  /** Actual grid page allocations only. Standalone callers omit this; no grid
   * program cache, road or continuation allowance is implicit in this model. */
  page?: number;
}
/** Estimated resident cost, calibrated against the Simulator template census.
 * Process/GPU measurements remain observations, distinct from this prediction. */
export function contentCost(input: ContentCostInput): { playing: number; loading: number; accounted: number } {
  const resident = input.l0 + input.l1 + input.far + input.libraries + input.sims + input.commons + (input.products ?? 0) + (input.near ?? 0);
  const page = input.page ?? 0, accounted = resident + page;
  const playing = (input.engineBase ?? C.engineBase) + page + Math.ceil(resident * C.residentFactor) + input.overlap;
  return { playing, loading: playing + input.overlap, accounted };
}
