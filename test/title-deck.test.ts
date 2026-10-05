// src/game/titleDeck.ts — the ONE title deck (E318): the cold launch and "Exit to main" show the same cards, and those cards
// say what the ChunkDefs say (the title's list may not import a def: it is written out, so this keeps it honest).
// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SHARDS } from '../src/shards.generated';
import { findChunk } from '../src/game/shard/registry';
import { isDev, setDev } from '../src/engine/core/devMode';
import { buildTitleDeck, titleCards } from '../src/game/titleDeck';


afterEach(() => { setDev(false); });

describe('title deck cards', () => {
  it('renders authored card names and blurbs literally without changing the card actions or badge', () => {
    const base = titleCards()[0]; if (base === undefined) throw new Error('Missing first card');
    const hostile = '<img src=x onerror="bad()"><script>bad()</script>& literal', onEnter = vi.fn<() => void>();
    const card = { ...base, name: hostile, label: hostile };
    const deck = buildTitleDeck({ cards: [card], active: card.slug, onEnter, onExplore: () => undefined, onSettings: () => undefined });
    const selected = deck.root.querySelector<HTMLButtonElement>('.ws-menu-card');
    expect(selected?.querySelector('b')?.textContent).toBe(hostile); expect(selected?.querySelector('small')?.textContent).toBe(hostile);
    expect(deck.root.querySelector('img,script,[onerror]')).toBeNull(); expect(selected?.dataset['i']).toBe('0');
    deck.activate(); expect(onEnter).toHaveBeenCalledOnce(); deck.dispose();
  });
  it('uses Developer mode to hide the template or show it last with its ribbon', () => {
    setDev(false);
    expect(isDev()).toBe(false);
    expect(titleCards().some((card) => card.slug === '_template')).toBe(false);
    setDev(true);
    expect(titleCards().at(-1)?.slug).toBe('_template');
    expect(titleCards().at(-1)?.badge).toBe('Developer only');
  });
  it('lists every shard once, in the registry order (the playable shards, then the prototypes)', () => {
    expect(titleCards().map((c) => c.slug)).toEqual(SHARDS.filter((c) => c.status !== 'hidden').map((c) => c.slug));
  });

  it('renders the developer ribbon only on a revealed hidden card (Select a shard stays today\'s flow, G58)', () => {
    setDev(true);
    const deck = buildTitleDeck({ cards: titleCards(), active: null, onEnter: () => undefined, onExplore: () => undefined, onSettings: () => undefined });
    const ribbons = [...deck.root.querySelectorAll('.ws-menu-card-exp')].filter((el) => el.textContent === 'DEVELOPER ONLY');
    expect(ribbons).toHaveLength(1);
    expect(ribbons[0]?.closest('button')?.textContent).toContain('Template shard');
    deck.dispose();
  });

  it('each card carries its ShardManifest\'s name, blurb, badge and art', () => {
    for (const card of titleCards()) {
      const def = findChunk(card.slug);
      expect(def, card.slug).toBeDefined();
      if (!def) continue;
      expect(card.name).toBe(def.name);
      expect(card.label).toBe(def.biome);
      expect(card.badge).toBe(def.status === 'earlyAccess' ? 'Early access' : def.status === 'experimental' ? 'Experimental' : undefined);
      expect([card.thumbnail, card.heroPortrait, card.heroLandscape]).toEqual([def.card.thumb, def.card.portrait, def.card.landscape]);
    }
  });

  it('a card\'s blurb is a player\'s line: no grid coordinates, no chunk size (E318 row 19)', () => {
    for (const card of titleCards()) expect(card.label).not.toMatch(/\(|\d+ ?m\b|shard/);
  });
});

for (const dev of [false, true]) {
  it(`gates every experimental card and both entry paths with Developer ${dev}`, () => {
    setDev(dev);
    const onEnter = vi.fn<() => void>(), onExplore = vi.fn<() => void>();
    const deck = buildTitleDeck({ cards: titleCards(), active: 'nine-dragon-stack', onEnter, onExplore, onSettings: () => undefined });
    document.body.append(deck.root);
    for (const [index, card] of deck.cards.entries()) {
      deck.select(index, false);
      const restricted = card.badge === 'Experimental' || card.badge === 'Developer only';
      // Developer unlocks every card, as today (Select a shard is the existing flow, G58)
      const enabled = dev || !restricted;
      const play = deck.root.querySelector<HTMLButtonElement>('.ws-menu-play');
      const explore = deck.root.querySelector<HTMLButtonElement>('.ws-menu-explore');
      expect(play?.disabled, card.slug).toBe(!enabled);
      // E386: EXPLORE WORLD is developer-only, and hidden for a world that can't be entered
      const explorable = dev && enabled;
      expect(explore?.disabled, card.slug).toBe(!explorable);
      expect(explore?.classList.contains('off'), card.slug).toBe(!explorable);
      expect(deck.root.querySelector('.ws-menu-play b')?.textContent).toBe(enabled ? 'Enter world' : 'Coming soon');
      const cardEl = deck.root.querySelectorAll('.ws-menu-card')[index];
      expect(cardEl?.querySelector('.ws-menu-card-tag')?.textContent ?? null, card.slug).toBe(enabled ? card.slug === 'nine-dragon-stack' ? 'Loaded' : 'Load' : null);
      // E386: a locked world's tape reads COMING SOON, not EXPERIMENTAL
      if (!enabled) expect(cardEl?.querySelector('.ws-menu-card-exp')?.textContent, card.slug).toBe('Coming soon');
      onEnter.mockClear(); onExplore.mockClear();
      deck.activate(); play?.click(); explore?.click();
      expect(onEnter).toHaveBeenCalledTimes(enabled ? 2 : 0);
      expect(onExplore).toHaveBeenCalledTimes(explorable ? 1 : 0);
    }
    deck.dispose(); deck.root.remove();
  });
}
it('rejects stale developer cards through programmatic activation after switching off', () => {
  setDev(true);
  const onEnter = vi.fn<() => void>(), onExplore = vi.fn<() => void>();
  const deck = buildTitleDeck({ cards: titleCards(), active: null, onEnter, onExplore, onSettings: () => undefined });
  setDev(false);
  for (const card of deck.cards.filter((entry) => entry.badge === 'Experimental' || entry.badge === 'Developer only')) {
    deck.select(deck.cards.indexOf(card), false);
    deck.activate();
    deck.root.querySelector<HTMLElement>('.ws-menu-explore')?.dispatchEvent(new MouseEvent('click'));
  }
  expect(onEnter).not.toHaveBeenCalled(); expect(onExplore).not.toHaveBeenCalled();
  deck.dispose();
});

// WORLDCLAW-TOOLS W9 (J19, J38, J56): a draft's COMING SOON card follows the shards; it has no world, so its one button
// opens the draft on the drafts site, and the HUD's `deck.cards` stays the shards only.
describe('a draft\'s COMING SOON card', () => {
  for (const dev of [false, true]) {
    it(`shows Thin Ice after the shards and opens the drafts site with Developer ${dev}`, () => {
      setDev(dev);
      const onEnter = vi.fn<() => void>(), onExplore = vi.fn<() => void>();
      const open = vi.spyOn(window, 'open').mockImplementation(() => null);
      const cards = titleCards();
      const deck = buildTitleDeck({ cards, active: null, onEnter, onExplore, onSettings: () => undefined });
      document.body.append(deck.root);
      expect(deck.cards.map((c) => c.slug)).toEqual(cards.map((c) => c.slug));
      const els = deck.root.querySelectorAll('.ws-menu-card');
      expect(els).toHaveLength(cards.length + 1);
      const draftEl = els[cards.length];
      expect(draftEl?.textContent).toContain('Thin Ice');
      expect(draftEl?.textContent).toContain('The ferry is gone and the fjord has frozen.');
      expect(draftEl?.querySelector('.ws-menu-card-exp')?.textContent).toBe(dev ? 'Draft · P6' : 'Coming soon');
      expect(draftEl?.querySelector('.ws-menu-card-tag')).toBeNull();
      deck.select(cards.length, false);
      expect(deck.cards[deck.index]).toBeUndefined();
      const play = deck.root.querySelector<HTMLButtonElement>('.ws-menu-play');
      expect(play?.disabled).toBe(false);
      expect(deck.root.querySelector('.ws-menu-play b')?.textContent).toBe(dev ? 'Draft mode' : 'Follow the build');
      expect(deck.root.querySelector('.ws-menu-explore')?.classList.contains('off')).toBe(true);
      deck.activate();
      expect(open).toHaveBeenCalledWith('https://wildshard-drafts.vercel.app/#/thin-ice', '_blank', 'noopener');
      expect(onEnter).not.toHaveBeenCalled();
      expect(onExplore).not.toHaveBeenCalled();
      deck.dispose(); deck.root.remove();
    });
  }
});
