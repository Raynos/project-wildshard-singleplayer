// @vitest-environment happy-dom
import { afterEach, expect, it } from 'vitest';
import { progressSave } from '#game/saves';
import { buildTitleDeck, titleCards, type TitleCard } from '#game/titleDeck';
import { updateSummary } from '#game/summary';

function fixture(active: string | null = null, cards: readonly TitleCard[] = titleCards()) {
  const deck = buildTitleDeck({ cards, active, onEnter: () => undefined, onExplore: () => undefined, onSettings: () => undefined });
  document.body.append(deck.root); return deck;
}
function text(deck: ReturnType<typeof fixture>): string[] {
  return [...deck.root.querySelectorAll('.ws-title-summary > *')].map((el) => el.textContent);
}
function seed(): void {
  progressSave.write({ earned: ['castaway', 'glass'], counts: {}, title: null, playS: 3 }, 'driftwood-isle');
  updateSummary('pine-hollow', { earned: ['deer5', 'boar5', 'lanterns'], playS: 620 }, 8);
}
afterEach(() => { document.body.replaceChildren(); });
it('shows the selected unvisited shard and zero total on a fresh save, with no controls', () => {
  const deck = fixture();
  expect(deck.root.querySelector<HTMLElement>('.ws-title-summary')?.hidden).toBe(false);
  expect(text(deck)).toEqual(['DRIFTWOOD ISLE · NOT VISITED', 'WILDSHARD · 0 FEATS']);
  expect(deck.root.querySelectorAll('.ws-title-summary button')).toHaveLength(0);
  expect(deck.root.querySelector<HTMLElement>('.ws-title-summary')?.dataset['variant']).toBeUndefined();
  deck.dispose();
});
it('updates only the selected line on carousel selection, with a stable total for known and rebuilt saves', () => {
  seed();
  const deck = fixture();
  expect(text(deck)).toEqual(['DRIFTWOOD ISLE · 2 FEATS', 'WILDSHARD · 5 FEATS']);
  deck.select(deck.cards.findIndex((card) => card.slug === 'pine-hollow'), false);
  expect(text(deck)).toEqual(['PINE HOLLOW · 3 FEATS', 'WILDSHARD · 5 FEATS']);
  deck.select(deck.cards.findIndex((card) => card.slug === 'nalati-grasslands'), false);
  expect(text(deck)).toEqual(['NALATI GRASSLANDS · NOT VISITED', 'WILDSHARD · 5 FEATS']);
  deck.select(0, false);
  expect(text(deck)).toEqual(['DRIFTWOOD ISLE · 2 FEATS', 'WILDSHARD · 5 FEATS']);
  deck.dispose();
});
it('starts on the active shard and follows a dot click without a reload', () => {
  seed();
  const deck = fixture('pine-hollow');
  expect(text(deck)).toEqual(['PINE HOLLOW · 3 FEATS', 'WILDSHARD · 5 FEATS']);
  deck.root.querySelector<HTMLElement>('.ws-menu-dots i[data-i="0"]')?.click();
  expect(text(deck)).toEqual(['DRIFTWOOD ISLE · 2 FEATS', 'WILDSHARD · 5 FEATS']);
  deck.dispose();
});
it('counts every visible registry shard even when the deck is a subset, and excludes hidden saved progress', () => {
  seed();
  updateSummary('_template', { earned: ['hidden-a', 'hidden-b', 'hidden-c'], playS: 8 }, 3);
  const cards = titleCards(true);
  const deck = fixture('pine-hollow', cards.filter((card) => card.slug === 'pine-hollow' || card.slug === '_template'));
  expect(text(deck)).toEqual(['PINE HOLLOW · 3 FEATS', 'WILDSHARD · 5 FEATS']);
  deck.select(deck.cards.findIndex((card) => card.slug === '_template'), false);
  expect(text(deck)).toEqual(['TEMPLATE SHARD · NOT VISITED', 'WILDSHARD · 5 FEATS']);
  deck.dispose();
});
