import { FIGURE_CATALOGUE } from '../../src/shards/driftwood-isle/generators/figureCatalogue';
import { TOON_LOOK } from '../../src/shards/driftwood-isle/generators/toonPresentation';
import { HELD_ARMS } from '../../src/shards/driftwood-isle/generators/heldArms';
import inventory from '../../src/shards/driftwood-isle/data/fixedGeometry.json' with { type: 'json' };
import { encodeCanonicalJson, hashImmutableBytes } from '../../src/sdk/immutable';
import { createShardProduct } from '@wildshard/game/shardfile/shardProduct';
import { emptyShardfile } from '../../src/sdk/author';
import { DRIFTWOOD_CLIENT_SECTIONS } from '../../src/shards/driftwood-isle/generators/clientSections';
import { admitDriftwoodRows } from '../../src/shards/driftwood-isle/runtime/boot/rows';
import { NPC_FOCUS_PROGRAMS } from '../../src/shards/driftwood-isle/generators/npcFocusPrograms';

/** Node fixture (W2b): admit Driftwood's client row sections from the same definitions the build emits, as plain
 *  JSON parsed and frozen on read, so runtime readers that hold no product (cove, trailside, shrine) run offline. */
export function admitDriftwoodFixtureRows(): void {
  const sections = new Map<string, unknown>();
  for (const row of DRIFTWOOD_CLIENT_SECTIONS) { const value: unknown = JSON.parse(JSON.stringify(row.value)); sections.set(row.name, value); }
  sections.set('look/toon', TOON_LOOK);
  sections.set('held/arms', HELD_ARMS);
  const identity = { slug: 'driftwood-isle', name: 'Driftwood Isle', author: 'Wildshard', revision: 1, seed: 1 };
  const bytes = new TextEncoder().encode(encodeCanonicalJson(inventory.groups)), hash = hashImmutableBytes(bytes);
  const figures = new TextEncoder().encode(encodeCanonicalJson(FIGURE_CATALOGUE)), figureHash = hashImmutableBytes(figures);
  admitDriftwoodRows(createShardProduct({ slug: 'driftwood-isle', revision: 1, shardfile: { ...emptyShardfile(identity), clientChannels: NPC_FOCUS_PROGRAMS }, sections, files: new Map([['models/fixed-geometry.json', { hash, url: '/fixed-geometry.json' }], ['people/catalogue.json', { hash: figureHash, url: '/people/catalogue.json' }]]),
    read: name => name === hash ? Promise.resolve(bytes) : name === figureHash ? Promise.resolve(figures) : Promise.reject(new Error('no such file in this fixture')), check: true }));
}
