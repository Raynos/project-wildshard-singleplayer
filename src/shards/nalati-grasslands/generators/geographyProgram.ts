import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import sourceRows from '../data/geographySources.json' with { type: 'json' };
import { nalatiGeographySources } from './geographySource';

/** The bundled source defines every raster input; the product owns all resulting bytes. */
export async function nalatiGeographyProgram(ctx: Pick<ProjectGenerationContext, 'cached'>): Promise<ReadonlyMap<string, Uint8Array>> {
  const files = await ctx.cached({ id: 'geography' }, () => nalatiGeographySources());
  const names = [...sourceRows.map(row => row.source), 'boot/geography.generated.json',
    'boot/geography.generated.d.json.ts', 'data/populationField.generated.json'];
  if (files.size !== names.length || names.some(name => (files.get(name)?.length ?? 0) === 0)) throw new Error('Owned geography inventory differs');
  return files;
}
