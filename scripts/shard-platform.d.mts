export interface ShardLines { generators: number; data: number; runtime: number }
export interface ShardPlatformList { baseline: Record<string, number>; enforced: Record<string, number> }
export function shardLines(root?: string): Record<string, ShardLines>;
export function checkShares(recorded: ShardPlatformList, lines: Record<string, ShardLines>): string[];
