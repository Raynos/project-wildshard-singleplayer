import type {InputHashMemo} from './bake-input-hashes.mjs';
/** Current bytes/inventories must match every sealed local-phase observation. */
export function verifiedSourceSnapshot(file:string,identity:string,memo:InputHashMemo,outputs:string[]):boolean;
/** Verify the completed phase before atomically publishing local evidence. */
export function publishSourceSnapshot(file:string,identity:string,memo:InputHashMemo,outputs:Record<string,string>):void;
/** Exact controller/runtime/tool and recipe identity. */
export function sourceSnapshotIdentity(value:unknown):string;

export function beginProgramInputProof(root:string,products:readonly string[]):()=>void;
/** Exact root-matched mirror inventory or normal checkout HEAD; crossed/invalid evidence refuses. */
export function committedSourceFiles(root:string,env?:Readonly<Record<string,string|undefined>>):string[];
