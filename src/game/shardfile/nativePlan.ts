import { parseNativeRuntimePlan } from '@wildshard/format/nativeRuntimePlan';
import { prepareRuntimePlan, type NativeRuntimeRecipe } from '../plugin/simulation';
import type { ShardProduct } from './shardProduct';
import { outputDescriptor } from './outputDescriptor';

/** Select the existing native interpreter from the built product. No source
 * entry, module URL, shard callback or fallback participates in this boundary. */
export async function prepareProductRuntimePlan(product: ShardProduct, assets: ReadonlyMap<string, Uint8Array>): ReturnType<typeof prepareRuntimePlan> {
  const descriptor = outputDescriptor(product.shardfile);
  if (descriptor === undefined) throw new Error('Native plan requires a verified built output');
  const declaration = parseNativeRuntimePlan(product.section('sim/runtime-plan'));
  const recipe: NativeRuntimeRecipe = declaration.recipe;
  const admitted = new Map(assets);
  for (const file of descriptor.index.files) {
    const ref = file.commons === true ? `commons:${file.hash}` : file.hash;
    if (admitted.has(ref)) continue;
    if (file.name === undefined) throw new Error('Missing unnamed native plan asset');
    admitted.set(ref, await product.file(file.name));
  }
  return prepareRuntimePlan(product.shardfile, admitted, declaration.baked, recipe, descriptor.sections);
}
