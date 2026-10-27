import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { emitNamedBlobs, nameBlob, type EmittedBlobs } from '@wildshard/sdk/blobs';
import { OCEAN_FILES } from './oceanFiles';

type Kind = 'glb' | 'bin';
/** iPhone downloads I8: the sea (clientSections.ts) reads these as product files, so they are cached, tier-selected and
 *  prefetched with the product instead of fetched as page assets (the spawn cove follows, I8.4). Each logical name maps
 *  its exact public build output; the bytes are copied unchanged. */
export const DRIFTWOOD_PAGE_FILES: Readonly<Record<string, { readonly url: string; readonly kind: Kind }>> = {
  'world/ocean/phone.glb': { url: OCEAN_FILES.phone, kind: 'glb' },
  'world/ocean/desktop.glb': { url: OCEAN_FILES.desktop, kind: 'glb' },
  'world/ocean/floor.bin': { url: OCEAN_FILES.floor, kind: 'bin' },
};
const NAMES = Object.keys(DRIFTWOOD_PAGE_FILES), INPUTS = NAMES.map(name => DRIFTWOOD_PAGE_FILES[name]?.url ?? '');

/** A declared page file's product name; refuses a name this table does not own. */
export function pageFile(name: string): { readonly file: string } {
  if (DRIFTWOOD_PAGE_FILES[name] === undefined) throw new Error(`Undeclared Driftwood page file: ${name}`);
  return { file: name };
}

/** The exact public bytes under their product names, through the build's owned-byte cache (no file under src). */
export async function driftwoodPageFileOutput(ctx: Pick<ProjectGenerationContext, 'cached'>): Promise<EmittedBlobs> {
  const files = await ctx.cached({ id: 'driftwood-page-files', inputs: INPUTS }, inputs => new Map(NAMES.map(name => {
    const bytes = inputs.get(DRIFTWOOD_PAGE_FILES[name]?.url ?? '');
    if (bytes === undefined || bytes.byteLength === 0) throw new Error(`Missing Driftwood page file: ${name}`);
    return [name, bytes];
  })));
  return emitNamedBlobs(NAMES.map(name => {
    const row = DRIFTWOOD_PAGE_FILES[name], bytes = files.get(name);
    if (row === undefined || bytes === undefined) throw new Error('Driftwood page file cache inventory differs');
    return nameBlob(name, row.kind, bytes);
  }));
}
