// GR8 G32: the forest trees' rest geometry pool, baked in memory from the Blender species set
// (public/assets/models/pine-hollow-trees/trees.glb) and published as the product's critical models/trees/rest.glb
// (sourceOutput.ts), instead of the retired pine-tree-rest job's hashed public/assets/pine-hollow/baked/trees-<sha>.glb.
// D65: the set is read from the program's sources (pineSources.ts), never from the file system.
import declared from '../data/publicInputs.json' with { type: 'json' };
import { bakeTreeRest } from './treeRest.ts';
import { perSources, sourceJson } from './pineSources.ts';

/** The pool's GLB, baked once per sources (about 0.3 s). */
export const pineTreeRest = perSources(sources => bakeTreeRest(sources.bytes(declared.trees.glb), sourceJson(sources, declared.trees.sidecar).variants));
