import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { assertSkyWorldTileFiles, skyWorldTileSource } from './worldTileBytes';

/** Cache procedural island tiles under the complete author-program identity, with no file inputs. */
export async function skyWorldTileProgram(ctx: Pick<ProjectGenerationContext, 'cached'>): Promise<ReadonlyMap<string, Uint8Array>> {
  const files = await ctx.cached({ id: 'world-tiles', native: true, inputs: [] }, skyWorldTileSource);
  assertSkyWorldTileFiles(files);
  return files;
}
