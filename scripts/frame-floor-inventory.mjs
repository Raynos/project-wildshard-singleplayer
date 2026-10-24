import { manifestFolders, shardProducts } from './shard-outputs.mjs';
import { legacyInventory } from './legacy-shards.mjs';

/** Every shipped discovery, including multi-output folders, plus the grid.
 * Frozen legacy copies stay outside the primary frame-floor inventory.
 * @param {string} root
 * @returns {string[]}
 */
export function frameFloorShards(root) {
  const frozen = legacyInventory(root);
  return [...shardProducts(root, manifestFolders(root))
    .filter(row => !Object.hasOwn(frozen.shards, row.slug))
    .map(row => row.slug), 'grid'];
}
