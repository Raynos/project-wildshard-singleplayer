import { createShardProduct } from '@wildshard/game/shardfile/shardProduct';
import { emptyShardfile } from '../../src/sdk/author';
import { DRIFTWOOD_ASSET_NAMES } from '../../src/shards/driftwood-isle/data/output';
import { DRIFTWOOD_CLIENT_SECTIONS } from '../../src/shards/driftwood-isle/generators/clientSections';
import { admitDriftwoodRows } from '../../src/shards/driftwood-isle/runtime/boot/rows';

/** Node fixture (W2b): admit Driftwood's client row sections from the same definitions the build emits, as plain
 *  JSON parsed and frozen on read, so runtime readers that hold no product (cove, trailside, shrine) run offline. */
export function admitDriftwoodFixtureRows(): void { admitDriftwoodFixtureAliases(DRIFTWOOD_ASSET_NAMES); }

/** Explicit alternative asset index for admission/refusal checks; ordinary hooks retain their no-argument signature. */
export function admitDriftwoodFixtureAliases(byUrl: Readonly<Record<string, string>>): void {
  const sections = new Map<string, unknown>();
  for (const row of DRIFTWOOD_CLIENT_SECTIONS) { const value: unknown = JSON.parse(JSON.stringify(row.value)); sections.set(row.name, value); }
  sections.set('custom/assets', { byUrl });
  const identity = { slug: 'driftwood-isle', name: 'Driftwood Isle', author: 'Wildshard', revision: 1, seed: 1 };
  admitDriftwoodRows(createShardProduct({ slug: 'driftwood-isle', revision: 1, shardfile: emptyShardfile(identity), sections, files: new Map(),
    read: () => Promise.reject(new Error('no files in this fixture')), check: true }));
}
