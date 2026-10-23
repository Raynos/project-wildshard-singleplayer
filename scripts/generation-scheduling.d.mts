/** Default cores minus four, clamped to one through four. */
export function defaultGenerationConcurrency(cores?: number): number;
/** Explicit --parallel=N (or legacy --parallel=4) overrides the default. */
export function generationConcurrency(args?: readonly string[], cores?: number): number;
/** Cost-ranked original indices; callers retain their original conflict edges. */
export function generationOrder(ids: readonly string[], costs?: Readonly<Record<string, number>>): number[];
