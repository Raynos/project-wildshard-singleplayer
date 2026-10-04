import { expect, it } from 'vitest';
import { SaveStore } from '../../../src/engine/saves/store';
import { summaryStore } from '../../../src/game/summary';
import { SHARDS } from '../../../src/shards.generated';
import { playable } from '../../../src/game/shard/registry';
import manifest from '../../../src/shards/_template/manifest';

// Boot/headless/replay/ledger contracts run the real declared template under test/proof/_template.
// The installed-client receipt additionally exercises world/kit/play, live inputs, offline restore and unload.
it('keeps hidden teaching saves out of the production summary', () => {
  const reads: string[] = [];
  summaryStore(new SaveStore({ local: null, session: null }), (slug) => { reads.push(slug); return null; }).read();
  expect(reads).not.toContain(manifest.slug);
  expect(reads).toEqual(SHARDS.filter(playable).map((shard) => shard.slug));
});
