// SF21a (SHARD-PLATFORM §3.3, G58, G61, R3-C5): the main menu's two entries. Select a shard enters what the §3.3 table
// allows per mode; EXPERIMENTAL Wildshard shows with Developer on (until SF22's gates) and boots only from a one-shot intent.
// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SaveStore } from '../src/engine/saves/store';
import { setDev } from '../src/engine/core/devMode';
import { GridAssembly } from '../src/game/grid/assembly';
import { gridIntents } from '../src/game/grid/intent';
import { DEVSERVER, gridEntryShown, gridMode, selectEnters, selectExplores, type MenuMode } from '../src/game/grid/menu';
import { GridCellEvents, gridHome } from '../src/game/grid/boot';
import { devserverCellOn, installGridDebug } from '../src/game/grid/debug';
import { levelDebugRows } from '../src/engine/ui/debugOptions';
import { shards } from '../src/game/shard/list';
import { buildTitleDeck, titleCards } from '../src/game/titleDeck';

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

const MODES = {
  shipped: { developer: false, devserver: false },
  developer: { developer: true, devserver: false },
  devserver: { developer: false, devserver: true },
  both: { developer: true, devserver: true },
} satisfies Record<string, MenuMode>;

describe('§3.3 table: the assembly per mode and both switches together', () => {
  const cells = (mode: MenuMode, cell = true) => new GridAssembly(gridMode(cell, mode)).cells;
  const count = (mode: MenuMode, cell = true) => {
    const rows = cells(mode, cell);
    return { shards: rows.filter((row) => row.slug !== '_template').length, templates: rows.filter((row) => row.slug === '_template').length };
  };
  it('shipped: 3 shards + 6 templates; Developer: 5 + 4; DEVSERVER adds its cell at (+1, −1), and its row swaps it back', () => {
    expect(count(MODES.shipped)).toEqual({ shards: 3, templates: 6 });
    expect(count(MODES.developer)).toEqual({ shards: 5, templates: 4 });
    expect(count(MODES.devserver)).toEqual({ shards: 4, templates: 5 });
    expect(count(MODES.both)).toEqual({ shards: 6, templates: 3 });
    expect(count(MODES.both, false)).toEqual({ shards: 5, templates: 4 });
    expect(cells(MODES.both).find((row) => row.cell[0] === 1 && row.cell[1] === -1)?.slug).toBe('nine-dragon-stack');
    expect(cells(MODES.both, false).find((row) => row.cell[0] === 1 && row.cell[1] === -1)?.slug).toBe('_template');
  });
  it('the grid always boots into the catalogue home cell (0, 0)', () => {
    for (const mode of Object.values(MODES)) expect(gridHome(mode).instance).toBe('driftwood-isle');
  });
  it('Select a shard enters the table\'s column in each mode', () => {
    const restricted = (slug: string): boolean => { const m = shards().find((entry) => entry.slug === slug); return m === undefined || m.status === 'experimental' || m.status === 'hidden' || slug.startsWith('_'); };
    const enters = (mode: MenuMode): string[] => shards().map((m) => m.slug).filter((slug) => selectEnters(slug, restricted(slug), mode)).sort();
    expect(enters(MODES.shipped)).toEqual(['driftwood-isle', 'nalati-grasslands', 'pine-hollow']);
    expect(enters(MODES.developer)).toEqual(shards().map((m) => m.slug).sort()); // today's switch: every card (G58)
    expect(enters(MODES.devserver)).toEqual(shards().map((m) => m.slug).sort());
    expect(selectExplores('driftwood-isle', false, MODES.shipped)).toBe(false);
    expect(selectExplores('driftwood-isle', false, MODES.developer)).toBe(true);
    expect(selectExplores('_template', true, MODES.devserver)).toBe(true);
    expect(selectExplores('nine-dragon-stack', true, MODES.developer)).toBe(true);
  });
  it('EXPERIMENTAL Wildshard shows only with Developer on until SF22\'s gates pass, then to everyone', () => {
    expect(gridEntryShown(MODES.shipped)).toBe(false);
    expect(gridEntryShown(MODES.devserver)).toBe(false);
    expect(gridEntryShown(MODES.developer)).toBe(true);
    expect(gridEntryShown(MODES.shipped, true)).toBe(true);
    expect(DEVSERVER).toBe(false); // no define under Node: the production value
  });
});

describe('the one-shot tap intent (R3-C5)', () => {
  const fixture = () => {
    const local = new MemoryStorage(), session = new MemoryStorage();
    let at = 1_000_000;
    const intents = gridIntents(new SaveStore({ local, session }), () => at);
    return { local, session, intents, advance: (ms: number) => { at += ms; } };
  };
  it('is consumed once at boot: a reload has none', () => {
    const f = fixture();
    expect(f.intents.set({ instance: 'driftwood-isle', slug: 'driftwood-isle' })).toBe(true);
    expect(f.intents.consume('driftwood-isle')?.instance).toBe('driftwood-isle');
    expect(f.intents.consume('driftwood-isle')).toBeNull();
  });
  it('survives a lost session through the device copy, and the consume removes both copies', () => {
    const f = fixture();
    f.intents.set({ instance: 'driftwood-isle', slug: 'driftwood-isle' });
    f.session.clear();
    expect(f.intents.consume('driftwood-isle')?.slug).toBe('driftwood-isle');
    expect(f.intents.consume('driftwood-isle')).toBeNull();
  });
  it('expires after 60 s and never boots another shard', () => {
    const f = fixture();
    f.intents.set({ instance: 'driftwood-isle', slug: 'driftwood-isle' });
    f.advance(60_001);
    expect(f.intents.consume('driftwood-isle')).toBeNull();
    f.intents.set({ instance: 'driftwood-isle', slug: 'driftwood-isle' });
    expect(f.intents.consume('pine-hollow')).toBeNull();
    expect(f.intents.consume('driftwood-isle')).toBeNull(); // the mismatched boot consumed it too
  });
});

describe('the title deck\'s two entries', () => {
  for (const dev of [false, true]) {
    it(`Developer ${dev}: Select a shard ${dev ? 'and EXPERIMENTAL Wildshard' : 'alone (today\'s title, unchanged)'}`, () => {
      setDev(dev);
      const onGrid = vi.fn<() => void>();
      const deck = buildTitleDeck({ cards: titleCards(), active: null, onEnter: () => undefined, onExplore: () => undefined, onSettings: () => undefined, onGrid });
      document.body.append(deck.root);
      deck.start();
      expect(deck.root.dataset['entry']).toBe('select');
      const select = deck.root.querySelector<HTMLButtonElement>('.ws-menu-entry-select');
      const grid = deck.root.querySelector<HTMLButtonElement>('.ws-menu-entry-grid');
      expect(grid?.textContent ?? null).toBe(dev ? 'EXPERIMENTAL Wildshard' : null);
      expect(select?.textContent ?? null).toBe(dev ? 'Select a shard' : null);
      if (dev) expect(document.activeElement).toBe(select);
      grid?.click();
      expect(onGrid).toHaveBeenCalledTimes(dev ? 1 : 0);
      deck.dispose(); deck.root.remove();
    });
  }
  it('a deck without the grid wiring never shows the entry', () => {
    setDev(true);
    const deck = buildTitleDeck({ cards: titleCards(), active: null, onEnter: () => undefined, onExplore: () => undefined, onSettings: () => undefined });
    expect(deck.root.querySelector('.ws-menu-entries')).toBeNull();
    deck.dispose();
  });
});

describe('a DEVSERVER build (§3.3)', () => {
  it('Select a shard enters and explores every shard without Developer mode; the grid entry stays hidden', () => {
    const deck = buildTitleDeck({ cards: titleCards(true), active: null, onEnter: () => undefined, onExplore: () => undefined, onSettings: () => undefined, onGrid: () => undefined, mode: () => MODES.devserver });
    document.body.append(deck.root);
    for (const [index, card] of deck.cards.entries()) {
      deck.select(index, false);
      expect(deck.root.querySelector<HTMLButtonElement>('.ws-menu-play')?.disabled, card.slug).toBe(false);
      expect(deck.root.querySelector<HTMLButtonElement>('.ws-menu-explore')?.disabled, card.slug).toBe(false);
    }
    expect([...deck.root.querySelectorAll('.ws-menu-card-exp')].filter((el) => el.textContent === 'DEVELOPER ONLY')).toHaveLength(1);
    expect(deck.root.querySelector('.ws-menu-entry-grid')).toBeNull();
    deck.dispose(); deck.root.remove();
  });
  it('DEVSERVER with Developer: both entries', () => {
    const deck = buildTitleDeck({ cards: titleCards(true), active: null, onEnter: () => undefined, onExplore: () => undefined, onSettings: () => undefined, onGrid: () => undefined, mode: () => MODES.both });
    expect(deck.root.querySelector('.ws-menu-entry-select')?.textContent).toBe('Select a shard');
    expect(deck.root.querySelector('.ws-menu-entry-grid')?.textContent).toBe('EXPERIMENTAL Wildshard');
    deck.dispose();
  });
  it('the DEVSERVER cell row: on by default, swapped to the template at the next grid start, gone when uninstalled', () => {
    installGridDebug(false)(); // a production build installs nothing
    expect(levelDebugRows().some((entry) => entry.id === 'gridDevserverCell')).toBe(false);
    const remove = installGridDebug(true);
    const row = levelDebugRows().find((entry) => entry.id === 'gridDevserverCell');
    expect(row?.group).toBe('tools');
    expect(row?.choices().map((choice) => choice.text)).toEqual(['Nine Dragon Stack', 'Template']);
    expect(row?.label).toBe('EXPERIMENTAL Wildshard (+1, −1)');
    expect(row?.get()).toBe('on');
    const at = (on: boolean) => new GridAssembly(gridMode(on, MODES.both)).cells.find((cell) => cell.cell[0] === 1 && cell.cell[1] === -1)?.slug;
    expect(at(devserverCellOn(true))).toBe('nine-dragon-stack');
    row?.set('off');
    expect(at(devserverCellOn(true))).toBe('_template');
    expect(devserverCellOn(false)).toBe(false);
    row?.set('on');
    remove();
    expect(levelDebugRows().some((entry) => entry.id === 'gridDevserverCell')).toBe(false);
  });
});

describe('the inside-cell enter / leave seam (SF46 consumes it; the grid client produces it)', () => {
  it('passes stable instance ids, leaves before the next enter, and replays the current cell to a late subscriber', () => {
    const cells = new GridCellEvents(), log: string[] = [];
    cells.enter({ instance: 'driftwood-isle', slug: 'driftwood-isle' });
    const offEnter = cells.onEnter((cell) => { log.push(`enter ${cell.instance}`); });
    const offLeave = cells.onLeave((cell) => { log.push(`leave ${cell.instance}`); });
    cells.enter({ instance: 'driftwood-isle', slug: 'driftwood-isle' }); // already inside: no event
    cells.enter({ instance: 'template-3', slug: '_template' });
    cells.leave(); cells.leave();
    offEnter(); offLeave();
    cells.enter({ instance: 'pine-hollow', slug: 'pine-hollow' });
    expect(log).toEqual(['enter driftwood-isle', 'leave driftwood-isle', 'enter template-3', 'leave template-3']);
    expect(cells.cell?.instance).toBe('pine-hollow');
  });
});
