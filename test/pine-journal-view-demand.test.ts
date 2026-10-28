// @vitest-environment happy-dom
// oxlint-disable-next-line import/no-nodejs-modules -- Reuse the original journal producer's immutable input cache.
import { homedir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Existing explicit native cache root.
import { resolve } from 'node:path';
import { expect, test, vi } from 'vitest';
import { Scope } from '../src/engine/app/scope';
import { withOwner } from '../src/engine/app/ownership';
import { Journal } from '../src/game/compendium/Journal';
import { CompendiumState } from '../src/game/compendium/state';
import { declaredCompendium } from '../src/game/shard/declaredRows';
import { emptyShardfile } from '../src/sdk/author';
import { pineJournal } from '../src/shards/pine-hollow/generators/journal';
import { pineGeneration } from './fixtures/pine-generation';

test('the cold journal resolves original named silhouettes and sketches only when opened', async () => {
  const emitted = await pineJournal(pineGeneration('pine-journal-demand', resolve(homedir(), '.cache/wildshard/gen')));
  const base = emptyShardfile({ slug: 'journal-demand-fixture', name: 'Journal', author: 'Test', revision: 1, seed: 1 });
  const urls = new Map(emitted.blobs.map(blob => {
    if (blob.file.name === undefined) throw new Error('Journal image lost its logical name');
    return [blob.file.hash, `/declared/${blob.file.name}`];
  }));
  const def = declaredCompendium(emitted.row, base.rows, 'journal-demand-fixture', hash => {
    const url = urls.get(hash); if (url === undefined) throw new Error('Missing original named journal image'); return url;
  });
  const entry = def.entries.find(value => value.kind !== 'place' && value.plate.silhouette !== undefined);
  if (entry === undefined) throw new Error('Missing original illustrated journal entry');
  const owner = new Scope('journal-demand'), state = new CompendiumState(def);
  const journal = withOwner(owner, () => new Journal(state));
  try {
    expect(journal.root.querySelector('img')).toBeNull();
    journal.open(entry.id); await vi.dynamicImportSettled();
    await vi.waitFor(() => { expect(journal.root.classList.contains('show')).toBe(true); });
    expect(journal.root.querySelector('.ws-cmp-plate img')?.getAttribute('src')).toBe(entry.plate.silhouette);
    state.take(entry.id);
    expect(journal.root.querySelector('.ws-cmp-plate img')?.getAttribute('src')).toBe(entry.plate.sketch);
    expect(new Set(emitted.late.map(row => row.hash))).toContain(emitted.row.entries.find(value => value.id === entry.id)?.plate.sketch);
  } finally { owner.dispose(); }
  expect(journal.root.isConnected).toBe(false);
});
