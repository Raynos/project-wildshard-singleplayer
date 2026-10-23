import type { InputHashMemo } from './bake-input-hashes.mjs';
import type { GenerationJob, GenerationResult } from './generation-cache.mjs';
/** Run twice from the same staged input bytes, resetting seeds/incidental files. Refuse every output difference. */
export function verifyStagedGeneration(tree:string,job:{id:string;outputs:string[];seedOutputs?:string[]},run:()=>Promise<void>):Promise<void>;
/** Private fresh audit, independent of historical caches/pins. Never restores source outputs. */
export function runDeterminismAudit(root:string,job:GenerationJob,generate:(directory:string)=>Promise<void>,inputs:InputHashMemo):Promise<GenerationResult>;
