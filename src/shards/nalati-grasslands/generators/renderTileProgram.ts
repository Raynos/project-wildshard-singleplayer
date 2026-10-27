import { hashImmutableBytes } from '@wildshard/sdk/immutable';
import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { nalatiRenderTileSources } from './renderTileSources';

const terrain = '/assets/baked/nalati-grasslands/terrain.bin';
const header = 'data/renderTiles.json';
const pairs = [0, 1, 2, 3].flatMap(z => [0, 1].map(x =>
  `assets/world-terrain/ground-l1-${x}-${z}.generated.glb`));

/** Own the original render publication through the build cache. The bundled
 * source keys the recipe; explicit native input bytes are read on hits too. */
export async function nalatiRenderTileProgram(ctx: Pick<ProjectGenerationContext, 'cached'>): Promise<ReadonlyMap<string, Uint8Array>> {
  const files = await ctx.cached({ id: 'render-tiles', native: true, inputs: [terrain] }, async inputs => {
    const native = inputs.get(terrain);
    if (native === undefined || native.length === 0) throw new Error('Missing native render terrain');
    return (await nalatiRenderTileSources(native)).files;
  });
  if (files.size !== 73 || [header, ...pairs].some(name => (files.get(name)?.length ?? 0) === 0)
    || [...files].some(([name, bytes]) => bytes.length === 0 || (name !== header && !pairs.includes(name)
      && (!/^assets\/[a-f0-9]{64}$/u.test(name) || hashImmutableBytes(bytes) !== name.slice(7))))) {
    throw new Error('Owned render tile inventory differs');
  }
  return files;
}
