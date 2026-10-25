import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { nameBlob, type NamedBlob } from '@wildshard/sdk/blobs';

/** Admit the original compressed places bytes directly, without a second source-tree copy. */
export async function nalatiPlaceBlob(ctx: Pick<ProjectGenerationContext, 'cached'>, decoded: number): Promise<NamedBlob> {
  const input = '/assets/nalati/baked/places.bin';
  const files = await ctx.cached({ id: 'places-blob', inputs: [input] }, inputs => {
    const bytes = inputs.get(input);
    if (bytes === undefined) throw new Error('Missing authored places binary');
    return new Map([['places.bin', bytes]]);
  });
  const bytes = files.get('places.bin');
  if (bytes === undefined || files.size !== 1) throw new Error('Missing owned places binary');
  return nameBlob('world/places.bin', 'bin', bytes, { decoded });
}
