import { expect, it } from 'vitest';
import { SaveStore } from '../src/engine/saves/store';
import { previewNewGame, resetNewGame } from '../src/game/newGame';
import { cardLines, saveCards, sheetRows } from '../src/game/savesSettings';
import type { ShardSlug } from '../src/game/shard/slugs.generated';
import { MemoryStorage } from './setup';

const prefix = 'wildshard.save.v2.';
const card = { thumb: 't.webp', portrait: 'p.webp', landscape: 'l.webp' };
const manifest = (slug: ShardSlug, name: string, order: number, status: 'live' | 'hidden' = 'live') => ({ slug, name, order, status, card });
const list = [manifest('pine-hollow', 'Pine Hollow', 20), manifest('driftwood-isle', 'Driftwood Isle', 10), manifest('_template', 'Template shard', 1000, 'hidden')];

it('lists every save instance once: canonical copies in card order, then the grid template copies, hidden ones only in developer mode', () => {
  const shipped = saveCards(list, false), dev = saveCards(list, true);
  expect(shipped.filter((c) => c.listed).map((c) => c.name)).toEqual(['Driftwood Isle', 'Pine Hollow']);
  expect(dev.filter((c) => c.listed).map((c) => c.instance.id)).toEqual(['driftwood-isle', 'pine-hollow', 'template-solo']);
  expect(dev.filter((c) => c.instance.id.startsWith('template-') && c.instance.id !== 'template-solo').map((c) => c.name))
    .toEqual(['Template shard · COPY 2', 'Template shard · COPY 3', 'Template shard · COPY 5']); // G198: copies 1, 4 and 6 became open plots
  expect(new Set(dev.map((c) => c.instance.id)).size).toBe(dev.length);
});
it('words the card and the sheet from the preview: before → after, kept, quoted strings', () => {
  const local = new MemoryStorage(), store = new SaveStore({ local, session: null }), id = { id: 'pine-hollow', shard: 'pine-hollow' };
  local.setItem(`${prefix}pine-hollow`, JSON.stringify({ keys: { flags: { v: 1, data: ['a', 'quest.done'] }, inventory: { v: 1, data: { counts: { rope: 3, cone: 1 }, order: ['rope', 'cone'] } } } }));
  const summary = previewNewGame(store, id, [{ id: 'q', completeFlag: 'quest.done' }]);
  expect(cardLines(summary)).toEqual(['QUESTS 1 DONE', '4 ITEMS']);
  expect(cardLines(summary, 4)).toEqual(['QUESTS 1 / 4', '4 ITEMS']);
  expect(sheetRows(summary, 4)).toEqual([{ label: 'QUESTS', value: '1 / 4 → 0 / 4' }, { label: 'INVENTORY', value: '4 ITEMS → EMPTY' }, { label: 'FLAGS', value: 'RESET' }]);
  expect(cardLines(previewNewGame(store, id))[0]).toBe('QUESTS STARTED'); // legacy flags without a quest catalogue
  expect(resetNewGame(store, id).applied).toBe(true);
  expect(cardLines(previewNewGame(store, id))).toEqual(['QUESTS 0 DONE', 'EMPTY']);
});
