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

/** G762: an advisory projection needs an independently measured engine base.
 * Null leaves the total unknown; the admission model's historical fixed base
 * cannot stand in for a measurement. Components remain visible in bytes. */
export interface ContentEstimate {
  readonly engine: number | null;
  readonly components: Readonly<{ l0: number; l1: number; far: number; libraries: number; sims: number; commons: number; products: number; near: number; page: number }>;
  readonly resident: number;
  readonly allocatorHeadroom: number;
  readonly overlap: number;
  readonly playing: number | null;
  readonly loading: number | null;
}
/** Predict component costs without an accuracy pass/fail or a native-budget verdict.
 * The measured base must exclude the separately supplied content/page components.
 * Runtime admission retains its independent, conservative contentCost contract. */
export function contentEstimate(input: Omit<ContentCostInput, 'engineBase'>, measuredEngineBytes: number | null): ContentEstimate {
  if (measuredEngineBytes !== null && (!Number.isSafeInteger(measuredEngineBytes) || measuredEngineBytes < 0)) throw new RangeError('Invalid measured engine base');
  const components = { l0: input.l0, l1: input.l1, far: input.far, libraries: input.libraries, sims: input.sims, commons: input.commons,
    products: input.products ?? 0, near: input.near ?? 0, page: input.page ?? 0 };
  if (![...Object.values(components), input.overlap].every(bytes => Number.isSafeInteger(bytes) && bytes >= 0)) throw new RangeError('Invalid memory component bytes');
  const resident = components.l0 + components.l1 + components.far + components.libraries + components.sims + components.commons + components.products + components.near;
  const allocatorHeadroom = Math.ceil(resident * C.residentFactor) - resident;
  const playing = measuredEngineBytes === null ? null : measuredEngineBytes + resident + allocatorHeadroom + components.page + input.overlap;
  if (![resident, allocatorHeadroom, ...(playing === null ? [] : [playing, playing + input.overlap])].every(Number.isSafeInteger)) throw new RangeError('Memory estimate exceeds safe byte accounting');
  return { engine: measuredEngineBytes, components, resident, allocatorHeadroom, overlap: input.overlap,
    playing, loading: playing === null ? null : playing + input.overlap };
}
