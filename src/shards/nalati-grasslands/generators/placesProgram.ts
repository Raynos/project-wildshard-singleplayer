import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { bakeNalatiPlacesOnTerrain } from './places';
import { encodeNalatiPart } from './placeWire';

/** Native arithmetic and original dressing decisions stay explicit until their source programs own them. */
export interface NalatiPlaceBuild {
  readonly dressing: () => Promise<NonNullable<Parameters<typeof bakeNalatiPlacesOnTerrain>[2]>>;
  readonly specimens: NonNullable<Parameters<typeof bakeNalatiPlacesOnTerrain>[1]>;
  readonly deflate: (bytes: Uint8Array) => Uint8Array;
}

const terrain = '/assets/baked/nalati-grasslands/terrain.bin';
const names = ['places.bin', 'places.json', 'specimens.bin', 'placeSpecimens.json'];

/** Cache fresh native construction as owned byte files; never publishes a source/public handoff.
 * The caller's bundled program key must include its dressing recipe, specimen arithmetic and codec. */
export async function nalatiPlacesProgram(ctx: Pick<ProjectGenerationContext, 'cached'>, build: NalatiPlaceBuild): Promise<ReadonlyMap<string, Uint8Array>> {
  const files = await ctx.cached({ id: 'places', native: true, inputs: [terrain] }, async inputs => {
    const bytes = inputs.get(terrain);
    if (bytes === undefined) throw new Error('Missing original Nalati placement terrain');
    const made = bakeNalatiPlacesOnTerrain(Uint8Array.from(bytes).buffer, build.specimens, await build.dressing());
    const places = encodeNalatiPart(made.places, build.deflate), specimens = encodeNalatiPart(made.specimens, build.deflate);
    return new Map([['places.bin', places.binary], ['places.json', places.document], ['specimens.bin', specimens.binary], ['placeSpecimens.json', specimens.document]]);
  });
  if (files.size !== names.length || [...files.keys()].some(name => !names.includes(name)) || names.some(name => (files.get(name)?.length ?? 0) === 0)) {
    throw new Error('Owned Nalati placement inventory differs');
  }
  return files;
}
