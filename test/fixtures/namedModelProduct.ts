import { TOON_LOOK } from '../../src/shards/driftwood-isle/generators/toonPresentation';
import { HELD_ARMS } from '../../src/shards/driftwood-isle/generators/heldArms';
import { DRIFTWOOD_CLIENT_SECTIONS } from './driftwoodLegacyLayouts';
import { encodeCanonicalJson } from '../../src/sdk/immutable';
import { createShardProduct } from '../../src/game/shardfile/shardProduct';
import { emptyShardfile } from '../../src/sdk/author';
import { nameBlob } from '../../src/sdk/blobs';

/** A verified named-byte source for cold Explorer fixtures, with no public URL transport. */
export function namedModelProduct(models: ReadonlyMap<string, Uint8Array>, check = true): ReturnType<typeof createShardProduct> {
  const blobs = [...models].map(([url, bytes], index) => ({ url, blob: nameBlob(`models/specimen-${index}.glb`, 'glb', bytes) }));
  const assets = new Map(blobs.map(({ blob }) => [blob.file.hash, blob.bytes]));
  return createShardProduct({ slug: 'driftwood-isle', revision: 1,
    shardfile: emptyShardfile({ slug: 'driftwood-isle', name: 'Test', author: 'Test', revision: 1, seed: 1 }),
    sections: new Map<string, unknown>([...DRIFTWOOD_CLIENT_SECTIONS.map(({name,value}): [string, unknown] => [name, JSON.parse(encodeCanonicalJson(value))]), ['look/toon', TOON_LOOK], ['held/arms', HELD_ARMS], ['custom/assets', { byUrl: Object.fromEntries(blobs.map(({ url, blob }) => [url, blob.file.name])) }]]),
    files: new Map(blobs.map(({ blob }) => [blob.file.name ?? '', { hash: blob.file.hash, url: `/${blob.file.path}` }])),
    read: hash => {
      const bytes = assets.get(hash);
      if (bytes === undefined) return Promise.reject(new Error('Undeclared named specimen'));
      return Promise.resolve(bytes);
    }, check });
}
