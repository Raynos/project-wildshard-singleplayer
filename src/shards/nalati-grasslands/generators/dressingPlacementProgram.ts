import { nalatiGeographyProgram } from './geographyProgram';
import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { prepareNalatiDressingInputs } from './dressingInputs';
import { bakeNalatiDressingSource } from './dressingSource';

const terrain = '/assets/baked/nalati-grasslands/terrain.bin';
const groups = ['boulder', 'slab', 'stone', 'juniper', 'rose', 'willow', 'lupin', 'daisy', 'reed', 'logs', 'stumps', 'ovoos', 'poles', 'fences', 'gates', 'drifts', 'colliders', 'clutter'] as const;
const names = groups.map(group => `dressing-${group}.json`);

/** Own the original placement rows without selecting a page or publishing generated files. QF24: the forest is LEGACY's
 * continuous spruce mask, not the 256 lattice: the trees steer every later scatter draw, so the sampled law moved them all.
 * The native key binds all original terrain/scalar inputs and this defining recipe graph. */
export async function nalatiDressingPlacementProgram(ctx: Pick<ProjectGenerationContext, 'cached'>): Promise<ReadonlyMap<string, Uint8Array>> {
  const scalarBlocks = await nalatiGeographyProgram(ctx);
  const files = await ctx.cached({ id: 'dressing-placement', native: true, inputs: [terrain] }, async inputs => {
    const bytes = inputs.get(terrain);
    if (bytes === undefined) throw new Error('Missing original Nalati dressing terrain');
    const source = prepareNalatiDressingInputs({ terrain: bytes, scalarBlocks, forest: 'continuous', phone: false });
    const made = await bakeNalatiDressingSource(source), rows = { ...made.plan, clutter: made.clutter };
    return new Map(groups.map(group => [`dressing-${group}.json`, new TextEncoder().encode(`${JSON.stringify(rows[group])}\n`)]));
  });
  if (files.size !== names.length || [...files.keys()].some(name => !names.includes(name)) || names.some(name => (files.get(name)?.length ?? 0) === 0)) {
    throw new Error('Owned Nalati dressing placement inventory differs');
  }
  return files;
}
