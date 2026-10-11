import type { GenerationRemovalPlan } from './generation-removals.mjs';
/** Check only newly deleted tracked catalogue outputs, using the private/pathspec index and a fresh cold product proof. */
export function precommitGenerationRemovals(root?:string):Promise<GenerationRemovalPlan|null>;
