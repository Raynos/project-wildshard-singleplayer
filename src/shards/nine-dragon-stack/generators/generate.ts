import type { GeneratedProject, ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { nineProduct } from './product';
import { NINE_MOVERS_CONTRACT } from './moversProgram';
import { nineSourceOutput } from './sourceOutput';
import type { NineOutput } from './productOutput';

/** Strong output shape shared by the CLI and direct function tests. */
export interface NineGeneratedProject extends GeneratedProject { readonly output: NineOutput }

/** The source invocation owns its executable, fresh entry evidence and native decal bytes. */
export async function generate(ctx: ProjectGenerationContext): Promise<NineGeneratedProject> {
  const output = await nineSourceOutput(ctx);
  return { shard: nineProduct({ pages: NINE_MOVERS_CONTRACT.pages }), output };
}
