/** Repo-only pinned denominator; the public SDK receives only its numeric result. */
export function decisionLegacyLines(root: string, slug: string): number | undefined;
/** Shard-keyed build and ruler baselines, independent of the frozen folder inventory. */
export function shardLineBaselines(root: string): ReadonlyMap<string, {source: string; lines: number}>;
/** Pinned historical exclusions in the corresponding frozen inventory folders. */
export function legacyGeneratedPaths(root: string): ReadonlySet<string>;
