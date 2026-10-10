import type { GenerationResult } from './generation-cache.mjs';
/** Explicit shard-owned command and conservative declared repository input closure. */
export interface ShardGenerationJob { id:string; shard:string; entry:string; command:string[]; inputRoots:string[]; outputs:string[]; platform:'portable'|'native'|'darwin' }
/** Hash a bounded source tree, excluding dependency folders; reject symlinks. */
export function generationInputs(root:string,roots:string[]):Record<string,string>;
/** Walk shard generators and expose every unregistered bake entry point. */
export function discoverGeneration(root:string,catalogPath?:string):{schema:string;jobs:ShardGenerationJob[];unregistered:string[]};
/** Generate in an isolated root, compare every committed byte, optionally restore only absent outputs. */
export function generateShardJob(root:string,job:ShardGenerationJob,options?:{cacheDir?:string;forceCompare?:boolean;restore?:boolean;catalogPath?:string}):Promise<GenerationResult>;
/** Report-only CI/Vercel phase, leaving committed outputs intact pending platform proof. */
export function reportGeneration(root:string):ReturnType<typeof discoverGeneration> & {missing:string[]};
