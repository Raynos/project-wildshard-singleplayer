import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { encodeBuildBytes } from '@wildshard/sdk/bake/byteCodec';
import { withPortableMath } from '@wildshard/commons/bake/portableMath';
import { bakeNalatiPlacesOnTerrain } from './places';
import { encodeNalatiPart } from './placeWire';

/** The source supplies the original continuous-forest dressing decisions. */
export interface NalatiPlaceBuild {
  readonly dressing: () => Promise<NonNullable<Parameters<typeof bakeNalatiPlacesOnTerrain>[2]>>;
}

const terrain = '/assets/baked/nalati-grasslands/terrain.bin';
const names = ['places.bin', 'places.json', 'specimens.bin', 'placeSpecimens.json'];

/** Cache fresh native construction as owned byte files; never publishes a source/public handoff.
 * The native cache key includes the bundled dressing recipe, original specimen arithmetic and codec. */
export async function nalatiPlacesProgram(ctx: Pick<ProjectGenerationContext, 'cached'>, build: NalatiPlaceBuild): Promise<ReadonlyMap<string, Uint8Array>> {
  const files = await ctx.cached({ id: 'places', native: true, inputs: [terrain] }, async inputs => {
    const bytes = inputs.get(terrain);
    if (bytes === undefined) throw new Error('Missing original Nalati placement terrain');
    const made = bakeNalatiPlacesOnTerrain(Uint8Array.from(bytes).buffer, withPortableMath, await build.dressing());
    const compress = (value: Uint8Array): Uint8Array => encodeBuildBytes(value, 'deflate', 9, 'native');
    const places = encodeNalatiPart(made.places, compress), specimens = encodeNalatiPart(made.specimens, compress);
    return new Map([['places.bin', places.binary], ['places.json', places.document], ['specimens.bin', specimens.binary], ['placeSpecimens.json', specimens.document]]);
  });
  if (files.size !== names.length || [...files.keys()].some(name => !names.includes(name)) || names.some(name => (files.get(name)?.length ?? 0) === 0)) {
    throw new Error('Owned Nalati placement inventory differs');
  }
  return files;
}
