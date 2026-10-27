import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { parseShardfile, type Shardfile } from '@wildshard/sdk/shardfile';
import product from './product';
import { canoeMovers } from './canoe';

/** GR8 (G19): Pine's source program. It computes the rows the declaration reads from committed inputs through `ctx`
 *  (today the canoe mover, from the retained terrain) and admits the declaration with them; the output stays with
 *  the `output.ts` sidecar and its `prepareOutput`. */
export async function generate(ctx: ProjectGenerationContext): Promise<Shardfile> {
  return parseShardfile({ ...product, movers: await canoeMovers(ctx) });
}
