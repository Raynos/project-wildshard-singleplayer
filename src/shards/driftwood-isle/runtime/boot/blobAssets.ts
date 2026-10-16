import { resourceScope } from '@wildshard/engine/app/resources';
import type { Scope } from '@wildshard/engine/app/scope';
import type { ShardProduct } from '@wildshard/game/shardfile/shardProduct';
import { SECTIONS } from '../sections';

/** Legacy labels identify existing authored parts; only the product decides their named bytes and URLs. */
export function driftwoodBlobName(product: ShardProduct, label: string): string {
  const name = product.section('custom/assets', SECTIONS).byUrl[label];
  if (name === undefined || !product.hasFile(name)) throw new Error(`Driftwood product is missing its named asset: ${label}`);
  return name;
}

/** Renderer services stay behind the explicit page/Explorer load, outside offline geometry authoring. */
export async function loadDriftwoodProduct(owner: Scope = resourceScope()): Promise<ShardProduct> {
  const { loadFirstPartyProduct } = await import('@wildshard/game/shardfile/runtimeProduct');
  return loadFirstPartyProduct('driftwood-isle', owner);
}

/** Both world owners and cold Explorer cards read the same verified immutable product content. */
export async function readDriftwoodBlob(label: string, admitted?: ShardProduct): Promise<Uint8Array> {
  const product = admitted ?? await loadDriftwoodProduct();
  return product.file(driftwoodBlobName(product, label));
}
