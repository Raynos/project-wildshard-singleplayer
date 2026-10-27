import { nalatiGeographyProgram } from './geographyProgram';
import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { encodeBuildBytes } from '@wildshard/sdk/bake/byteCodec';
import { withPortableMath } from '@wildshard/commons/bake/portableMath';
import { bakeNalatiPlacesOnTerrain } from './places';
import { encodeNalatiPart } from './placeWire';
import { nalatiNativePlaceParts } from './placeParts';
import { prepareNalatiDressingInputs } from './dressingInputs';
import { bakeNalatiDressingSource } from './dressingSource';

const terrain = '/assets/baked/nalati-grasslands/terrain.bin';
const partNames = ['actor:balbal:0:2977', 'actor:balbal:1:2977', 'actor:goat'];
const names = ['places.bin', 'places.json', 'specimens.bin', 'placeSpecimens.json', 'placeParts.json', ...partNames.map(name => `${name}.bin`)];

/** Cache fresh native construction as owned byte files; never publishes a source/public handoff.
 * The native cache key includes the bundled dressing recipe, original specimen arithmetic and codec. */
export async function nalatiPlacesProgram(ctx: Pick<ProjectGenerationContext, 'cached'>, phase: 'i3' | 'exact' = 'exact'): Promise<ReadonlyMap<string, Uint8Array>> {
  const scalarBlocks = await nalatiGeographyProgram(ctx);
  // iPhone downloads I3 (in flight): 'i3' bakes under its own cache step; 'exact' is the original bake
  const files = await ctx.cached({ id: phase === 'exact' ? 'places' : 'places-i3', native: true, inputs: [terrain] }, async inputs => {
    const bytes = inputs.get(terrain);
    if (bytes === undefined) throw new Error('Missing original Nalati placement terrain');
    // The retained native author used the non-drawing desktop tier, not a page's quality setting.
    const source = prepareNalatiDressingInputs({ terrain: bytes, scalarBlocks, forest: 'continuous', phone: false });
    const dressing = await bakeNalatiDressingSource(source);
    const made = bakeNalatiPlacesOnTerrain(Uint8Array.from(bytes).buffer, withPortableMath, dressing, phase);
    const compress = (value: Uint8Array): Uint8Array => encodeBuildBytes(value, 'deflate', 9, 'native');
    const places = encodeNalatiPart(made.places, compress), specimens = encodeNalatiPart(made.specimens, compress);
    const parts = nalatiNativePlaceParts(made.places.rows, made.places.bin, partNames);
    const geometry = Object.fromEntries([...parts].map(([name, part]) => [name, part.geometry]));
    return new Map([['places.bin', places.binary], ['places.json', places.document], ['specimens.bin', specimens.binary], ['placeSpecimens.json', specimens.document],
      ['placeParts.json', new TextEncoder().encode(`${JSON.stringify(geometry)}\n`)], ...[...parts].map(([name, part]): [string, Uint8Array] => [`${name}.bin`, part.bytes])]);
  });
  if (files.size !== names.length || [...files.keys()].some(name => !names.includes(name)) || names.some(name => (files.get(name)?.length ?? 0) === 0)) {
    throw new Error('Owned Nalati placement inventory differs');
  }
  return files;
}
