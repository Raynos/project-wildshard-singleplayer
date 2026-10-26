import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { prepareNalatiDressingInputs } from './dressingInputs';
import { bakeNalatiDressingSource } from './dressingSource';

const terrain = '/assets/baked/nalati-grasslands/terrain.bin';
const scalarInputs = ['pond', 'red', 'green', 'blue', 'forest'].map(name => `data/geography-${name}.bin`);
const groups = ['boulder', 'slab', 'stone', 'juniper', 'rose', 'willow', 'lupin', 'daisy', 'reed', 'logs', 'stumps', 'ovoos', 'poles', 'fences', 'gates', 'drifts', 'colliders', 'clutter'] as const;
const names = groups.map(group => `dressing-${group}.json`);

/** Own the original sampled-forest placement rows without selecting a page or publishing generated files.
 * The native key binds all original terrain/scalar inputs and this defining recipe graph. */
export async function nalatiDressingPlacementProgram(ctx: Pick<ProjectGenerationContext, 'cached'>): Promise<ReadonlyMap<string, Uint8Array>> {
  const files = await ctx.cached({ id: 'dressing-placement', native: true, inputs: [terrain, ...scalarInputs] }, async inputs => {
    const bytes = inputs.get(terrain);
    if (bytes === undefined) throw new Error('Missing original Nalati dressing terrain');
    const source = prepareNalatiDressingInputs({ terrain: bytes, scalarBlocks: inputs, forest: 'sampled', phone: false });
    const made = await bakeNalatiDressingSource(source), rows = { ...made.plan, clutter: made.clutter };
    return new Map(groups.map(group => [`dressing-${group}.json`, new TextEncoder().encode(`${JSON.stringify(rows[group])}\n`)]));
  });
  if (files.size !== names.length || [...files.keys()].some(name => !names.includes(name)) || names.some(name => (files.get(name)?.length ?? 0) === 0)) {
    throw new Error('Owned Nalati dressing placement inventory differs');
  }
  return files;
}
