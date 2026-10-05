// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Group } from 'three';
import { Scope } from '../src/engine/app/scope';
import { app } from '../src/engine/app/runtime';
import { HudSlots, hudSlots } from '../src/engine/ui/hudSlots';
import { HUD, type HUDState } from '../src/engine/ui/HUD';
import { WeaponStrip } from '../src/engine/ui/WeaponStrip';
import { GameMenu } from '../src/engine/ui/Menu';
import type { FullMap } from '../src/engine/ui/Map';
import { EquipmentService } from '../src/engine/combat/EquipmentService';
import { Weapon, type WeaponState } from '../src/engine/combat/Weapon';
import { WOODEN_SWORD, IRON_SWORD } from '../src/kit/weapons/equipment';
import { Journal } from '../src/game/compendium/Journal';
import { CompendiumState } from '../src/game/compendium/state';
import type { ShardCompendium } from '../src/game/compendium/types';
import { legacyDouble } from './fake/FakeGame';

const hostile = '<img src=x onerror="throw 1"><script>bad()</script>& "literal"';
let scope: Scope;
const parked = hudSlots.snapshot();
beforeEach(() => {
  scope = new Scope('authored-text'); app.levelScope = scope;
  hudSlots.restore({ layer: null, status: null, pending: [] });
  const root = document.createElement('div'); root.id = 'hud'; document.body.append(root);
});
afterEach(() => {
  scope.dispose(); app.levelScope = null; app.input.clear(); hudSlots.restore(parked);
  vi.useRealTimers(); document.body.replaceChildren();
});

it('keeps an authored disc label literal beside the trusted SVG and preserves its press lifecycle', () => {
  const hud = new HudSlots(), layer = document.createElement('div'), status = document.createElement('div');
  hud.mount(layer, status); const press = vi.fn<() => void>(), release = vi.fn<() => void>();
  const disc = hud.disc({ cls: 'fixture', icon: '<svg viewBox="0 0 24 24"><path d="M0 0L1 1"/></svg>', label: hostile, spot: 'up0', press, release }, scope);
  expect(disc.querySelector('span')?.textContent).toBe(hostile); expect(disc.querySelectorAll('svg path')).toHaveLength(1);
  expect(disc.querySelector('img,script')).toBeNull();
  disc.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); disc.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
  expect(press).toHaveBeenCalledOnce(); expect(release).toHaveBeenCalledOnce();
});

it('renders hostile ammo labels and interaction prompts literally, retaining the leading key badge', () => {
  const layer = document.createElement('div'), status = document.createElement('div'); layer.append(status); hudSlots.mount(layer, status);
  const weaponUi = { ...WOODEN_SWORD.ui, name: hostile, ammo: { label: hostile, segments: 3 } };
  const hud = new HUD({ pointerLock: false, weaponUi, maxBolts: 3 });
  const state: HUDState = { weaponUi, bolts: 2, loaded: true, reloading: false, prompt: `[E] ${hostile}`, health: 100, pos: { x: 0, z: 0 }, yaw: 0, kills: 0 };
  hud.setState(state);
  expect(document.querySelector('.ws-game-weapon')?.textContent).toBe(hostile);
  expect(document.querySelector('.ws-game-ammo .l')?.textContent).toBe(hostile);
  expect(document.querySelector('.ws-game-prompt b')?.textContent).toBe('E');
  expect(document.querySelector('.ws-game-prompt')?.textContent).toBe(`E${hostile}`);
  expect(document.querySelector('img,script')).toBeNull();
});

it('uses literal shard, tab and quest text in the menu while retaining the quest marker', () => {
  const map = legacyDouble<FullMap>({ mount: () => undefined, show: () => undefined, hide: () => undefined, fit: () => undefined,
    zoom: 1, hasRoom: false, quest: { title: hostile, objective: hostile, hint: hostile } });
  const menu = new GameMenu({ levelName: hostile, fullMap: map,
    settings: () => ({ weapons: new Set(), melee: false, tracers: false, huntersEye: false }) });
  menu.addTab({ id: 'authored', title: hostile, icon: 'map' });
  menu.open('map');
  for (const selector of ['.ws-gmenu-sub', '.ws-gmenu-mapmeta', '[data-tab="authored"] .ws-gmenu-tword', '.ws-gmenu-mapquest-title', '.ws-gmenu-mapquest-obj', '.ws-gmenu-mapquest-hint']) {
    expect(menu.root.querySelector(selector)?.textContent, selector).toBe(hostile);
  }
  expect(menu.root.querySelector('.ws-gmenu-mapquest-obj i')).not.toBeNull();
  expect(menu.root.querySelector('img,script,[onerror]')).toBeNull(); menu.close();
});

class FixtureWeapon extends Weapon {
  readonly model = new Group(); enabled = true; adsHeld = false; holster = 0; aimInfo = null;
  readonly state: WeaponState = { ammo: 0, magazine: 3, reserve: 0, loaded: true, reloading: false, reloadProgress: 0, ads: false };
  tryFire(): void { /* Selection fixture. */ }
  update(): void { /* Selection fixture. */ }
}
it.each([false, true])('renders weapon labels literally on touch=%s, preserving slot and pie icons and ammo', (touch) => {
  const root = document.getElementById('hud'); if (root === null) throw new Error('Missing HUD');
  if (touch) { root.className = 'touch'; const layer = document.createElement('div'); layer.className = 'ws-touch'; root.append(layer); }
  const equipment = new EquipmentService(new FixtureWeapon({ ...WOODEN_SWORD, ui: { ...WOODEN_SWORD.ui, swapName: hostile } }), { scope });
  equipment.add(new FixtureWeapon({ ...IRON_SWORD, ui: { ...IRON_SWORD.ui, swapName: hostile } }), { locked: false });
  const strip = new WeaponStrip(equipment);
  if (touch) {
    vi.useFakeTimers(); strip.el.setPointerCapture = () => undefined;
    strip.el.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, bubbles: true })); vi.advanceTimersByTime(261);
    expect(root.querySelector('.ws-touch-pie-label span')?.textContent).toBe(`${hostile} 0`);
    expect(root.querySelector('.ws-touch-pie-label b.empty')?.textContent).toBe('0');
  } else {
    expect(root.querySelector('.ws-touch-slot-name')?.textContent).toBe(hostile);
    expect(root.querySelector('.ws-touch-slot-key')?.textContent).toBe('1');
  }
  expect(root.querySelector('svg path')).not.toBeNull(); expect(root.querySelector('img,script')).toBeNull();
});

it('renders journal entry, skin, stats, neighbour and trophy text without interpreting markup', () => {
  const def: ShardCompendium = { chunkId: 'chunk://local/authored-text', skin: {
    className: 'fixture', title: hostile, tabs: [{ id: 'beasts', label: hostile }, { id: 'trophies', label: hostile }], trophyTab: 'trophies',
    stamp: () => hostile, stats: () => [{ label: hostile, value: hostile }],
  }, entries: [1, 2].map((n) => ({ id: `entry-${n}`, kind: 'species', tab: 'beasts', name: hostile, subtitle: hostile, notes: hostile,
    plate: { sketch: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%221%22%20height%3D%221%22%2F%3E' } })),
  trophies: [{ entry: 'entry-1', outline: 'one', title: hostile }] };
  const state = new CompendiumState(def); state.take('entry-1'); state.see('entry-2');
  const book = new Journal(state); book.open();
  for (const selector of ['.ws-cmp-tab span', '.ws-cmp-name', '.ws-cmp-sub', '.ws-cmp-stamp', '.ws-cmp-stat span', '.ws-cmp-stat b', '.ws-cmp-notes', '.ws-cmp-nb span']) {
    expect(book.root.querySelector(selector)?.textContent, selector).toBe(hostile);
  }
  expect(book.root.querySelectorAll('img')).toHaveLength(2); expect(book.root.querySelector('script,[onerror]')).toBeNull();
  book.select('trophies'); expect(book.root.querySelector('.ws-cmp-slot b')?.textContent).toBe(hostile);
  expect(book.root.querySelector('.ws-cmp-slot span')?.textContent).toBe(hostile);
  expect(book.root.querySelectorAll('.ws-cmp-slot img')).toHaveLength(1); expect(book.root.querySelector('script,[onerror]')).toBeNull(); book.close();
});
