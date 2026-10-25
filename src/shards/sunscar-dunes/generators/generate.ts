import type { GeneratedProject, ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { signalProductRows } from './product';
import { signalFireBook } from './fireBookProgram';
import { signalSourceOutput } from './sourceOutput';
import { signalRigs } from './rigProgram';
import { signalModelSource } from './sceneSources';
import { signalRigBoot } from './rows/boot';

/** Build the original declaration and output together from their defining source functions. */
export async function generate(ctx: ProjectGenerationContext): Promise<GeneratedProject> {
  const fire = await signalFireBook(ctx), rigs = await signalRigs(ctx), boot = signalRigBoot();
  return { shard: signalProductRows(fire.file), output: signalSourceOutput(signalModelSource(rigs.library), rigs.blobs),
    discovery: { 'boot.files': boot.files, 'boot.sources': boot.sources } };
}
