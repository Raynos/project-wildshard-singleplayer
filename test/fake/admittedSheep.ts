// oxlint-disable-next-line import/no-nodejs-modules -- admit the generated presentation without inferring its complete JSON type
import { readFileSync } from 'node:fs';
import { object, parse } from 'valibot';
import { SpeciesActorsFileSchema, SpeciesPresentationSchema } from '@wildshard/format/speciesBookRows';
import { namedJsonSchema } from '@wildshard/sdk/formatJsonSchema';
import { nameBlob } from '@wildshard/sdk/blobs';
import { emptyShardfile } from '@wildshard/sdk/author';
import { createShardProduct, type ShardProduct } from '../../src/game/shardfile/shardProduct';
import { fixedDraws } from '../../src/game/models/fixedDraws';
import type { CrowdBody } from '../../src/game/ambient/crowdDraw';
import type { SpeciesActorsFileRows } from '../../src/format/speciesBookRows';
import { bakeSheepBody } from '../../src/shards/nalati-grasslands/generators/sheepBody';

const species=parse(object({presentation:SpeciesPresentationSchema}),
  JSON.parse(readFileSync('src/shards/nalati-grasslands/data/species.generated.json','utf8')));

type SheepMetadata = SpeciesActorsFileRows;
/** The real baked sheep channels, admitted through the same named-file grammar as play. */
export function admittedSheepProduct(body: { readonly parts?: readonly string[]; readonly radius?: number } = {}): ReturnType<typeof createShardProduct> & { readonly bytes: Uint8Array; readonly metadata: SheepMetadata } {
  const { bytes, row, ...baked } = bakeSheepBody();
  const metadata = parse(SpeciesActorsFileSchema,{ species: species.presentation, page: { world: null, specimen: null }, draws:[{slot:'actors/sheep.bin',file:'actors/sheep.bin',channels:[],baked:{...row,expand:false}}], ...baked, ...body });
  const encoded = new TextEncoder().encode(JSON.stringify(metadata));
  const json = nameBlob('actors/sheep.json', 'json', encoded, { jsonSchema: namedJsonSchema(SpeciesActorsFileSchema) });
  const binary = nameBlob('actors/sheep.bin', 'bin', bytes);
  const identity = { slug: 'sheep-admission', name: 'Sheep admission', author: 'Wildshard', revision: 1, seed: 1 };
  const product = createShardProduct({ slug: identity.slug, revision: 1, shardfile: emptyShardfile(identity), sections: new Map(),
    files: new Map([['actors/sheep.json', { ...json.file, url: 'https://example.test/sheep.json' }], ['actors/sheep.bin', { ...binary.file, url: 'https://example.test/sheep.bin' }]]),
    read: (hash: string) => {
      if (hash === json.file.hash) return Promise.resolve(encoded);
      if (hash === binary.file.hash) return Promise.resolve(bytes);
      throw new Error('Unexpected sheep product file');
    } });
  return { ...product, bytes, metadata };
}

/** The real shared fixed-draw intake; the fixture applies only the original animation bound. */
export async function admittedSheepBody(product:Pick<ShardProduct,'file'|'json'|'slug'>=admittedSheepProduct()):Promise<CrowdBody> {
  const rows=await product.json<SpeciesActorsFileRows>('actors/sheep.json'),draws=fixedDraws(product,rows.draws);
  await draws.load();
  const geometry=draws.handle('actors/sheep.bin').take();
  if(geometry.boundingSphere===null)throw new Error('Missing admitted sheep bound');
  geometry.boundingSphere.radius=rows.radius;
  return {geometry,pivots:rows.pivots,parts:rows.parts};
}
