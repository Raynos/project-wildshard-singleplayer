import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { encodeBuildBytes } from '@wildshard/sdk/bake/byteCodec';
import { bakeSignalSandSources } from './sandSources';
import { SAND_ZSTD_LEVEL } from './sand';

const documents = ['sand/skirt.bin', 'sandMaps.json', 'sand.json', 'skirt.json'];
const texture = /^assets\/[a-f0-9]{64}$/u;

/** Cache the original procedural maps and skirt; no published output seeds the bake. */
export async function signalSandFiles(ctx: Pick<ProjectGenerationContext, 'cached'>): Promise<ReadonlyMap<string, Uint8Array>> {
  const files = await ctx.cached({ id: 'sand-maps', native: true }, inputs => {
    if (inputs.size > 0) throw new Error('Unexpected sand bake input');
    return bakeSignalSandSources(bytes => encodeBuildBytes(bytes, 'deflate'),
      bytes => encodeBuildBytes(bytes, 'zstd', SAND_ZSTD_LEVEL));
  });
  if (files.size !== 7 || documents.some(name => (files.get(name)?.length ?? 0) === 0)
    || [...files].filter(([name, bytes]) => texture.test(name) && bytes.length > 0).length !== 3) {
    throw new Error('Sand cache inventory differs');
  }
  return files;
}
