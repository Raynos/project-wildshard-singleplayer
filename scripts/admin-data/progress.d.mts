import type { EffortFinish, EffortShard, EffortTotal, ShareReport } from './types.mjs';

export const SHARE_COMMAND: string;
export const SHARE_TARGET: number;
export const RECOUNT_PREFIX: string;
export function readSharePlatform(value:unknown):ShareReport;
export function newestRecount(paths:readonly string[]):string;
export function parseRecountReadme(markdown:string,path:string):{confidence:string;shards:EffortShard[];totals:EffortTotal[]};
export function readRecountJson(value:unknown,path:string):{asOf:string;confidence:string;shards:EffortShard[];totals:EffortTotal[];finish:EffortFinish[]};
