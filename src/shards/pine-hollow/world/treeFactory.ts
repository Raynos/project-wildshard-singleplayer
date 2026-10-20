import type { LookReplaceContext } from '@wildshard/engine/render/look';
import type { TreeFactory } from '@wildshard/engine/world/TreeFactory';
import { productTreeSet, TreeSetFactory } from '@wildshard/game/models/treeSet';

/** The manifest's tree binding: Pine Hollow's Blender species set (PH-B4) on its tree set rows (generators/treeSet.ts). */
export async function pineFactory(renderer: LookReplaceContext['renderer']): Promise<TreeFactory> {
  return new TreeSetFactory(renderer, await productTreeSet('pine-hollow', 'world/tree-set.json')).build();
}
