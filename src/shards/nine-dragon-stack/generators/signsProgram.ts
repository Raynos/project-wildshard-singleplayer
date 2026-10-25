import { nameBlob, type NamedBlob } from '@wildshard/sdk/blobs';
import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { encodeCanonicalJson, hashImmutableBytes } from '@wildshard/sdk/immutable';
import { signAtlasBlobs, retainedSignInputs, parseSignSourceRows } from './signAtlasOutput';
import { signSourceRows } from './signAtlasSources';
import type { NineNativeAtlas, NineNativeSignInputs } from './nativeSignMetadata';
import type { NineNativeAtlasSource } from './nativeSignAtlas';

/** Exact predecessor files, returned as owned bytes rather than published under source. */
export function nineSignSourceFiles(read: (file: string) => Uint8Array, native?: NineNativeSignInputs): Map<string, Uint8Array> {
  const files = new Map<string, Uint8Array>(), rows: Record<string, unknown> = {};
  const sources = signAtlasBlobs(read, native).map(({ file, bytes }, index) => {
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

export type NineSourceSigns = ReturnType<typeof signSourceRows> & { readonly files: ReadonlyMap<string, Uint8Array>; readonly blobs: readonly NamedBlob[]; readonly atlas: NineNativeAtlas };

/** Each invocation re-admits every immutable cache result and publishes owned bytes. */
export async function nineSignsProgram(ctx: Pick<ProjectGenerationContext, 'cached' | 'asset'>, source?: NineNativeAtlasSource): Promise<NineSourceSigns> {
  const native = retainedSignInputs(source?.atlas);
  const declared = source === undefined ? nineSignInputs() : [...new Set(['glyphs.generated.json',
    ...Object.values(native.glyphs).flatMap(row => row.packed)])].map(file => `data/${file}`);
  const identity = source === undefined ? 'sign-sources' : `signs-${hashImmutableBytes(new TextEncoder().encode(encodeCanonicalJson([
    native.atlas, [...source.files].map(([name, bytes]) => [name, hashImmutableBytes(bytes)]),
  ])))}`;
  const files = await ctx.cached({ id: identity, inputs: declared }, inputs => nineSignSourceFiles(file => {
    const bytes = source?.files.get(file) ?? inputs.get(`data/${file}`); if (bytes === undefined) throw new Error(`Missing Nine native sign ${file}`); return bytes;
  }, native));
  const metadata = files.get('data/signSources.generated.json'); if (metadata === undefined) throw new Error('Missing Nine sign manifest');
  const manifest: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(metadata));
  const sources = parseSignSourceRows(manifest);
  if (typeof manifest !== 'object' || manifest === null || !('rows' in manifest)) throw new Error('Missing Nine sign rows');
  const admitted = signSourceRows({ sources, rows: manifest.rows });
  const names = new Set(sources.map(row => row.source)), logical = new Set(sources.map(row => row.name));
  if (sources.length !== 27 || names.size !== sources.length || logical.size !== sources.length || files.size !== sources.length + 1) throw new Error('Nine sign file inventory differs');
  const blobs = sources.map((row, index) => {
    if (row.source !== `data/signSource-${index}.generated.${row.kind}`) throw new Error('Nine sign source identity differs');
    const bytes = files.get(row.source); if (bytes === undefined) throw new Error(`Missing Nine sign ${row.source}`);
    const blob = nameBlob(row.name, row.kind, bytes, row.options);
    if (ctx.asset(blob.bytes) !== hashImmutableBytes(blob.bytes)) throw new Error('Nine sign publication differs');
    return blob;
  });
  return { ...admitted, files, blobs, atlas: native.atlas };
}
