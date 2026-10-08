// SHARD-PLATFORM SF65 (G237–G241): LEGACY / SHARDFILE entry from SHARD SELECT with Developer on; the public build unchanged.
// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SaveStore } from '../src/engine/saves/store';
import { setDev } from '../src/engine/core/devMode';
import { SHARDS } from '../src/shards.generated';
import { shardEntries, shardEntry, shardEntryChoices } from '../src/game/shard/entryMode';
import { buildTitleDeck, titleCards } from '../src/game/titleDeck';
import { GAME_STRINGS } from '../src/game/strings';
import { PORT_SHARES } from '../src/game/shard/portShares.generated';

class MemoryStorage {
  private data = new Map<string, string>();
  get length(): number { return this.data.size; }
  key(index: number): string | null { return [...this.data.keys()][index] ?? null; }
  getItem(key: string): string | null { return this.data.get(key) ?? null; }
  setItem(key: string, value: string): void { this.data.set(key, value); }
  removeItem(key: string): void { this.data.delete(key); }
  clear(): void { this.data.clear(); }
}

afterEach(() => { setDev(false); });

describe('SF65: what a shard can be entered as', () => {
  it('derives shardfile-only for a shard with no TypeScript plugin and TypeScript-only for an undeclared one', () => {
    expect(shardEntries({})).toEqual({ legacy: false, shardfile: true, public: 'shardfile' });
    const plugin = SHARDS.find((m) => m.load !== undefined);
    if (plugin?.load === undefined) throw new Error('Missing a plugin shard');
    expect(shardEntries({ load: plugin.load })).toEqual({ legacy: true, shardfile: false, public: 'legacy' });
    const declared = { legacy: true, shardfile: true, public: 'legacy' } as const;
    expect(shardEntries({ entries: declared })).toBe(declared);
  });

  it('every manifest yields a valid entry set whose public entry exists', () => {
    for (const m of SHARDS) {
      const e = shardEntries(m);
      expect(e.legacy || e.shardfile, m.slug).toBe(true);
      expect(e.public === 'legacy' ? e.legacy : e.shardfile, m.slug).toBe(true);
    }
  });

  it('boots the public entry with Developer off, and this tab\'s valid choice with Developer on', () => {
    const local = new MemoryStorage(), session = new MemoryStorage();
    const choices = shardEntryChoices(new SaveStore({ local, session }));
    const both = { slug: 'pine-hollow', entries: { legacy: true, shardfile: true, public: 'legacy' } } as const;
    const legacyOnly = { slug: 'nine-dragon-stack', entries: { legacy: true, shardfile: false, public: 'legacy' } } as const;
    expect(shardEntry(both, true, () => choices)).toBe('legacy');
    choices.choose('pine-hollow', 'shardfile'); choices.choose('nine-dragon-stack', 'shardfile');
    expect(shardEntry(both, true, () => choices)).toBe('shardfile');
    expect(shardEntry(both, false, () => choices)).toBe('legacy'); // the public build never reads the choice
    expect(shardEntry(legacyOnly, true, () => choices)).toBe('legacy'); // NOT YET: a choice the shard lacks falls back
    // session scope: a reload in the tab keeps it, a fresh launch starts on the public entry
    expect(shardEntry(both, true, () => shardEntryChoices(new SaveStore({ local, session })))).toBe('shardfile');
    expect(shardEntry(both, true, () => shardEntryChoices(new SaveStore({ local, session: new MemoryStorage() })))).toBe('legacy');
  });
});

describe('SF65: SHARD SELECT\'s LEGACY / SHARDFILE buttons', () => {
  it('words the port badge from the SF6 share', () => {
    expect(GAME_STRINGS.entry.ported(0.0337)).toBe('3% PORTED');
    expect(GAME_STRINGS.entry.ported(0.0042)).toBe('<1% PORTED');
    expect(GAME_STRINGS.entry.ported(0.9094)).toBe('91% PORTED');
    expect(GAME_STRINGS.entry.ported(0)).toBe('0% PORTED');
  });

  it('keeps one ENTER WORLD and no badge with Developer off', () => {
    const onEnter = vi.fn<(card: unknown, entry: string) => void>();
    const deck = buildTitleDeck({ cards: titleCards(false), active: null, onEnter, onExplore: () => undefined, onSettings: () => undefined });
    document.body.append(deck.root);
    expect(deck.root.querySelectorAll('.ws-menu-card-port')).toHaveLength(0);
    const shardfile = deck.root.querySelector<HTMLButtonElement>('.ws-menu-shardfile');
    expect(shardfile?.hidden).toBe(true);
    expect(deck.root.querySelector('.ws-menu-play b')?.textContent).toBe('Enter world');
    deck.activate();
    const card = deck.cards[0];
    if (card === undefined) throw new Error('Missing first card');
    expect(onEnter).toHaveBeenCalledWith(card, shardEntries(SHARDS.find((m) => m.slug === card.slug) ?? {}).public);
    deck.dispose(); deck.root.remove();
  });

  it('offers LEGACY and SHARDFILE on every card with Developer on, disabled where the shard lacks one', () => {
    setDev(true);
    const onEnter = vi.fn<(card: unknown, entry: string) => void>();
    const deck = buildTitleDeck({ cards: titleCards(true), active: null, onEnter, onExplore: () => undefined, onSettings: () => undefined });
    document.body.append(deck.root);
    const play = deck.root.querySelector<HTMLButtonElement>('.ws-menu-play'), shardfile = deck.root.querySelector<HTMLButtonElement>('.ws-menu-shardfile');
    if (play === null || shardfile === null) throw new Error('Missing entry buttons');
    expect(deck.root.querySelectorAll('.ws-menu-card-port')).toHaveLength(deck.cards.length);
    for (const [index, card] of deck.cards.entries()) {
      deck.select(index, false);
      const entries = card.entries;
      if (entries === undefined) throw new Error(`Missing entries: ${card.slug}`);
      const badge = deck.root.querySelectorAll('.ws-menu-card')[index]?.querySelector('.ws-menu-card-port')?.textContent;
      expect(badge, card.slug).toBe(GAME_STRINGS.entry.ported(PORT_SHARES[card.slug] ?? -1));
      expect(play.querySelector('b')?.textContent, card.slug).toBe('LEGACY');
      expect(play.disabled, card.slug).toBe(!entries.legacy);
      expect(play.querySelector('small')?.textContent, card.slug).toBe(entries.legacy ? 'ORIGINAL TYPESCRIPT' : 'SHARDFILE ONLY · NO LEGACY');
      expect(shardfile.hidden, card.slug).toBe(false);
      expect(shardfile.disabled, card.slug).toBe(!entries.shardfile);
      expect(shardfile.querySelector('small')?.textContent, card.slug).toBe(entries.shardfile ? 'CURRENT PORT STATE' : 'NOT YET');
      onEnter.mockClear();
      play.click(); shardfile.click();
      expect(onEnter.mock.calls, card.slug).toEqual([...entries.legacy ? [[card, 'legacy']] : [], ...entries.shardfile ? [[card, 'shardfile']] : []]);
    }
    // G241: the template is the live shardfile-only card
    expect(deck.cards.find((card) => card.slug === '_template')?.entries).toEqual({ legacy: false, shardfile: true, public: 'shardfile' });
    deck.dispose(); deck.root.remove();
  });
});
