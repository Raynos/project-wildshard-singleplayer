import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { nameBlob, type NamedBlob } from '@wildshard/sdk/blobs';

const sources = {
  places: { file: 'places.bin', input: '/assets/nalati/baked/places.bin' },
  crags: { file: 'crags.bin', input: '/assets/nalati/baked/crags.bin' },
  dressing: { file: 'dressing.bin', input: '/assets/nalati/baked/dressing.bin' },
};

/** Admit the original compressed scene bake bytes directly, without a second source-tree copy. */
export async function nalatiBakeBlob(ctx: Pick<ProjectGenerationContext, 'cached'>, name: 'places' | 'crags' | 'dressing', decoded: number): Promise<NamedBlob> {
  const { file, input } = sources[name];
  const files = await ctx.cached({ id: `${name}-blob`, inputs: [input] }, inputs => {
    const bytes = inputs.get(input);
    if (bytes === undefined) throw new Error(`Missing authored ${name} binary`);
    return new Map([[file, bytes]]);
  });
  const bytes = files.get(file);
  if (bytes === undefined || files.size !== 1) throw new Error(`Missing owned ${name} binary`);
  return nameBlob(`world/${file}`, 'bin', bytes, { decoded });
}
