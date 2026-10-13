import type {GenerationRemovalPlan} from './generation-removals.mjs';
import type {GenerationResult} from './generation-cache.mjs';
/** Cache successful cold products keyed by the immutable source census; verify artifacts and current deletion admission on every hit. */
export function proveGenerationRemoval(root:string,source:string,tree:string,plan:GenerationRemovalPlan,cacheDir:string,expected:Record<string,string|null>):Promise<GenerationResult>;
