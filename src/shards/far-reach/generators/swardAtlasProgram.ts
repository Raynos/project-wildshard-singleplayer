import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { bakeSwardAtlasTexture } from './swardAtlas';

/** Cache the complete original numerical atlas under its author program and native lossless codec. */
export async function skySwardAtlasProgram(ctx: Pick<ProjectGenerationContext, 'cached'>): Promise<Uint8Array> {
  const files = await ctx.cached({ id: 'sward-atlas', native: true, inputs: [] }, async inputs => {
    if (inputs.size > 0) throw new Error('Sky sward atlas input inventory differs');
    return new Map([['sward.ktx2', await bakeSwardAtlasTexture()]]);
  });
  const bytes = files.get('sward.ktx2');
  if (files.size !== 1 || bytes === undefined || bytes.byteLength === 0) throw new Error('Sky sward atlas cache inventory differs');
  return bytes;
}
