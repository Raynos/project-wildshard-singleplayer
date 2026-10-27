import inventory from '../../src/shards/driftwood-isle/data/fixedGeometry.json' with { type: 'json' };
import { encodeCanonicalJson, hashImmutableBytes } from '../../src/sdk/immutable';
// oxlint-disable-next-line import/no-nodejs-modules -- Admit the fixture's real source bytes with their original content identity.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- Read the retained authored asset sources for this product fixture.
import { readFile } from 'node:fs/promises';
// oxlint-disable-next-line import/no-nodejs-modules -- Native fixture paths resolve from the test repository.
import { resolve } from 'node:path';
import { createShardProduct } from '../../src/game/shardfile/shardProduct';
import { emptyShardfile } from '../../src/sdk/author';
import { DRIFTWOOD_BANK_BLOBS, DRIFTWOOD_OUTPUT } from '../../src/shards/driftwood-isle/generators/assets';
import { DRIFTWOOD_CLIENT_SECTIONS as LEGACY_SECTIONS } from './driftwoodLegacyLayouts';
import { DRIFTWOOD_CLIENT_SECTIONS } from '../../src/shards/driftwood-isle/generators/clientSections';
import { FIGURE_CATALOGUE } from '../../src/shards/driftwood-isle/generators/figureCatalogue';
import { NPC_FOCUS_PROGRAMS } from '../../src/shards/driftwood-isle/generators/npcFocusPrograms';
import { createProjectGeneration } from '../../src/sdk/projectGeneration';
import { driftwoodFixedModelOutput } from '../../src/shards/driftwood-isle/generators/fixedModels';

// The fixed producer owns these logical files since GR7; the static asset table
// intentionally omits them. Admit its real native outputs into this fixture too.
const fixedModels = driftwoodFixedModelOutput(createProjectGeneration('src/shards/driftwood-isle',
  hashImmutableBytes(new TextEncoder().encode('driftwood-fixed-product-fixture-v1')), new Map(), undefined,
  [{ prefix: '/assets/', directory: resolve('public/assets') }]));

/** Real published GLB source bytes with the same admitted asset and layout rows as the product writer. */
export async function driftwoodFixedProduct(legacy = false): Promise<ReturnType<typeof createShardProduct>> {
  const blobs = await Promise.all(DRIFTWOOD_OUTPUT.blobs.map(async row => {
    const bytes = new Uint8Array(await readFile(resolve('src/shards/driftwood-isle', row.source)));
    return {name: row.name, source: row.source, bytes, hash: createHash('sha256').update(bytes).digest('hex')};
  }));
  // the banks' blobs (GR7) carry their bytes; their source label is their name
  for (const row of DRIFTWOOD_BANK_BLOBS) blobs.push({ name: row.name, source: row.name, bytes: Uint8Array.from(row.bytes), hash: createHash('sha256').update(row.bytes).digest('hex') });
  const fixed = await fixedModels;
  for (const file of fixed.files) {
    if (file.name === undefined) throw new Error('Fixed fixture output must retain its logical name');
    const bytes = fixed.assets.get(file.hash);
    if (bytes === undefined) throw new Error(`Missing owned fixed fixture bytes: ${file.name}`);
    blobs.push({ name: file.name, source: `assets/${file.hash}`, bytes: Uint8Array.from(bytes), hash: file.hash });
  }
  const groupBytes = new TextEncoder().encode(encodeCanonicalJson(inventory.groups));
  blobs.push({ name: 'models/fixed-geometry.json', source: 'data/fixedGeometry.json', bytes: groupBytes, hash: createHash('sha256').update(groupBytes).digest('hex') });
  const figures = new TextEncoder().encode(encodeCanonicalJson(FIGURE_CATALOGUE));
  blobs.push({ name: 'people/catalogue.json', source: 'generators/figureCatalogue.ts', bytes: figures, hash: createHash('sha256').update(figures).digest('hex') });
  const assets = new Map(blobs.map(row => [row.hash, row.bytes]));
  return createShardProduct({slug: 'driftwood-isle', revision: 1,
    shardfile: { ...emptyShardfile({slug: 'driftwood-isle', name: 'Test', author: 'Test', revision: 1, seed: 1}), clientChannels: NPC_FOCUS_PROGRAMS },
    sections: new Map<string, unknown>((legacy ? LEGACY_SECTIONS : DRIFTWOOD_CLIENT_SECTIONS).map(row => [row.name, row.value] as const)),
    files: new Map(blobs.map(row => [row.name, {hash: row.hash, url: `/${row.source}`} ])),
    read: hash => { const bytes = assets.get(hash); return bytes === undefined ? Promise.reject(new Error('Missing fixed bytes')) : Promise.resolve(bytes); }, check: true});
}
