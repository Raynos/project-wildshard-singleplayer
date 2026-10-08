import { CONTENT_CAPS as C } from './config';

/** Shared resident-cost input: dependency-deduplicated category bytes, including persistent CPU and GPU data. */
export interface ContentCostInput { l0: number; l1: number; far: number; libraries: number; sims: number; commons: number; products?: number; overlap: number; engineBase?: number; page?: number }
/** Simulator-measured v1 model, used by validation and the future residency allocator. */
export function contentCost(input: ContentCostInput): { playing: number; loading: number; accounted: number } {
  const accounted = input.l0 + input.l1 + input.far + input.libraries + input.sims + input.commons + (input.products ?? 0) + (input.page ?? 0);
  const playing = (input.engineBase ?? C.engineBase) + (input.page ?? 0) + Math.ceil((accounted - (input.page ?? 0)) * C.residentFactor) + input.overlap;
  return { playing, loading: playing + input.overlap, accounted };
}
