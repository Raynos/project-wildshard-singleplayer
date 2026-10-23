// oxlint-disable-next-line import/no-nodejs-modules -- admit the generated presentation without inferring its complete JSON type
import { readFileSync } from 'node:fs';
import { object, parse } from 'valibot';
import { SpeciesActorsFileSchema, SpeciesPresentationSchema } from '@wildshard/format/speciesBookRows';
import { namedJsonSchema } from '@wildshard/sdk/formatJsonSchema';
import { nameBlob } from '@wildshard/sdk/blobs';
import { emptyShardfile } from '@wildshard/sdk/author';
import { createShardProduct } from '../../src/game/shardfile/shardProduct';
import { bakeSheepBody } from '../../src/shards/nalati-grasslands/generators/sheepBody';

const species=parse(object({presentation:SpeciesPresentationSchema}),
  JSON.parse(readFileSync('src/shards/nalati-grasslands/data/species.generated.json','utf8')));

type SheepMetadata = Omit<ReturnType<typeof bakeSheepBody>, 'bytes' | 'parts'> & {
  readonly species: typeof species.presentation; readonly page: { readonly world: null; readonly specimen: null }; readonly parts: readonly string[];
};
/** The real baked sheep channels, admitted through the same named-file grammar as play. */
export function admittedSheepProduct(body: { readonly parts?: readonly string[]; readonly radius?: number } = {}): ReturnType<typeof createShardProduct> & { readonly bytes: Uint8Array; readonly metadata: SheepMetadata } {
  const { bytes, ...baked } = bakeSheepBody();
  const metadata = { species: species.presentation, page: { world: null, specimen: null }, ...baked, ...body };
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
