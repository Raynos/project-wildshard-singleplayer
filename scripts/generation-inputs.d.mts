import type {GenerationJob,GenerationOptions,GenerationResult} from './generation-cache.d.mts';
/** Private successful producer read metadata; never a declared runtime output. */
export const generationReadReceipt: string;
/** Probe immutable observed keys, then run the full closure on a miss and
 * publish a narrower key only from a complete successful observation. Unread
 * catalogue bytes may leave the key. Probes bind the verified initial stage view;
 * unmodeled probes retain the complete file inventory. Dependency presence
 * probes may omit unread upstream payload bytes only with that staged inventory;
 * package manifests, unknown byte reads and CommonJS remain exact. Missing
 * staged metadata retains every upstream hash.
 * Immutable upstream bytes bind observed file/module reads, while the
 * observation recipe excludes their content values. */
export function runObservedGeneration(root:string,job:GenerationJob,options:GenerationOptions,entry:string,catalogue?:string,staged?:readonly string[]):Promise<GenerationResult>;
