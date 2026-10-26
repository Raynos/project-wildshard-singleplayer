import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { withPortableMath } from '@wildshard/commons/bake/portableMath';
import { decorativeRows } from './decorative';

const terrain = '/assets/baked/nalati-grasslands/terrain.bin';

/** Own both original decorative profiles over the declared native terrain.
 * The source cache retains complete wire bytes, without selecting a page or publishing a handoff. */
export async function nalatiDecorativeProgram(ctx: Pick<ProjectGenerationContext, 'cached'>): Promise<ReadonlyMap<string, Uint8Array>> {
  const files = await ctx.cached({ id: 'decorative', native: true, inputs: [terrain] }, inputs => {
    const bytes = inputs.get(terrain);
    if (bytes === undefined) throw new Error('Missing original Nalati decorative terrain');
    const profiles = withPortableMath(() => decorativeRows(bytes));
    return new Map([['decorative.json', new TextEncoder().encode(`${JSON.stringify(profiles, null, 2)}\n`)]]);
  });
  if (files.size !== 1 || (files.get('decorative.json')?.length ?? 0) === 0) {
    throw new Error('Owned Nalati decorative inventory differs');
  }
  return files;
}
