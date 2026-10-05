// @vitest-environment happy-dom
// SHARD-PLATFORM SF28 (Jake's G87): the big item cards — the engine tile and pickup card, the HUD's pickup path behind
// pause ▸ Settings ▸ Debug ▸ Item cards, and the trader's G87 sheet in the shard's accent. Classic (the default) is unchanged.
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Scope } from '../src/engine/app/scope';
import { app } from '../src/engine/app/runtime';
import { hudSlots } from '../src/engine/ui/hudSlots';
import { HUD } from '../src/engine/ui/HUD';
import { WOODEN_SWORD } from '../src/kit/weapons/equipment';
import { ItemCardPop, itemCardTile } from '../src/engine/ui/ItemCard';
import { overrideSetting } from '../src/engine/ui/Settings';
import { ShopPanel, type ShopState } from '../src/game/loot/ui/ShopPanel';
import { accentHex, hudAccent, setHudAccent } from '../src/game/session/hudAccent';

const hostile = '<img src=x onerror="throw 1"><script>bad()</script>& "literal"';
let scope: Scope;
const parked = hudSlots.snapshot();
beforeEach(() => {
  scope = new Scope('item-cards'); app.levelScope = scope;
  hudSlots.restore({ layer: null, status: null, pending: [] });
  const root = document.createElement('div'); root.id = 'hud'; document.body.append(root);
});
afterEach(() => {
  overrideSetting('itemCards', null); setHudAccent(null);
  scope.dispose(); app.levelScope = null; app.input.clear(); hudSlots.restore(parked);
  vi.useRealTimers(); document.body.replaceChildren();
});

it('draws a tile literally, with the price after the ring or the state line', () => {
  const tile = itemCardTile({ name: hostile, icon: 'star', price: 15, state: 'buy' }, true);
  expect(tile.className).toBe('ws-icard-tile buy on');
  expect(tile.querySelector('.ws-icard-name')?.textContent).toBe(hostile);
  expect(tile.querySelector('.ws-icard-foot')?.textContent).toBe('15');
  expect(tile.querySelector('.ws-icard-foot .ws-icard-ring')).not.toBeNull();
  expect(tile.querySelector('.ws-icard-icon svg')).not.toBeNull();
  expect(tile.querySelector('img,script,[onerror]')).toBeNull();
  const out = itemCardTile({ name: 'Pelt', icon: 'star', detail: hostile, state: 'out' });
  expect(out.querySelector('.ws-icard-foot')?.textContent).toBe(hostile);
});

it('pops one pickup card in the given accent and clears it after its life', () => {
  vi.useFakeTimers();
  const pop = new ItemCardPop(document.getElementById('hud') ?? undefined, scope);
  pop.show({ name: hostile, icon: 'star', detail: hostile }, hostile, '#89c06a');
  expect(pop.shown).toBe(hostile);
  expect(pop.root.style.getPropertyValue('--ws-accent')).toBe('#89c06a');
  expect(pop.root.querySelector('.ws-icard-kicker')?.textContent).toBe(hostile);
  expect(pop.root.querySelector('img,script,[onerror]')).toBeNull();
  pop.show({ name: 'Second', icon: 'star' }, 'Picked up', null);
  expect(pop.root.querySelectorAll('.ws-icard-card')).toHaveLength(1);
  expect(pop.root.style.getPropertyValue('--ws-accent')).toBe('');
  vi.advanceTimersByTime(3200);
  expect(pop.shown).toBeNull();
});

it('keeps the classic toast by default and pops the big card only when Item cards is Big', () => {
  const layer = document.createElement('div'), status = document.createElement('div'); layer.append(status); hudSlots.mount(layer, status);
  const hud = new HUD({ pointerLock: false, weaponUi: WOODEN_SWORD.ui, maxBolts: 3 }); hud.cardAccent = '#fbbb2d';
  const toast = vi.spyOn(hud, 'toast');
  hud.pickupCard({ name: 'Iron sword', icon: 'star' }, 'Iron sword found');
  expect(toast).toHaveBeenCalledWith('Iron sword found');
  expect(document.querySelector('.ws-icard-pop')).toBeNull();
  overrideSetting('itemCards', 'big');
  hud.pickupCard({ name: 'Iron sword', icon: 'star' }, 'Iron sword found');
  expect(toast).toHaveBeenCalledOnce();
  const pop = document.querySelector<HTMLElement>('.ws-icard-pop');
  expect(pop?.querySelector('.ws-icard-name')?.textContent).toBe('Iron sword');
  expect(pop?.style.getPropertyValue('--ws-accent')).toBe('#fbbb2d');
  hud.scope.dispose();
});

it('maps a declared accent id to its palette hex', () => {
  expect(accentHex('moss')).toBe('#89c06a');
  expect(accentHex(undefined)).toBeNull();
  setHudAccent('#fe8169'); expect(hudAccent()).toBe('#fe8169');
});

it('builds no G87 sheet in Classic, then swaps to the big-cards sheet live in the shard accent', () => {
  const states: ShopState[] = ['buy', 'short', 'owned', 'locked'];
  const goods = states.map((_s, k) => ({ id: `g${k}`, name: k === 0 ? hostile : `Good ${k}`, does: 'Does', icon: 'star' as const, price: 10 + k }));
  const buy = vi.fn(() => true);
  const shop = new ShopPanel({ trader: 'Mott', place: 'Hollow', goods, state: (g) => states[goods.indexOf(g)] ?? 'buy', coins: () => 8, needs: () => hostile, greeting: () => 'Hello' });
  shop.onBuy = buy; shop.open();
  expect(shop.root.querySelector('.ws-shop-big')).toBeNull();
  expect(shop.root.querySelector('.ws-shop-sheet')).not.toBeNull();
  expect(shop.root.style.getPropertyValue('--ws-accent')).toBe('');
  setHudAccent('#89c06a');
  overrideSetting('itemCards', 'big');
  expect(shop.root.querySelector('.ws-shop-sheet')).toBeNull();
  expect(shop.root.querySelector('.ws-shop-bigwho')?.textContent).toBe('Mott · Trader');
  expect(shop.root.querySelector('.ws-shop-bigpurse b')?.textContent).toBe('8');
  expect(shop.root.style.getPropertyValue('--ws-accent')).toBe('#89c06a');
  const tiles = shop.root.querySelectorAll('.ws-shop-grid .ws-icard-tile');
  expect([...tiles].map((t) => t.className)).toEqual(['ws-icard-tile buy on', 'ws-icard-tile short', 'ws-icard-tile owned', 'ws-icard-tile locked']);
  expect(tiles[3]?.querySelector('.ws-icard-foot')?.textContent).toBe(`Needs ${hostile}`);
  const bar = shop.root.querySelector<HTMLButtonElement>('.ws-shop-bigbuy'); if (!bar) throw new Error('Missing buy bar');
  expect(bar.textContent).toBe(`Buy ${hostile} · 10`);
  expect(shop.root.querySelector('img,script,[onerror]')).toBeNull();
  bar.click(); expect(buy).toHaveBeenCalledOnce();
  shop.root.querySelectorAll<HTMLElement>('.ws-shop-grid .ws-icard-tile')[1]?.click();
  expect(bar.textContent).toBe('Need 3 more');
  expect(bar.disabled).toBe(true);
  overrideSetting('itemCards', 'classic');
  expect(shop.root.querySelector('.ws-shop-big')).toBeNull();
  expect(shop.root.querySelector('.ws-shop-sheet')).not.toBeNull();
  expect(shop.root.style.getPropertyValue('--ws-accent')).toBe('');
  shop.dispose();
});
