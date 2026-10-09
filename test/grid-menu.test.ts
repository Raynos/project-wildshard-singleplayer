// SF21a (SHARD-PLATFORM §3.3, G58, G61, G79, G86, G88, R3-C5): the Wildshard main menu. SHARD SELECT opens today's deck,
// which enters what the §3.3 table allows per mode; INFINITE WILDSHARD shows with Developer on (until SF22's gates) and
// boots only from a one-shot intent; a shard whose shardfile needs an upgrade is a dimmed card that keeps the save.
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
import { buildTitleMenu } from '../src/game/mainMenu';

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
  it('shipped: G258 opens 4 shards + 2 templates (+ 3 open plots, G198); Developer: 5 + 1; DEVSERVER adds its cell at (+1, −1), and its row swaps it back', () => {
    expect(count(MODES.shipped)).toEqual({ shards: 4, templates: 2 });
    expect(count(MODES.developer)).toEqual({ shards: 5, templates: 1 });
    expect(count(MODES.devserver)).toEqual({ shards: 5, templates: 2 });
    expect(count(MODES.both)).toEqual({ shards: 6, templates: 1 });
    expect(count(MODES.both, false)).toEqual({ shards: 5, templates: 1 });
    expect(cells(MODES.both).find((row) => row.cell[0] === 1 && row.cell[1] === -1)?.slug).toBe('nine-dragon-stack');
    expect(cells(MODES.both, false).find((row) => row.cell[0] === 1 && row.cell[1] === -1)?.slug).toBeUndefined();
    expect(new GridAssembly(gridMode(false, MODES.both)).plots.map((plot) => plot.instance)).toEqual(['open-plot-nw', 'open-plot-sw', 'open-plot-se']);
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
  it('INFINITE WILDSHARD shows only with Developer on until SF22\'s gates pass, then to everyone', () => {
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

describe('the main menu (G79 / G88)', () => {
  const noop = (): void => undefined;
  for (const dev of [false, true]) {
    it(`Developer ${dev}: ${dev ? 'SHARD SELECT and INFINITE WILDSHARD side by side' : 'one wide SHARD SELECT card'}, then SETTINGS`, () => {
      setDev(dev);
      const onGrid = vi.fn<() => void>(), onSettings = vi.fn<() => void>();
      const menu = buildTitleMenu({ cards: titleCards(), active: null, onEnter: noop, onExplore: noop, onSettings, onGrid, screen: 'main' });
      document.body.append(menu.root);
      menu.start();
      expect(menu.screen).toBe('main');
      expect(menu.root.querySelector('.ws-main-logo')?.textContent).toBe('WILDSHARD');
      const cards = [...menu.root.querySelectorAll<HTMLButtonElement>('.ws-main-card')].map((card) => card.textContent.trim());
      expect(cards).toEqual(dev ? ['SHARD SELECT', 'INFINITE WILDSHARD'] : ['SHARD SELECT']);
      expect(menu.root.querySelector('.ws-main-cards')?.classList.contains('one')).toBe(!dev);
      expect(document.activeElement).toBe(menu.root.querySelector('.ws-main-select'));
      menu.root.querySelector<HTMLButtonElement>('.ws-main-grid')?.click();
      expect(onGrid).toHaveBeenCalledTimes(dev ? 1 : 0);
      menu.root.querySelector<HTMLButtonElement>('.ws-main-settings')?.click();
      expect(onSettings).toHaveBeenCalledTimes(1);
      menu.dispose(); menu.root.remove();
    });
  }
  it('SHARD SELECT opens today\'s deck, unchanged; MAIN MENU comes back; a rebuild keeps the screen', () => {
    setDev(true);
    const opts = { cards: titleCards(), active: null, onEnter: noop, onExplore: noop, onSettings: noop, onGrid: noop };
    const menu = buildTitleMenu({ ...opts, screen: 'main' });
    document.body.append(menu.root);
    const deck = menu.root.querySelector<HTMLElement>('.ws-menu');
    expect(deck?.classList.contains('hide')).toBe(true);
    menu.root.querySelector<HTMLButtonElement>('.ws-main-select')?.click();
    expect(menu.screen).toBe('select');
    expect(deck?.classList.contains('hide')).toBe(false);
    expect(menu.root.querySelector('.ws-main')?.classList.contains('hide')).toBe(true);
    expect(menu.root.querySelector('.ws-menu-entries')).toBeNull(); // the old two-entry row is gone: the main menu owns it
    expect(menu.root.querySelector('.ws-menu-play b')?.textContent).toBe('LEGACY'); // SF65: Developer on, LEGACY / SHARDFILE
    menu.dispose(); menu.root.remove();
    const again = buildTitleMenu(opts); // Settings ▸ Developer rebuilt the title: still on the deck
    expect(again.screen).toBe('select');
    again.root.querySelector<HTMLButtonElement>('.ws-menu-back')?.click();
    expect(again.screen).toBe('main');
    again.dispose();
  });
  it('the HUD\'s confirm on the main menu opens the deck; on the deck it enters the card', () => {
    const onEnter = vi.fn<() => void>();
    const menu = buildTitleMenu({ cards: titleCards(), active: null, onEnter, onExplore: noop, onSettings: noop, onGrid: noop, screen: 'main' });
    menu.activate();
    expect(menu.screen).toBe('select');
    menu.activate();
    expect(onEnter).toHaveBeenCalledTimes(1);
    expect(menu.screen).toBe('main'); // entering a world resets the title: EXIT TO MAIN opens on the main menu
    menu.dispose();
  });
});

describe('a card that needs an upgrade (G86, temporary)', () => {
  it('is dimmed, badged NEEDS UPGRADE, built for its version, and cannot be entered; the save line stays', () => {
    const cards = titleCards(false, (slug) => (slug === 'driftwood-isle' ? 0 : null));
    const onEnter = vi.fn<() => void>();
    const deck = buildTitleDeck({ cards, active: null, onEnter, onExplore: () => undefined, onSettings: () => undefined });
    const index = deck.cards.findIndex((card) => card.slug === 'driftwood-isle');
    deck.select(index, false);
    const card = deck.root.querySelectorAll<HTMLElement>('.ws-menu-card')[index];
    expect(card?.classList.contains('ws-menu-card-upgrade')).toBe(true);
    expect(card?.querySelector('.ws-menu-card-needs')?.textContent).toBe('NEEDS UPGRADE');
    expect(card?.querySelector('small')?.textContent).toBe('BUILT FOR SHARDFILE V0');
    const play = deck.root.querySelector<HTMLButtonElement>('.ws-menu-play');
    expect(play?.disabled).toBe(true);
    expect(play?.querySelector('b')?.textContent).toBe('NEEDS UPGRADE');
    expect(play?.querySelector('small')?.textContent).toBe('YOUR SAVE IS KEPT');
    deck.activate();
    expect(onEnter).not.toHaveBeenCalled();
    deck.dispose();
  });
});

describe('a DEVSERVER build (§3.3)', () => {
  it('Select a shard enters and explores every shard without Developer mode; the grid entry stays hidden', () => {
    const deck = buildTitleDeck({ cards: titleCards(true), active: null, onEnter: () => undefined, onExplore: () => undefined, onSettings: () => undefined, mode: () => MODES.devserver });
    document.body.append(deck.root);
    for (const [index, card] of deck.cards.entries()) {
      deck.select(index, false);
      expect(deck.root.querySelector<HTMLButtonElement>('.ws-menu-play')?.disabled, card.slug).toBe(false);
      expect(deck.root.querySelector<HTMLButtonElement>('.ws-menu-explore')?.disabled, card.slug).toBe(false);
    }
    expect([...deck.root.querySelectorAll('.ws-menu-card-exp')].filter((el) => el.textContent === 'DEVELOPER ONLY')).toHaveLength(1);
    deck.dispose(); deck.root.remove();
    const menu = buildTitleMenu({ cards: titleCards(true), active: null, onEnter: () => undefined, onExplore: () => undefined, onSettings: () => undefined, onGrid: () => undefined, mode: () => MODES.devserver, screen: 'main' });
    expect(menu.root.querySelector('.ws-main-grid')).toBeNull();
    menu.dispose();
  });
  it('DEVSERVER with Developer: both entries', () => {
    const menu = buildTitleMenu({ cards: titleCards(true), active: null, onEnter: () => undefined, onExplore: () => undefined, onSettings: () => undefined, onGrid: () => undefined, mode: () => MODES.both, screen: 'main' });
    expect(menu.root.querySelector('.ws-main-select')?.textContent.trim()).toBe('SHARD SELECT');
    expect(menu.root.querySelector('.ws-main-grid')?.textContent.trim()).toBe('INFINITE WILDSHARD');
    menu.dispose();
  });
  it('the DEVSERVER cell row: on by default, swapped to the template at the next grid start, gone when uninstalled', () => {
    installGridDebug(false)(); // a production build installs no DEVSERVER cell row
    expect(levelDebugRows().some((entry) => entry.id === 'gridDevserverCell')).toBe(false);
    const remove = installGridDebug(true);
    const row = levelDebugRows().find((entry) => entry.id === 'gridDevserverCell');
    expect(row?.group).toBe('tools');
    expect(row?.choices().map((choice) => choice.text)).toEqual(['Nine Dragon Stack', 'Template']);
    expect(row?.label).toBe('Infinite Wildshard (+1, −1)');
    expect(row?.get()).toBe('on');
    const at = (on: boolean) => new GridAssembly(gridMode(on, MODES.both)).cells.find((cell) => cell.cell[0] === 1 && cell.cell[1] === -1)?.slug;
    expect(at(devserverCellOn(true))).toBe('nine-dragon-stack');
    row?.set('off');
    expect(at(devserverCellOn(true))).toBeUndefined(); // the open plot it replaces (G198)
    expect(devserverCellOn(false)).toBe(false);
    row?.set('on');
    remove();
    expect(levelDebugRows().some((entry) => entry.id === 'gridDevserverCell')).toBe(false);
  });
  it('retires the memory-admission toggle after both catalogues admit under the unchanged cap', () => {
    const remove = installGridDebug(false);
    try { expect(levelDebugRows().some((entry) => entry.id === 'gridMemoryAdmission')).toBe(false); }
    finally { remove(); }
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
