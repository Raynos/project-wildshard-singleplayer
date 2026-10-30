// @vitest-environment happy-dom
import { installCatalogueFixture } from './fixtures/bootSetup';
import { afterEach, expect, test } from 'vitest';
import { compiledFloorSave } from '../scripts/shard-phone-memory.mjs';
import { setDev } from '../src/engine/core/devMode';
import { jsonSlot } from '../src/engine/saves/slots';
import { buildTitleDeck, type TitleCard } from '../src/game/titleDeck';

await installCatalogueFixture();

afterEach(() => { jsonSlot(compiledFloorSave.key, compiledFloorSave.scope).reset(); setDev(false); document.body.replaceChildren(); });
test('the compiled floor fixture enters a template without legacy through its one ENTER WORLD', async () => {
  setDev(true);
  const selected: [string, string][] = [];
  const card: TitleCard = { slug: '_template', name: 'Template', label: 'Template',
    thumbnail: '', heroPortrait: '', heroLandscape: '', entries: {legacy: false, shardfile: true} };
  const deck = buildTitleDeck({ cards: [card], active: null, mode: () => ({developer: true, devserver: true}),
    onEnter: (row, entry) => { selected.push([row.slug, entry]); }, onExplore: () => undefined, onSettings: () => undefined });
  document.body.append(deck.root);
  try {
    const button = deck.root.querySelector<HTMLButtonElement>('.ws-menu-shardfile');
    if (button === null) throw new Error('Missing compiled button');
    expect(button.hidden).toBe(true);
    jsonSlot(compiledFloorSave.key, compiledFloorSave.scope).write(compiledFloorSave.data);
    // The real browser fixture is installed before the deck is constructed.
    deck.dispose(); deck.root.remove();
    const configured = buildTitleDeck({ cards: [card], active: null, mode: () => ({developer: true, devserver: true}),
      onEnter: (row, entry) => { selected.push([row.slug, entry]); }, onExplore: () => undefined, onSettings: () => undefined });
    try {
      document.body.append(configured.root);
      const compiled = configured.root.querySelector<HTMLButtonElement>('.ws-menu-shardfile');
      if (compiled === null) throw new Error('Missing configured compiled button');
      // no legacy copy: the card keeps the one ENTER WORLD, which enters the shardfile
      expect(compiled.hidden).toBe(true);
      const play = configured.root.querySelector<HTMLButtonElement>('.ws-menu-play');
      if (play === null) throw new Error('Missing ENTER WORLD');
      expect(play.disabled).toBe(false);
      play.click();
      expect(selected).toEqual([]);
      expect(document.querySelector('[data-navigation] [data-el="slug"]')?.textContent).toBe('Template');
      await new Promise<void>(resolve => { requestAnimationFrame(() => { requestAnimationFrame(() => { resolve(); }); }); });
      expect(selected).toEqual([['_template', 'shardfile']]);
    } finally { configured.dispose(); }
  } finally { deck.dispose(); }
});
