import type { PineSources } from './pineSources';
/** The pool's GLB, baked once per sources (src/shards/pine-hollow/generators/bake-tree-rest.mjs). */
export function pineTreeRest(sources: PineSources): Promise<Uint8Array>;
