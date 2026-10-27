import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { emitNamedBlobs, nameBlob, type EmittedBlobs } from '@wildshard/sdk/blobs';
import { PINE_HULLS } from './creatureHulls';
import { producePineCoats } from './coatProducer';
import { pineHullResources } from './riggedHulls';
import { GPU_FILES } from '../ktx2.generated';

/** GR8 G35: the creatures' coat pages, painted as the retired bake-pine-coat-pages.mjs did (`producePineCoats`
 *  over each tier's committed rig, read through `ctx.cached` by its public URL, with the build context's image codecs) and named as the product files the hull
 *  book's coats name (`models/creatures/<hull>[.phone].<kind>.<id>.coat.png`). The painted set must be the book's. */
export async function pineCoatPages(ctx: Pick<ProjectGenerationContext, 'cached' | 'readImagePixels' | 'writeImagePixels'>): Promise<EmittedBlobs> {
  const write = ctx.writeImagePixels;
  if (write === undefined) throw new Error('Pine coat pages need image writing');
  // a step names its outputs by plain file names: each rig by its URL's last part
  const file = (url: string): string => url.slice(url.lastIndexOf('/') + 1);
  // each rig's committed public URL, as the KTX2 table names it (publicInputs.ts' rig inputs look it up the same way)
  const urls = (['desktop', 'phone'] as const).flatMap(tier => PINE_HULLS.rigs.map(hull => {
    const name = `/creatures/${hull}${tier === 'phone' ? '.phone' : ''}.rigged.glb`, url = Object.keys(GPU_FILES[tier]).find(key => key.endsWith(name));
    if (url === undefined) throw new Error(`Missing Pine rig in the KTX2 table: ${name}`);
    return url;
  }));
  const rigs = await ctx.cached({ id: 'coat-rigs', inputs: urls }, inputs => new Map(urls.map(url => {
    const bytes = inputs.get(url);
    if (bytes === undefined || bytes.byteLength === 0) throw new Error(`Missing declared Pine rig ${url}`);
    return [file(url), bytes];
  })));
  const blobs = [];
  for (const tier of ['phone', 'desktop'] as const) {
    const named = new Map(Object.values(pineHullResources(tier).coats).map(coat => [coat.key, coat.image]));
    const painted = await producePineCoats(url => {
      const bytes = rigs.get(file(url));
      if (bytes === undefined) throw new Error(`Missing cached Pine rig ${url}`);
      return Promise.resolve(bytes);
    }, tier, { read: bytes => ctx.readImagePixels(bytes), write });
    if (painted.length !== named.size) throw new Error(`Pine ${tier} coats differ from the hull book`);
    for (const coat of painted) {
      const name = named.get(coat.key);
      if (name === undefined) throw new Error(`Pine coat ${coat.key} is not in the hull book`);
      blobs.push(nameBlob(name, 'image', coat.png));
    }
  }
  return emitNamedBlobs(blobs);
}
