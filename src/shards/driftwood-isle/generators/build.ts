import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import type { Shardfile } from '@wildshard/sdk/shardfile';
import { driftwoodProductRows } from './product';
import { driftwoodFixedProduct } from './fixedProduct';

/** The declaration receives original fixed-world rows and bytes from its own source producer. */
export async function build(ctx: ProjectGenerationContext): Promise<Shardfile> {
  return driftwoodProductRows(await driftwoodFixedProduct(ctx));
}
