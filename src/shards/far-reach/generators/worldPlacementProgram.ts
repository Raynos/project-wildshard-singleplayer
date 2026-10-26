import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { WORLD_PLACEMENT_FILES, WORLD_PLACEMENT_INPUTS, skyWorldPlacementSource } from './worldPlacementBytes';

/** Own all frame/placement metadata under explicit native input and complete program identities. */
export async function skyWorldPlacementProgram(ctx: Pick<ProjectGenerationContext, 'cached'>): Promise<ReadonlyMap<string, Uint8Array>> {
  const files = await ctx.cached({ id: 'world-placements', native: true, inputs: WORLD_PLACEMENT_INPUTS }, skyWorldPlacementSource);
  if (files.size !== WORLD_PLACEMENT_FILES.length || WORLD_PLACEMENT_FILES.some(name => (files.get(name)?.byteLength ?? 0) === 0)) {
    throw new Error('Sky world placement cache inventory differs');
  }
  return files;
}
