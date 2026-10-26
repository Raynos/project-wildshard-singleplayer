import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import type { ProjectOutput } from '@wildshard/sdk/projectOutput';
import { emitNamedBlobs, nameBlob, type NamedBlob } from '@wildshard/sdk/blobs';

type Source = NonNullable<ProjectOutput['blobs']>[number];

/** Admit Nalati's existing raw file inputs and owned replacements in their original order.
 * Explicit ctx inputs retain confinement and immutable caching; this author has no textual glTF or meshopt intake. */
export async function nalatiOutputInputs(ctx: Pick<ProjectGenerationContext, 'cached'>, sources: readonly (Source | NamedBlob)[]): Promise<readonly NamedBlob[]> {
  const names = new Set<string>(), paths = new Set<string>();
  for (const row of sources) {
    const name = 'file' in row ? row.file.name : row.name;
    if (name === undefined || names.has(name)) throw new Error('Duplicate or absent Nalati output name');
    names.add(name);
    if ('file' in row) continue;
    if (row.source.toLowerCase().endsWith('.gltf') || row.options?.meshopt === true) throw new Error('Nalati output requires original raw source bytes');
    if (row.source.startsWith('/') || /[%\\:?#]/u.test(row.source) || row.source.split('/').some(part => part === '' || part === '.' || part === '..')) throw new Error('Nalati output requires a project-contained source');
    paths.add(row.source);
  }
  const files = await ctx.cached({ id: 'output-inputs', inputs: [...paths] }, inputs => {
    for (const path of paths) {
      const bytes = inputs.get(path);
      if (bytes === undefined || bytes.byteLength > 25_000_000) throw new Error('Missing or oversized Nalati output input');
    }
    return new Map([...paths].map(path => {
      const bytes = inputs.get(path);
      if (bytes === undefined) throw new Error('Missing Nalati output input');
      return [path, bytes];
    }));
  });
  if (files.size !== paths.size || [...files.keys()].some(path => !paths.has(path))) throw new Error('Nalati output input inventory differs');
  return sources.map(row => {
    if ('file' in row) {
      const admitted = emitNamedBlobs([row]), file = admitted.files[0];
      const bytes = file === undefined ? undefined : admitted.assets.get(file.hash);
      if (file === undefined || bytes === undefined) throw new Error('Missing owned Nalati output bytes');
      return { file, bytes, ...(row.script === undefined ? {} : { script: row.script }) };
    }
    const bytes = files.get(row.source);
    if (bytes === undefined || bytes.byteLength > 25_000_000) throw new Error('Missing or oversized Nalati output input');
    return nameBlob(row.name, row.kind, bytes, row.options);
  });
}
