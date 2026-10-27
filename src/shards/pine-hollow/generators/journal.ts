import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { nameBlob, type NamedBlob } from '@wildshard/sdk/blobs';
import { hashImmutableBytes } from '@wildshard/sdk/immutable';
import { parseJournalRow, type JournalRow } from '@wildshard/sdk/rows';
import { JOURNAL } from './journalContent';

/** The journal's admitted row, its image files (as the declaration lists them) and their named blobs. */
export interface PineJournal { row: JournalRow; files: Omit<NamedBlob['file'], 'name' | 'path'>[]; blobs: NamedBlob[] }

/** The journal art folder's URL (every journal image sits directly in it). */
const ART = JOURNAL.chalk.atlas.slice(0, JOURNAL.chalk.atlas.lastIndexOf('/') + 1);

/** GR8: the journal as the retired bake-journal.mjs made it. Every `.webp` directly in the art folder is read through
 *  `ctx.cached` and named; the row names each sketch, silhouette and the chalk atlas by its bytes' hash. */
export async function pineJournal(ctx: Pick<ProjectGenerationContext, 'cached' | 'inputFiles'>): Promise<PineJournal> {
  const listed = ctx.inputFiles?.([ART]);
  if (listed === undefined) throw new Error('Pine journal needs its declared art inventory');
  const urls = listed.filter(url => url.endsWith('.webp') && !url.slice(ART.length).includes('/')).sort();
  const read = await ctx.cached({ id: 'journal-images', inputs: urls }, inputs => new Map(urls.map(url => {
    const bytes = inputs.get(url);
    if (bytes === undefined || bytes.byteLength === 0) throw new Error(`Missing declared Pine journal image ${url}`);
    return [url.slice(ART.length), bytes];
  })));
  const blobs = new Map<string, NamedBlob>();
  for (const url of urls) {
    const bytes = read.get(url.slice(ART.length));
    if (bytes === undefined) throw new Error(`Missing cached Pine journal image ${url}`);
    blobs.set(url, nameBlob(`journal/${url.slice(ART.length)}`, 'image', bytes));
  }
  const image = (url: string): string => {
    const blob = blobs.get(url);
    if (blob === undefined) throw new Error(`Unexpected journal image source ${url}`);
    return hashImmutableBytes(blob.bytes);
  };
  const entries: unknown[] = [];
  for (const entry of JOURNAL.entries) {
    const plate = entry.kind === 'place' ? { ...entry.plate, sketch: image(entry.plate.sketch) }
      : { ...entry.plate, sketch: image(entry.plate.sketch), silhouette: image(entry.plate.sketch.replace(/\.webp$/u, '-sil.webp')) };
    entries.push({ ...entry, plate });
  }
  const row = parseJournalRow({ ...JOURNAL, chalk: { ...JOURNAL.chalk, atlas: image(JOURNAL.chalk.atlas) }, entries });
  const files = new Map<string, PineJournal['files'][number]>();
  for (const blob of blobs.values()) { const { name: _name, path: _path, ...file } = blob.file; files.set(file.hash, file); }
  return { row, files: [...files.values()].sort((a, b) => a.hash.localeCompare(b.hash)), blobs: [...blobs.values()] };
}
