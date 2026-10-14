import type { ComponentInventory } from './shard-components.mjs';

/** G291's primary measure; native shards have no frozen denominator. */
export interface ConversionMeasure {
  metric: 'runtime-vs-legacy' | 'native'; customRuntimeLines: number; shardRuntimeLines: number; rawGlslLines: number; additionalGlslLines: number;
  legacyLines: number | null; legacyFolder: string | null; legacyRevision: string | null;
  runtimeShare: number | null; passed: boolean | null;
  /**
   * G294/G312: transitive real primary users, deduplicated; templates and frozen copies never supply users. `modules` are
   * whole files one shard reaches; `exports` are top-level declarations (`exported: false` for a helper) that exactly one
   * shard reaches inside a file two or more shards reach.
   */
  gameSystemAttribution: { status: 'import-graph'; review: 'G294-primary-reach'; lines: number; modules: { path: string; lines: number }[];
    exports: { path: string; name: string; exported: boolean; lines: number }[]; pendingSecondUser?: PendingPlatformCharge[] };
}
export interface CustomSource {path:string;kind:'runtime-ts'|'additional-glsl'|'sole-module'|'sole-export';lines:number;name?:string}
export interface ShardLines {
  components?:ComponentInventory;
  customSources?:CustomSource[];
  runtimeLines: number; trustedRuntimeLines: number; assemblyScriptLines: number; conversion: ConversionMeasure;
}
export interface ShardPlatformList { baseline: Record<string, number>; enforced: Record<string, number> }
export interface MilestoneFlags { headless: boolean }
export function codeLines(source: string, path?: string): number;
export function shardLines(root?: string, includeSources?: boolean): Record<string, ShardLines>;
export function milestoneFlags(slug: string, row: ShardLines, root?: string): MilestoneFlags;
export function checkShares(recorded: ShardPlatformList, lines: Record<string, ShardLines>): string[];

/** Nonblank raw shader code lines, excluding comments and retaining quoted preprocessor paths. */
export function shaderCodeLines(source: string): number;
/** Raw GLSL in files or shader literals; declared graph nodes contribute zero. */
export function rawShaderLines(source: string, path: string, program?: unknown): number;

/** G390 headline, unavailable until the admitted product is present. */
export interface PortHeadline {customPercent:number|null;world:'yes'|'partial'|'no'|'unavailable';percent:number|null}
export function declarationOnlyConfig(source:string,path?:string):boolean;
export function portHeadline(customPercent:number|null,content:{status:string;tiles:{total:number}|null;privateBinaries:readonly string[]}):PortHeadline;
export function portAverage(rows:Record<string,{port:PortHeadline}>):number|null;

/** G419 allowance: reviewed again when W3 ends; this is not an actual user. */
export interface PendingPlatformUser {
  module:string; export?:string; shard:'driftwood-isle'|'pine-hollow'|'nalati-grasslands'|'nine-dragon-stack';
  plan:{path:string;row:string}; documentation:string; 'rechecked-by':'end of W3';
}
export interface PendingPlatformCharge {path:string;name?:string;lines:number;status:'pending second user';users:PendingPlatformUser[]}
export function pendingPlatformUsers(root:string):PendingPlatformUser[];
export function partitionPendingPlatformUsers(slug:string,modules:{path:string;lines:number}[],exports:{path:string;name:string;exported:boolean;lines:number}[],allowances:PendingPlatformUser[]):{
  modules:{path:string;lines:number}[];exports:{path:string;name:string;exported:boolean;lines:number}[];pending:PendingPlatformCharge[];
};
