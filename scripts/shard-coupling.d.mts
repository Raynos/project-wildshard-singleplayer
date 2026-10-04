export interface ShardCoupling { counts: Record<string, number>; sites: Record<string, string[]> }
export function shardCoupling(root?: string): Record<string, ShardCoupling>;
export function compareCoupling(baseline: Record<string, ShardCoupling>, candidate: Record<string, ShardCoupling>): string[];
