import type {InputHashMemo} from './bake-input-hashes.mjs';
/** Current bytes/inventories must match every sealed local-phase observation. */
export function verifiedGenerationSnapshot(file:string,identity:string,memo:InputHashMemo,outputs:string[]):boolean;
/** Verify the completed phase before atomically publishing local evidence. */
export function publishGenerationSnapshot(file:string,identity:string,memo:InputHashMemo,outputs:Record<string,string>):void;
/** Exact controller/runtime/tool and recipe identity. */
export function generationSnapshotIdentity(value:unknown):string;
