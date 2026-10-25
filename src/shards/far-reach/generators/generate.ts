import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { skyProductRows } from './product';
import { prepareOutput } from './sourceOutput';
import { skyProductBoot } from './bootInventory';

/** Publish declaration, native output and discovery from one source invocation. */
export async function generate(ctx: ProjectGenerationContext): Promise<{
  readonly shard: ReturnType<typeof skyProductRows>;
  readonly output: Awaited<ReturnType<typeof prepareOutput>>;
  readonly discovery: ReturnType<typeof skyProductBoot>;
}> {
  const output = await prepareOutput(ctx);
  const geometry = output.namedFiles.find(file => file.name === 'world/geometry/prepared-models.glb');
  if (geometry === undefined) throw new Error('Missing owned prepared geometry for boot');
  return { shard: skyProductRows(), output, discovery: skyProductBoot(`/shardfiles/far-reach/${geometry.path}`) };
}
