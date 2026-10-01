// src/game/titleDeck.ts — the ONE title deck (E318): the cold launch and "Exit to main" show the same cards, and those cards
// say what the ChunkDefs say (the title's list may not import a def: it is written out, so this keeps it honest).
// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { SHARDS, findChunk } from '#game/shard/registry';
import { isDev, setDev } from '#engine';
import { buildTitleDeck, titleCards } from '#game/titleDeck';

afterEach(() => { setDev(false); });

describe('title deck cards', () => {
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

  it('renders the developer ribbon only on a revealed hidden card', () => {
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
