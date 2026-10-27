import type { GeneratedProject, ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { parseShardfile } from '@wildshard/sdk/shardfile';
import { pineProduct } from './product';
import { pineJournal } from './journal';
import { pineGroundTiles } from './groundTileInputs';
import { canoeMovers } from './canoe';
import { prepareOutput } from './sourceOutput';
import { PINE_MODES } from './zipline';
import { pineGeographyRows } from './geographyRows';

/** GR8 (G19, G30): Pine's source program. It computes the rows the declaration reads from committed inputs through
 *  `ctx` (the journal from its art, the canoe mover from the retained terrain), admits the declaration with them and
 *  the mode rows, and prepares the output (`sourceOutput.ts`) in the same program: there is no output sidecar. */
export async function generate(ctx: ProjectGenerationContext): Promise<GeneratedProject> {
  const ground = await pineGroundTiles(ctx);
  for (const bytes of ground.assets) ctx.asset(bytes);
  const shard = parseShardfile({ ...pineProduct(await pineJournal(ctx), ground.rows), movers: await canoeMovers(ctx), modes: PINE_MODES });
  // G33b: the declared ground, forest-query and pond-clip rows the manifest binds as program discovery
  const geography = pineGeographyRows();
  return { shard, output: await prepareOutput(ctx),
    discovery: { 'ground.rows': geography.ground, 'forestQueries.rows': geography.forestQueries, 'pondClip.rows': geography.pondClip } };
}
