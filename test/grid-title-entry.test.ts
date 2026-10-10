// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { setDev } from '../src/engine/core/devMode';
import { buildTitleMenu } from '../src/game/mainMenu';
import { titleCards } from '../src/game/titleDeck';
import { travel } from '../src/game/travel/travel';
import { shardEntry } from '../src/game/shard/entryMode';
import { findShard } from '../src/game/shard/registry';
import { bootPageMode, enterGrid, gridCells } from '../src/game/grid/boot';
import { clearGridRecovery } from '../src/game/grid/recoveryBoot';
import { gridPageShellLevel, useOwnedGridHome } from '../src/game/grid/pageShell';

afterEach(() => { clearGridRecovery(); bootPageMode(''); gridCells.leave(); setDev(false); vi.unstubAllGlobals(); });

it.each(['legacy', 'shardfile'] as const)('returns from Driftwood SHARD SELECT %s, then boots INFINITE WILDSHARD as platform.grid', entry => {
  setDev(true);
  const address = new URL('http://localhost:5173/?chunk=driftwood-isle');
  const replace = vi.fn<(next: string) => void>(next => { address.href = next; });
  vi.stubGlobal('location', Object.assign(address, { replace }));
  const menu = buildTitleMenu({ cards: titleCards(), active: null, screen: 'select',
    onEnter: card => { travel({ to: card.slug, mode: 'enter' }); },
    onExplore: () => undefined, onSettings: () => undefined, onGrid: enterGrid });
  const button = (selector: string): HTMLButtonElement => {
    const node = menu.root.querySelector(selector);
    if (!(node instanceof HTMLButtonElement)) throw new Error(`Missing title button ${selector}`);
    return node;
  };
  try {
    const index = menu.cards.findIndex(card => card.slug === 'driftwood-isle');
    expect(index).toBeGreaterThanOrEqual(0); menu.select(index, false);
    button(entry === 'legacy' ? '.ws-menu-play' : '.ws-menu-shardfile').click();
    const selected = address.searchParams.get('chunk');
    expect(selected).toBe(entry === 'legacy' ? 'driftwood-isle-legacy' : 'driftwood-isle');
    if (selected === null) throw new Error('Missing selected page');
    expect(bootPageMode(selected)).toBe('shard');
    // EXIT TO MAIN keeps this document and its tab's choice; the grid tap must still make a fresh navigation.
    menu.show('main'); button('.ws-main-grid').click();
    expect(replace).toHaveBeenCalledTimes(2);
    expect(address.searchParams.get('chunk')).toBe('driftwood-isle');
    const home = findShard('driftwood-isle');
    if (home === undefined) throw new Error('Missing grid home');
    const mode = bootPageMode(home.slug);
    expect(mode).toBe('grid'); expect(gridCells.cell).toEqual({ instance: home.slug, slug: home.slug });
    expect(shardEntry(home)).toBe('shardfile');
    expect(useOwnedGridHome(mode, true, home)).toBe(true);
    expect(gridPageShellLevel(home).id).toBe('platform.grid');
    expect(bootPageMode(home.slug)).toBe('shard'); // The grid intent is still one-shot.
  } finally { menu.dispose(); }
});
