import type { NineNavigation } from './navigationProgram';
import type { GeneratedProject, ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { readNineProductInputs } from './product';
import { nineProductFrom } from './productDefinition';
import { NINE_MOVERS_CONTRACT } from './moversProgram';
import { nineSourceOutput } from './sourceOutput';
import type { NineOutput } from './productOutput';
import { nineBootProgram } from './bootDiscovery';

/** Strong output shape shared by the CLI and direct function tests. */
export interface NineGeneratedProject extends GeneratedProject { readonly output: NineOutput; readonly discovery: { readonly navigation: NineNavigation } & ReturnType<typeof nineBootProgram> }

/** The source invocation owns its executable, fresh entry evidence and native decal bytes. */
export async function generate(ctx: ProjectGenerationContext): Promise<NineGeneratedProject> {
  const boot = nineBootProgram(ctx);
  const inputs = await readNineProductInputs(ctx);
  const shard = nineProductFrom(inputs, { pages: NINE_MOVERS_CONTRACT.pages });
  const output = await nineSourceOutput(ctx, { casts: inputs.casts, signs: inputs.signs, held: inputs.held, ownedWorld: inputs.ownedWorld, scenes: inputs.scenes, construction: { seed: shard.identity.seed, looks: Object.keys(shard.look.materials) } });
  return { shard, output, discovery: { navigation: inputs.navigation, ...boot } };
}
