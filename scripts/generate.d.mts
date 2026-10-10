import type { GenerationResult } from './generation-cache.mjs';
/** Explicit producer and conservative repository input closure; null shard means shared root tooling. */
export interface ShardGenerationJob { id:string; shard:string|null; entry:string; command:string[]; inputRoots:string[]; outputs:string[]; platform:'portable'|'native'|'darwin';buildOutputs?:Record<string,string>;seedOutputs?:string[];capture?:boolean;browser?:boolean;preview?:boolean;recordedInputs?:boolean;externalInputs?:{path:string;url:string;sha256:string}[];toolCommands?:string[][] }
/** Per-output comparison observed before a strict refusal; missing committed evidence is null, never a match. */
export interface GenerationComparison {readonly file:string;readonly expectedHash:string|null;readonly generatedHash:string;readonly rawExact:boolean|null;readonly equivalent:boolean|null;readonly comparison:'raw'|'capture-provenance'|'recorded-inputs'}
/** Hash a bounded source tree, excluding dependency folders; reject symlinks. */
export function generationInputs(root:string,roots:string[]):Record<string,string>;
/** Walk shard generators and expose every unregistered bake entry point. */
export function discoverGeneration(root:string,catalogPath?:string):{schema:string;jobs:ShardGenerationJob[];unregistered:string[]};
/** Generate in an isolated root, compare every committed byte, optionally restore only absent outputs. */
export function generateShardJob(root:string,job:ShardGenerationJob,options?:{cacheDir?:string;forceCompare?:boolean;restore?:boolean;restoreOutputs?:string[];catalogPath?:string;preview?:{url:string;revision:string};onComparison?:(rows:readonly GenerationComparison[])=>void}):Promise<GenerationResult>;
/** Report-only CI/Vercel phase, leaving committed outputs intact pending platform proof. */
export function reportGeneration(root:string):ReturnType<typeof discoverGeneration> & {missing:string[]};
/** Generate only admitted build outputs, verifying pinned hashes before restoring missing files. */
export function prepareGeneration(root:string,options?:{cacheDir?:string}):Promise<ReturnType<typeof reportGeneration>>;
