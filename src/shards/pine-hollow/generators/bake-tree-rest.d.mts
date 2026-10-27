/** The pool's product file name (src/shards/pine-hollow/generators/bake-tree-rest.mjs). */
export const TREE_REST_FILE: 'models/trees/rest.glb';
/** The tree set's geometry rows: the pool's product name, its parts and its custom channels. */
export function pineTreeRestRows(): { geometry: 'models/trees/rest.glb'; parts: string[];
  channels: ({ name: string; source: string; width: number; parts?: string[] })[] };
/** The pool's GLB, baked once per process. */
export function pineTreeRest(): Promise<Uint8Array>;
