import inventory from '../../src/shards/driftwood-isle/data/fixedGeometry.json' with { type: 'json' };
import { encodeCanonicalJson } from '../../src/sdk/immutable';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createShardProduct } from '../../src/game/shardfile/shardProduct';
import { emptyShardfile } from '../../src/sdk/author';
import { DRIFTWOOD_OUTPUT } from '../../src/shards/driftwood-isle/generators/assets';
import { DRIFTWOOD_CLIENT_SECTIONS } from '../../src/shards/driftwood-isle/generators/clientSections';
import { FIGURE_CATALOGUE } from '../../src/shards/driftwood-isle/generators/figureCatalogue';
import { NPC_FOCUS_PROGRAMS } from '../../src/shards/driftwood-isle/generators/npcFocusPrograms';

/** Real published GLB source bytes with the same admitted asset and layout rows as the product writer. */
export async function driftwoodFixedProduct(): Promise<ReturnType<typeof createShardProduct>> {
  const blobs = await Promise.all(DRIFTWOOD_OUTPUT.blobs.map(async row => {
    const bytes = new Uint8Array(await readFile(resolve('src/shards/driftwood-isle', row.source)));
    return {name: row.name, source: row.source, bytes, hash: createHash('sha256').update(bytes).digest('hex')};
  }));
  const bytes = new TextEncoder().encode(encodeCanonicalJson(inventory.groups));
  blobs.push({ name: 'models/fixed-geometry.json', source: 'data/fixedGeometry.json', bytes, hash: createHash('sha256').update(bytes).digest('hex') });
  const figures = new TextEncoder().encode(encodeCanonicalJson(FIGURE_CATALOGUE));
  blobs.push({ name: 'people/catalogue.json', source: 'generators/figureCatalogue.ts', bytes: figures, hash: createHash('sha256').update(figures).digest('hex') });
  const assets = new Map(blobs.map(row => [row.hash, row.bytes]));
  return createShardProduct({slug: 'driftwood-isle', revision: 1,
    shardfile: { ...emptyShardfile({slug: 'driftwood-isle', name: 'Test', author: 'Test', revision: 1, seed: 1}), clientChannels: NPC_FOCUS_PROGRAMS },
    sections: new Map<string, unknown>(DRIFTWOOD_CLIENT_SECTIONS.map(row => [row.name, row.value] as const)),
    files: new Map(blobs.map(row => [row.name, {hash: row.hash, url: `/${row.source}`} ])),
    read: hash => { const bytes = assets.get(hash); return bytes === undefined ? Promise.reject(new Error('Missing fixed bytes')) : Promise.resolve(bytes); }, check: true});
}
