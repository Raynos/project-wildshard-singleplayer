// @vitest-environment happy-dom
// oxlint-disable-next-line import/no-nodejs-modules -- Reuse the original journal producer's immutable input cache.
import { homedir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Existing explicit native cache root.
import { resolve } from 'node:path';
import { expect, test, vi } from 'vitest';
import { Scope } from '../src/engine/app/scope';
import { withOwner } from '../src/engine/app/ownership';
import { hudSlots } from '../src/engine/ui/hudSlots';
import { legacyDouble } from '../src/engine/test/FakeGame';
import { PerspectiveCamera } from 'three';
import { Journal } from '../src/game/compendium/Journal';
import { CompendiumState } from '../src/game/compendium/state';
import { installCompendium, type CompendiumHost } from '../src/game/compendium/install';
import { registerCompendium } from '../src/game/compendium/registry';
import { BagMenu } from '../src/game/bag/tabs';
import { Inventory } from '../src/game/Inventory';
import { Progress } from '../src/game/Progress';
import { declaredCompendium } from '../src/game/shard/declaredRows';
import { emptyShardfile } from '../src/sdk/author';
import { pineJournal } from '../src/shards/pine-hollow/generators/journal';
import { pineGeneration } from './fixtures/pine-generation';
import { installCatalogueFixture } from './fixtures/bootSetup';

await installCatalogueFixture();

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

test('the journal pill waits for the touch layer and opens through its real pointer handler', async () => {
  const emitted = await pineJournal(pineGeneration('pine-journal-touch', resolve(homedir(), '.cache/wildshard/gen')));
  const base = emptyShardfile({ slug: 'journal-touch-fixture', name: 'Journal', author: 'Test', revision: 1, seed: 1 });
  const def = { ...declaredCompendium(emitted.row, base.rows, 'journal-touch-fixture', hash => `/declared/${hash}`), chunkId: 'journal-touch-fixture' };
  const unregister = registerCompendium(def), owner = new Scope('journal-touch'), snapshot = hudSlots.snapshot();
  hudSlots.restore({ ...snapshot, layer: null, status: null, pending: [] });
  const layer = document.createElement('div'), status = document.createElement('div'); layer.append(status);
  const updates: Parameters<CompendiumHost['game']['onUpdate']>[0][] = [];
  const menu = legacyDouble<CompendiumHost['menu']>({ scope: owner, isOpen: false, refresh: () => undefined,
    addTab: () => () => undefined, addTabFragment: () => () => undefined });
  const enabled = vi.fn<CompendiumHost['weapons']['setEnabled']>();
  try {
    const installed = withOwner(owner, () => {
      new BagMenu(menu, { progress: new Progress('journal-touch-fixture'), inventory: new Inventory('journal-touch-fixture'), kit: () => [] });
      return installCompendium({ chunkId: def.chunkId, menu, game: { onUpdate: run => { updates.push(run); } }, camera: new PerspectiveCamera(),
        hud: legacyDouble<CompendiumHost['hud']>({ entered: true, holdPause: false, toast: () => undefined, onResume: () => undefined }),
        animals: legacyDouble<CompendiumHost['animals']>({ animals: [] }), cabins: null, interactables: [],
        weapons: { setEnabled: enabled }, touchUi: () => true, nolock: true });
    });
    if (installed === null) throw new Error('Original journal was not registered');
    expect(installed.journal.root.isConnected).toBe(true);
    expect(document.querySelector('.ws-cmp-disc')).toBeNull();
    document.body.append(layer); hudSlots.mount(layer, status);
    for (const update of updates) update(1 / 30, 0);
    const button = status.querySelector('.ws-cmp-disc.show');
    if (button === null) throw new Error('Touch-mounted journal pill is missing');
    expect(button.textContent).toBe('Journal'); expect(installed.journal.root.querySelector('img')).toBeNull();
    button.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    await vi.dynamicImportSettled();
    await vi.waitFor(() => { expect(installed.journal.root.classList.contains('show')).toBe(true); });
    expect(enabled).toHaveBeenCalledWith(false);
    installed.journal.close(); expect(installed.journal.isOpen).toBe(false);
    owner.dispose(); expect(status.querySelector('.ws-cmp-disc')).toBeNull();
  } finally { owner.dispose(); unregister(); layer.remove(); hudSlots.restore(snapshot); }
});
