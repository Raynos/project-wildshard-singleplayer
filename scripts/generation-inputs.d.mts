import type {GenerationJob,GenerationOptions,GenerationResult} from './generation-cache.mjs';
/** Private successful producer read metadata; never a declared runtime output. */
export const generationReadReceipt: string;
/** Probe immutable observed keys, then run the full closure on a miss and
 * publish a narrower key only from a complete successful observation. */
export function runObservedGeneration(root:string,job:GenerationJob,options:GenerationOptions,entry:string):Promise<GenerationResult>;
