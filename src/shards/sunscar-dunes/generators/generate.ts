import type { GeneratedProject, ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { signalProductRows } from './product';
import { signalFireBook } from './fireBookProgram';
import { output } from './sourceOutput';

/** Build the original declaration and output together from their defining source functions. */
export async function generate(ctx: ProjectGenerationContext): Promise<GeneratedProject> {
  return { shard: signalProductRows((await signalFireBook(ctx)).file), output };
}
