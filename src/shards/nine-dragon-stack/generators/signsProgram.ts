import * as v from 'valibot';
import { nameBlob, type NamedBlob } from '@wildshard/sdk/blobs';
import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { hashImmutableBytes } from '@wildshard/sdk/immutable';
import { signAtlasBlobs, retainedSignInputs } from './signAtlasOutput';

const Sources = v.array(v.strictObject({ name: v.string(), kind: v.picklist(['glb', 'ktx2', 'json']), source: v.string(),
  options: v.strictObject({ decoded: v.number(), gpu: v.number(), triangles: v.number(), draws: v.number(), critical: v.boolean(), dependencies: v.array(v.string()) }) }));

/** Exact predecessor files, returned as owned bytes rather than published under source. */
export function nineSignSourceFiles(read: (file: string) => Uint8Array): Map<string, Uint8Array> {
  const files = new Map<string, Uint8Array>(), rows: Record<string, unknown> = {};
  const sources = signAtlasBlobs(read).map(({ file, bytes }, index) => {
    const source = `data/signSource-${index}.generated.${file.kind}`;
    files.set(source, bytes);
    for (const tier of ['phone', 'desktop']) if (file.name === `signs/atlas-${tier}.json`) rows[tier] = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    const { name, kind, decoded, gpu, triangles, draws, critical, dependencies } = file;
    return { name, kind, source, options: { decoded, gpu, triangles, draws, critical, dependencies } };
  });
  files.set('data/signSources.generated.json', new TextEncoder().encode(`${JSON.stringify({ sources, rows })}\n`));
  return files;
}

/** Retained native raster inputs remain explicit until their own producer rows retire. */
export function nineSignInputs(): string[] {
  const native = retainedSignInputs();
  return [...new Set(['glyphs.generated.json', 'signAtlas.generated.json',
    ...Object.values(native.glyphs).flatMap(row => row.packed),
    ...Object.values(native.atlas).flatMap(row => [row.buffer, row.mono.packed, row.colour.packed])])].map(file => `data/${file}`);
}

/** Each invocation re-admits every immutable cache result and publishes owned bytes. */
export async function nineSignsProgram(ctx: Pick<ProjectGenerationContext, 'cached' | 'asset'>): Promise<{ readonly files: ReadonlyMap<string, Uint8Array>; readonly blobs: readonly NamedBlob[] }> {
  const files = await ctx.cached({ id: 'sign-sources', inputs: nineSignInputs() }, inputs => nineSignSourceFiles(file => {
    const bytes = inputs.get(`data/${file}`); if (bytes === undefined) throw new Error(`Missing Nine native sign ${file}`); return bytes;
  }));
  const metadata = files.get('data/signSources.generated.json'); if (metadata === undefined) throw new Error('Missing Nine sign manifest');
  const manifest: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(metadata));
  const { sources } = v.parse(v.object({ sources: Sources }), manifest);
  const names = new Set(sources.map(row => row.source)), logical = new Set(sources.map(row => row.name));
  if (sources.length !== 27 || names.size !== sources.length || logical.size !== sources.length || files.size !== sources.length + 1) throw new Error('Nine sign file inventory differs');
  const blobs = sources.map((row, index) => {
    if (row.source !== `data/signSource-${index}.generated.${row.kind}`) throw new Error('Nine sign source identity differs');
    const bytes = files.get(row.source); if (bytes === undefined) throw new Error(`Missing Nine sign ${row.source}`);
    const blob = nameBlob(row.name, row.kind, bytes, row.options);
    if (ctx.asset(blob.bytes) !== hashImmutableBytes(blob.bytes)) throw new Error('Nine sign publication differs');
    return blob;
  });
  return { files, blobs };
}
