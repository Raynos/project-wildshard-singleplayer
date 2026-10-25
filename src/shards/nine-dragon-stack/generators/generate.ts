import type { NineNavigation } from './navigationProgram';
import type { GeneratedProject, ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { readNineProductInputs } from './product';
import { nineProductFrom } from './productDefinition';
import { NINE_MOVERS_CONTRACT } from './moversProgram';
import { nineSourceOutput } from './sourceOutput';
import type { NineOutput } from './productOutput';

/** Strong output shape shared by the CLI and direct function tests. */
export interface NineGeneratedProject extends GeneratedProject { readonly output: NineOutput; readonly discovery: { readonly navigation: NineNavigation } }

/** The source invocation owns its executable, fresh entry evidence and native decal bytes. */
export async function generate(ctx: ProjectGenerationContext): Promise<NineGeneratedProject> {
  const inputs = await readNineProductInputs(ctx);
  const shard = nineProductFrom(inputs, { pages: NINE_MOVERS_CONTRACT.pages });
  const output = await nineSourceOutput(ctx, { held: inputs.held, construction: { seed: shard.identity.seed, looks: Object.keys(shard.look.materials) } });
  return { shard, output, discovery: { navigation: inputs.navigation } };
}
