import type { AdminBundle } from './types.mjs';

/** `platform` runs `node scripts/shard-platform.mjs --json` on exactly this revision and returns its parsed output. */
export interface CommittedTree {revision:string;paths:readonly string[];read:(path:string)=>Uint8Array;platform:()=>unknown}
export const PLAN:string;
/** The plan folder files that hold the plan's SF rows and G decisions (SHARD-PLATFORM G375). */
export const PLAN_PARTS:readonly string[];
export function digest(bytes:Uint8Array):string;
export function safeSourcePath(path:string):string;
export function stableJson(value:unknown):string;
export function collectAdminData(tree:CommittedTree):{bundle:AdminBundle;files:Map<string,Uint8Array>};
