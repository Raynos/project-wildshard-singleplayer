import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import type { Shardfile } from '@wildshard/sdk/shardfile';
import { driftwoodProductRows } from './product';
import { driftwoodFixedProduct } from './fixedProduct';
import { driftwoodFixedFiles } from './fixedProgram';
import { driftwoodFixedLayouts } from './fixedLayouts';
import { driftwoodAudio } from './audio';

/** The declaration receives original fixed-world rows and bytes from its own source producer. */
export async function build(ctx: ProjectGenerationContext): Promise<Shardfile> {
  const layouts = driftwoodFixedLayouts(await driftwoodFixedFiles(ctx));
  return driftwoodProductRows(await driftwoodFixedProduct(ctx), driftwoodAudio(layouts.wreck));
}
