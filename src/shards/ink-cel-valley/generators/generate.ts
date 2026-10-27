import type { GeneratedProject, ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import product from './product';
import { inkMap } from './mapProgram';

/** GR9 (G783): the ink valley's declaration and its map, built together; no catalogue job writes either. */
export async function generate(ctx: ProjectGenerationContext): Promise<GeneratedProject> {
  return { shard: product, output: {}, map: { pixels: await inkMap(ctx) } };
}
