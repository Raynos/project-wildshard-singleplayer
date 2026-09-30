// src/ui/titleDeck.ts — the ONE title deck (E318): the cold launch and "Exit to main" show the same cards, and those cards
// say what the ChunkDefs say (the title's list may not import a def: it is written out, so this keeps it honest).
import { describe, expect, it } from 'vitest';
import { CHUNKS, PROTOTYPES, findChunk } from '../src/chunks/registry';
import { TITLE_CARDS } from '../src/ui/titleDeck';

describe('title deck cards', () => {
  it('lists every shard once, in the registry order (the playable shards, then the prototypes)', () => {
    expect(TITLE_CARDS.map((c) => c.slug)).toEqual([...CHUNKS, ...PROTOTYPES].map((c) => c.slug));
  });

  it('each card carries its ChunkDef\'s name, blurb, badge and art', () => {
    for (const card of TITLE_CARDS) {
      const def = findChunk(card.slug);
      expect(def, card.slug).toBeDefined();
      if (!def) continue;
      expect(card.name).toBe(def.displayName);
      expect(card.label).toBe(def.biome);
      expect(card.badge).toBe(def.earlyAccess === true ? 'Early access' : def.experimental === true ? 'Experimental' : undefined);
      expect([card.thumbnail, card.heroPortrait, card.heroLandscape]).toEqual([def.thumbnail, def.heroPortrait, def.heroLandscape]);
    }
  });

  it('a card\'s blurb is a player\'s line: no grid coordinates, no chunk size (E318 row 19)', () => {
    for (const card of TITLE_CARDS) expect(card.label).not.toMatch(/\(|\d+ ?m\b|shard/);
  });
});
