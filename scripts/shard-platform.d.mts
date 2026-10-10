/** G291's primary measure; no frozen copy is explicitly unavailable, with legacy-share used instead. */
export interface ConversionMeasure {
  metric: 'runtime-vs-legacy' | 'legacy-share'; customRuntimeLines: number; shardRuntimeLines: number;
  legacyLines: number | null; legacyFolder: string | null; legacyRevision: string | null;
  runtimeShare: number | null; passed: boolean | null;
  /** G294: transitive primary users, deduplicated; frozen copies never supply users. Audit may revise classification. */
  gameSystemAttribution: { status: 'import-graph'; review: 'pending-opus-audit'; lines: number; modules: { path: string; lines: number }[] };
}
export interface ShardLines {
  publicLines: number; customLines: number; runtimeLines: number; trustedRuntimeLines: number; publicShare: number; legacyShare: number; conversion: ConversionMeasure;
  legacy: { generators: number; data: number; runtime: number };
}
export interface ShardPlatformList { baseline: Record<string, number>; enforced: Record<string, number> }
export interface MilestoneFlags { boot: boolean; headless: boolean; replay: boolean; ledger: boolean; gridReady: boolean; compatible: boolean; transitional: boolean }
export function codeLines(source: string, path?: string): number;
export function shardLines(root?: string): Record<string, ShardLines>;
export function milestoneFlags(slug: string, row: ShardLines, root?: string): MilestoneFlags;
export function checkShares(recorded: ShardPlatformList, lines: Record<string, ShardLines>): string[];
