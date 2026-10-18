import type { Shardfile } from '@wildshard/format/shardSchema';
import { outputSectionPayloads } from '@wildshard/format/outputIndex';
import { outputBlobUrl, outputDescriptor } from './outputDescriptor';
import { createShardProduct, type ShardProduct } from './shardProduct';

/** Bind the verified reader to the synchronous runtime API. No renderer or browser enters native preparation. */
export function shardProductData(source: Shardfile, base: string, read: (hash: string) => Promise<Uint8Array>, check = true): ShardProduct {
  const descriptor = outputDescriptor(source);
  const files = new Map(descriptor?.index.files.flatMap(file => file.name === undefined ? [] : [[file.name, {
    hash: file.commons === true ? `commons:${file.hash}` : file.hash,
    url: outputBlobUrl(source, file.commons === true ? `commons:${file.hash}` : file.hash, base),
    ...(file.jsonSchema === undefined ? {} : { jsonSchema: file.jsonSchema }),
  }] as const]));
  // Native APIs may supply an already checked in-memory Shardfile. This does
  // not read an older disk format or fabricate custom sections/logical names.
  return createShardProduct({ slug: source.identity.slug, revision: source.identity.revision, shardfile: source,
    sections: descriptor?.sections ?? outputSectionPayloads(source), files, read, check });
}
