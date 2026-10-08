import type { AdminBundle } from './types.mjs';

export interface CommittedTree {revision:string;paths:readonly string[];read:(path:string)=>Uint8Array}
export function digest(bytes:Uint8Array):string;
export function safeSourcePath(path:string):string;
export function stableJson(value:unknown):string;
export function collectAdminData(tree:CommittedTree):{bundle:AdminBundle;files:Map<string,Uint8Array>};
