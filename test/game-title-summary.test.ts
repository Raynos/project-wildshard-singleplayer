// @vitest-environment happy-dom
import { afterEach, expect, it } from 'vitest';
import { progressSave } from '#game/saves';
import { saveSetting } from '#engine/ui/Settings';
import { buildTitleDeck, titleCards } from '#game/titleDeck';
import { updateSummary } from '#game/summary';

function fixture() {
  const deck = buildTitleDeck({ cards: titleCards(), active: null, onEnter: () => undefined, onExplore: () => undefined, onSettings: () => undefined });
  document.body.append(deck.root); return deck;
}
afterEach(() => { saveSetting('titleSummary', 'a'); document.body.replaceChildren(); });
it('keeps the strip hidden when every shard is unvisited and adds no controls', () => {
  const deck = fixture();
  expect(deck.root.querySelector<HTMLElement>('.ws-title-summary')?.hidden).toBe(true);
  expect(deck.root.querySelectorAll('.ws-title-summary button')).toHaveLength(0);
  deck.dispose();
});
it('shows known and unknown counts in deck order, total feats, and live A/B variants', () => {
  progressSave.write({ earned: ['castaway', 'glass'], counts: {}, title: null, playS: 3 }, 'driftwood-isle');
  updateSummary('pine-hollow', { earned: ['deer5', 'boar5', 'lanterns'], playS: 620 }, 8);
  const deck = fixture(), summary = deck.root.querySelector<HTMLElement>('.ws-title-summary');
  expect(summary?.hidden).toBe(false);
  expect([...deck.root.querySelectorAll('.ws-title-summary-line span:first-child')].map((el) => el.textContent)).toEqual(deck.cards.map((card) => card.name));
  expect(summary?.textContent).toContain('2 FEATS');
  expect(summary?.textContent).toContain('3 / 8 FEATS');
  expect(summary?.textContent).toContain('NOT VISITED');
  expect(summary?.textContent).toContain('WILDSHARD · 5 FEATS');
  expect(summary?.dataset['variant']).toBe('a');
  saveSetting('titleSummary', 'b'); expect(summary?.dataset['variant']).toBe('b');
  deck.dispose(); saveSetting('titleSummary', 'a'); expect(summary?.dataset['variant']).toBe('b');
});
