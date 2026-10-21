/** Six processes at most; a hard failure aborts owned children and drains active tasks. */
export function runShardBuildPool<T>(items: readonly T[], work: (item: T, signal: AbortSignal) => Promise<void>): Promise<void>;
/** Run one CLI product build with the parent's environment and lease. */
export function runShardBuild(args: string[], signal: AbortSignal): Promise<void>;
