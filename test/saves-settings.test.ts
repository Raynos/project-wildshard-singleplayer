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
  // G258 replaces copies 1/4/5 with canonical shard instances; remaining copies keep their stable ids.
  expect(shipped.map((c) => [c.instance.id, c.name, c.listed])).toEqual([
    ['driftwood-isle', 'Driftwood Isle', true], ['pine-hollow', 'Pine Hollow', true], ['template-solo', 'Template shard', false],
    ['template-2', 'Template shard · COPY 2', false], ['template-3', 'Template shard · COPY 3', false],
  ]);
  expect(dev.map((c) => c.instance.id)).toEqual(shipped.map((c) => c.instance.id));
  // Grid copies appear for current/progress saves, rather than as empty listed cards, in either mode.
  expect(dev.slice(3)).toEqual(shipped.slice(3));
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
