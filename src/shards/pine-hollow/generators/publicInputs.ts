import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import declared from '../data/publicInputs.json' with { type: 'json' };
import { emitNamedBlobs, nameBlob, nameMeshoptBlob, type BlobOptions, type EmittedBlobs, type NamedBlobKind, type NamedBlob } from '@wildshard/sdk/blobs';

/** One committed public input published as a product blob. */
export interface PublicBlob { readonly name: string; readonly kind: NamedBlobKind; readonly url: string; readonly options?: BlobOptions }

/** GR8: read committed public inputs through `ctx.cached` (their declared URLs are the step's inputs) and name each as
 *  the retired source declaration did: a GLB meshopt-packed as a `meshopt: true` source, anything else as read. */
export async function readPublicBlobs(ctx: Pick<ProjectGenerationContext, 'cached'>, id: string, rows: readonly PublicBlob[]): Promise<NamedBlob[]> {
  const files = await ctx.cached({ id, inputs: rows.map(row => row.url) }, inputs => new Map(rows.map(row => {
    const bytes = inputs.get(row.url);
    if (bytes === undefined || bytes.byteLength === 0) throw new Error(`Missing declared Pine input ${row.url}`);
    return [row.name, bytes];
  })));
  if (files.size !== rows.length) throw new Error(`Pine ${id} input inventory differs`);
  const named: NamedBlob[] = [];
  for (const row of rows) {
    const bytes = files.get(row.name);
    if (bytes === undefined) throw new Error(`Missing cached Pine input ${row.name}`);
    named.push(row.kind === 'glb' ? await nameMeshoptBlob(row.name, bytes, row.options) : nameBlob(row.name, row.kind, bytes, row.options));
  }
  return named;
}

/** The thrall's extras, both tiers (the extras bake stays their geometry owner). */
export async function pineCreatureBlobs(ctx: Pick<ProjectGenerationContext, 'cached'>): Promise<EmittedBlobs> {
  const rows = declared.creatures.map(row => ({ name: row.name, kind: 'glb' as const, url: row.url }));
  return emitNamedBlobs(await readPublicBlobs(ctx, 'creature-inputs', rows));
}
