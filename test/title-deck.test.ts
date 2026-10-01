// src/game/titleDeck.ts — the ONE title deck (E318): the cold launch and "Exit to main" show the same cards, and those cards
// say what the ChunkDefs say (the title's list may not import a def: it is written out, so this keeps it honest).
import { describe, expect, it } from 'vitest';
import { SHARDS, findChunk } from '#game/shard/registry';
import { titleCards } from '#game/titleDeck';

describe('title deck cards', () => {
  it('lists every shard once, in the registry order (the playable shards, then the prototypes)', () => {
    expect(titleCards().map((c) => c.slug)).toEqual(SHARDS.map((c) => c.slug));
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
