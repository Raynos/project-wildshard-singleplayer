import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { emitNamedBlobs, nameBlob, type EmittedBlobs } from '@wildshard/sdk/blobs';
import { pineHullResources } from './riggedHulls';
import { GPU_FILES } from '../ktx2.generated';

/** QB6: the creatures' coats as product files, each the committed KTX2 coat bake (scripts/bake-coats.mjs) the KTX2 table
 *  names for it, both tiers, under the name the hull book's coats give (`models/creatures/<hull>[.phone].<kind>.<id>
 *  .coat.ktx2`). These are the coats a KTX2 device has always worn; the lossless PNG pages they replace were charged
 *  ~57 MB of Pine's phone play memory and never fetched there. */
export async function pineCoatPages(ctx: Pick<ProjectGenerationContext, 'cached'>): Promise<EmittedBlobs> {
  const rows = (['phone', 'desktop'] as const).flatMap(tier => Object.values(pineHullResources(tier).coats).map(coat => {
    const url = GPU_FILES[tier][coat.key];
    if (url === undefined) throw new Error(`Missing Pine coat bake ${coat.key}`);
    return { tier, name: coat.image, url };
  }));
  const files = await ctx.cached({ id: 'coat-pages', inputs: rows.map(row => row.url) }, inputs => new Map(rows.map(row => {
    const bytes = inputs.get(row.url);
    if (bytes === undefined || bytes.byteLength === 0) throw new Error(`Missing declared Pine coat ${row.url}`);
    return [row.name, bytes];
  })));
  if (files.size !== rows.length) throw new Error('Pine coats differ from the hull book');
  // D82: each tier's coat is that tier's download only (the other tier never names it)
  return emitNamedBlobs(rows.map(row => {
    const bytes = files.get(row.name);
    if (bytes === undefined) throw new Error(`Missing cached Pine coat ${row.name}`);
    return nameBlob(row.name, 'ktx2', bytes, { tier: row.tier });
  }));
}
