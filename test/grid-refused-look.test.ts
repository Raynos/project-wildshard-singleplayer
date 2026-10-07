// SF58 (12), G167: what a shard that can't load shows in SHARD SELECT: its card is dimmed with an amber UNAVAILABLE badge
// and the reason, and cannot be entered. (Its grid cell shows G217's cell screen: test/grid-cell-screen.test.ts.)
// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { buildTitleDeck, titleCards } from '../src/game/titleDeck';

describe('G167: the UNAVAILABLE card in SHARD SELECT', () => {
  it('is dimmed, badged UNAVAILABLE, shows the reason, keeps the save and cannot be entered', () => {
    const cards = titleCards(false, () => null, (slug) => (slug === 'driftwood-isle' ? 'too-big' : null));
    expect(cards.find((card) => card.slug === 'driftwood-isle')?.unavailable).toBe('too-big');
    const onEnter = vi.fn<() => void>();
    const deck = buildTitleDeck({ cards, active: null, onEnter, onExplore: () => undefined, onSettings: () => undefined });
    const index = deck.cards.findIndex((card) => card.slug === 'driftwood-isle');
    deck.select(index, false);
    const card = deck.root.querySelectorAll<HTMLElement>('.ws-menu-card')[index];
    expect(card?.classList.contains('ws-menu-card-upgrade')).toBe(true); // the G86 dimming
    expect(card?.classList.contains('ws-menu-card-unavailable')).toBe(true);
    expect(card?.querySelector('.ws-menu-card-needs')?.textContent).toBe('UNAVAILABLE');
    expect(card?.querySelector('small')?.textContent).toBe('TOO BIG FOR THIS DEVICE');
    const play = deck.root.querySelector<HTMLButtonElement>('.ws-menu-play');
    expect(play?.disabled).toBe(true);
    expect(play?.querySelector('b')?.textContent).toBe('UNAVAILABLE');
    expect(play?.querySelector('small')?.textContent).toBe('YOUR SAVE IS KEPT');
    deck.activate(); expect(onEnter).not.toHaveBeenCalled();
    deck.dispose();
  });
  it('G86\'s NEEDS UPGRADE card wins over a session refusal, and other shards stay enterable', () => {
    const cards = titleCards(false, (slug) => (slug === 'driftwood-isle' ? 0 : null), () => 'safety');
    expect(cards.find((card) => card.slug === 'driftwood-isle')?.unavailable).toBeUndefined();
    expect(titleCards(false, () => null, () => null).every((card) => card.unavailable === undefined)).toBe(true);
  });
});
