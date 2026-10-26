import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { nalatiProductRows } from './product';
import { prepareSpecies } from './output';

/** Partial source construction retains the scheduler until the last producer retires. */
export async function build(ctx: ProjectGenerationContext): Promise<ReturnType<typeof nalatiProductRows>> {
  const species = await prepareSpecies(ctx);
  return nalatiProductRows(species.rows);
}
