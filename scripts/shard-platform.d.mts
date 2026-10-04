export interface ShardLines {
  publicLines: number; customLines: number; runtimeLines: number; uniqueKitLines: number; publicShare: number;
  legacy: { generators: number; data: number; runtime: number };
}
export interface ShardPlatformList { baseline: Record<string, number>; enforced: Record<string, number> }
export interface MilestoneFlags { boot: boolean; headless: boolean; replay: boolean; ledger: boolean; gridReady: boolean; compatible: boolean; transitional: boolean }
export function codeLines(source: string, path?: string): number;
export function shardLines(root?: string): Record<string, ShardLines>;
export function milestoneFlags(slug: string, row: ShardLines, root?: string): MilestoneFlags;
export function checkShares(recorded: ShardPlatformList, lines: Record<string, ShardLines>): string[];
