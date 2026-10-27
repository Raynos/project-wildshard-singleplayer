// GR8 G32: the forest trees' rest geometry pool, baked in memory from the Blender species set
// (public/assets/models/pine-hollow-trees/trees.glb) and published as the product's critical models/trees/rest.glb
// (sourceOutput.ts), instead of the retired pine-tree-rest job's hashed public/assets/pine-hollow/baked/trees-<sha>.glb.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { bakeTreeRest } from './treeRest.ts';

const root = resolve(import.meta.dirname, '../../../..'), source = resolve(root, 'public/assets/models/pine-hollow-trees');
const variants = () => JSON.parse(readFileSync(resolve(source, 'trees.json'), 'utf8')).variants;

/** The pool's product file name. */
export const TREE_REST_FILE = 'models/trees/rest.glb';

/** The tree set's geometry rows: the pool's product name, its parts and its custom channels. */
export function pineTreeRestRows() {
  const rows = variants();
  const parts = rows.flatMap(row => ['trunk', 'trunkLo', 'hi', 'lo', 'twigs', 'far'].map(part => `${row.name}__${part}`));
  const bark = rows.flatMap(row => ['trunk', 'trunkLo'].map(part => `${row.name}__${part}`));
  return { geometry: TREE_REST_FILE, parts,
    channels: [{ name: 'aWindWeight', source: '_wind_weight', width: 1 }, { name: 'aBarkLayer', source: '_bark_layer', width: 1, parts: bark }] };
}

let bytes;
/** The pool's GLB, baked once per process (about 0.3 s). */
export function pineTreeRest() {
  bytes ??= bakeTreeRest(new Uint8Array(readFileSync(resolve(source, 'trees.glb'))), variants());
  return bytes;
}
