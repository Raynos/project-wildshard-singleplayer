/** Node-only product author entry. Browser entry never imports this module. */
// oxlint-disable-next-line import/no-nodejs-modules -- Node-only build entry reads pinned source metadata.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Node-only build entry resolves isolated product destinations.
import { resolve } from 'node:path';
import { validateOutputProduct } from '../../src/sdk/outputProduct';
import type { DecisionBuildOptions } from '../../src/sdk/buildDecisionScripts';
import { PROTOTYPE_PRODUCTS } from './products/catalogue';
import { buildPrototypeProduct } from './products/author';

export function validateRetainedProducts(paths: readonly string[]): string[] {
  return paths.map(path => validateOutputProduct(path).index.build.sourceHash);
}
export async function buildFiveProducts(root: string, temporary: string, options: DecisionBuildOptions): Promise<void> {
  for (const row of PROTOTYPE_PRODUCTS) {
    await buildPrototypeProduct(row.id, resolve(root, 'src/shards/driftwood-isle'), resolve(temporary, row.id, 'practice-product'), options, readFileSync(resolve(root, row.metadataPath)));
  }
}
