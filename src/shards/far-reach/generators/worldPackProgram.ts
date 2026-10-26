import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { encodeBuildBytes } from '@wildshard/sdk/bake/byteCodec';
import { WORLD_PACK_FILES, WORLD_PACK_INPUTS, skyWorldPackSource } from './worldPackBytes';

/** Own native compressed geometry and its metadata without publishing intermediate files. */
export async function skyWorldPackProgram(ctx: Pick<ProjectGenerationContext, 'cached'>): Promise<ReadonlyMap<string, Uint8Array>> {
  const files = await ctx.cached({ id: 'world-packs', native: true, inputs: WORLD_PACK_INPUTS }, inputs =>
    skyWorldPackSource(inputs, bytes => encodeBuildBytes(bytes, 'deflate', 9, 'native')));
  if (files.size !== WORLD_PACK_FILES.length || WORLD_PACK_FILES.some(name => (files.get(name)?.byteLength ?? 0) === 0)) {
    throw new Error('Sky world pack cache inventory differs');
  }
  return files;
}
