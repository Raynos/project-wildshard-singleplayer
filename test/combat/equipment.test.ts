// @vitest-environment happy-dom
import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { app as inputApp, EquipmentService, Weapon, Scope, Tool, quiverState, type EquipmentRow, type WeaponId, type WeaponState } from '#engine';
import { SABRE, BOW, SPEAR } from '#shards/nalati-grasslands/weapons/equipment';
import { CROSSBOW } from '#shards/pine-hollow/weapons/equipment';
import { App } from '#engine/app/app';
import { equipmentEntry } from '#game/bag/equipment';
import { FakeGame } from '../fake/FakeGame';

class FixtureWeapon extends Weapon {
  readonly model = new THREE.Group(); enabled = true; adsHeld = false; holster = 0;
  readonly state: WeaponState; aimInfo = null;
  tryFire = vi.fn((): void => undefined);
  update = vi.fn((): void => undefined);
  constructor(row: EquipmentRow, id: WeaponId, ammo = false) {
    super({ ...row, legacySlot: id });
    this.state = { ammo: ammo ? 24 : undefined, magazine: 30, reserve: 0, loaded: true, reloading: false, reloadProgress: 0, ads: false };
  }
  override reload = vi.fn((): void => undefined);
  override inputAllowed(): boolean { return true; }
}
let inputScope: Scope;
beforeEach(() => {
  vi.stubGlobal('document', new EventTarget()); vi.stubGlobal('window', new EventTarget());
  inputScope = new Scope('equipment-input'); inputApp.input.install(inputScope);
  inputApp.input.register({ id: 'test.swap', actions: ['swap', 'swap.slot.1', 'swap.slot.2', 'swap.slot.3'], keys: { swap: ['KeyQ'], 'swap.slot.1': ['Digit1'], 'swap.slot.2': ['Digit2'], 'swap.slot.3': ['Digit3'] } }, inputScope);
  inputApp.input.push('test.swap', inputScope);
});
afterEach(() => { inputScope.dispose(); });
function fixture() {
  const a = new FixtureWeapon(SABRE, 'sabre'), b = new FixtureWeapon(BOW, 'bow', true), c = new FixtureWeapon(SPEAR, 'spear'), game = new FakeGame();
  const weapons = new EquipmentService(a, { order: ['bow', 'sabre', 'spear'] });
  weapons.add(b, { locked: true }); weapons.add(c, { locked: true });
  game.onUpdate((dt, t) => weapons.update(dt, t));
  return { weapons, game, a, b, c };
}
function key(code: string, repeat = false): void {
  document.dispatchEvent(new KeyboardEvent('keydown', { code, repeat }));
  document.dispatchEvent(new KeyboardEvent('keyup', { code }));
}

describe('legacy equipment service behavior to retain in S1.2', () => {
  it('swaps at .25s, finishes at .5s, gates input, keeps ADS and drops the secondary latch', () => {
    const { weapons, game, a, b } = fixture(); weapons.unlock('bow'); weapons.adsHeld = true; weapons.altHeld = true;
    weapons.select('bow'); expect(a.enabled).toBe(false); expect(b.enabled).toBe(false); expect(b.altHeld).toBe(false);
    for (let n = 0; n < 14; n++) game.advance(1 / 60);
    expect(weapons.current.id).toBe('sabre'); expect(a.holster).toBeCloseTo(14 / 15);
    game.advance(1 / 60); // accumulated float may place exactly .25 on the next frame
    game.advance(1 / 60); expect(weapons.current.id).toBe('bow'); expect(weapons.swappingNow).toBe(true);
    for (let n = 0; n < 15; n++) game.advance(1 / 60);
    expect(weapons.swappingNow).toBe(false); expect(b.enabled).toBe(true); expect(b.adsHeld).toBe(true); expect(b.holster).toBe(0);
    expect(weapons.state.ammo).toBe(24); expect(game.dead).toBe(false);
  });
  it('stows and raises over .25 seconds while every owned weapon keeps ticking', () => {
    const { weapons, game, a, b, c } = fixture(); weapons.stowed = true;
    expect(a.enabled).toBe(false);
    for (let n = 0; n < 16; n++) game.advance(1 / 60);
    expect(a.holster).toBe(1); weapons.stowed = false; expect(a.enabled).toBe(true);
    for (let n = 0; n < 16; n++) game.advance(1 / 60);
    expect(a.holster).toBe(0);
    for (const w of [a, b, c]) expect(w.update).toHaveBeenCalledTimes(32);
  });
  it('number keys enumerate only owned slots in kit order; Q wraps; repeats and locked slots do nothing', () => {
    const { weapons } = fixture(); key('Digit3'); expect(weapons.current.id).toBe('sabre');
    weapons.unlock('bow'); weapons.unlock('spear');
    key('Digit1'); weapons.update(0.5, 1); expect(weapons.current.id).toBe('bow');
    key('Digit2', true); expect(weapons.swappingNow).toBe(false);
    key('KeyQ'); weapons.update(0.5, 2); expect(weapons.current.id).toBe('sabre');
    key('Digit3'); weapons.update(0.5, 3); expect(weapons.current.id).toBe('spear');
    key('KeyQ'); weapons.update(0.5, 4); expect(weapons.current.id).toBe('bow');
    expect(weapons.available.map((w) => w.id)).toEqual(['bow', 'sabre', 'spear']);
  });
  it('wheel accumulates 60px, waits 180ms between steps, and uses the game-canvas lane', () => {
    class Canvas extends EventTarget {}
    vi.stubGlobal('HTMLCanvasElement', Canvas); const canvas = new Canvas();
    Reflect.set(document, 'pointerLockElement', null);
    const { weapons } = fixture(); // fixture does not replace globals
    weapons.unlock('bow'); weapons.unlock('spear');
    const now = vi.spyOn(performance, 'now').mockReturnValue(1000);
    const wheel = (pixels: number): void => { const event = new WheelEvent('wheel', { deltaY: pixels, deltaMode: 0 }); Object.defineProperty(event, 'target', { value: canvas }); Object.defineProperty(event, 'timeStamp', { value: performance.now() }); document.dispatchEvent(event); };
    wheel(59); expect(weapons.swappingNow).toBe(false); wheel(1); weapons.update(0.5, 1); expect(weapons.current.id).toBe('spear');
    now.mockReturnValue(1179); wheel(60); expect(weapons.swappingNow).toBe(false);
    now.mockReturnValue(1180); wheel(1); weapons.update(0.5, 2); expect(weapons.current.id).toBe('bow');
    now.mockReturnValue(1400); wheel(-60); weapons.update(0.5, 3); expect(weapons.current.id).toBe('spear');
  });
  it('practice loan is idempotent, returns to an owned slot, and preserves ammo', () => {
    const { weapons, b } = fixture(); weapons.lendAll(); weapons.lendAll(); expect(weapons.available).toHaveLength(3);
    weapons.select('bow', true); if (b.state.ammo !== undefined) b.state.ammo = 7;
    weapons.endLoan(); expect(weapons.available.map((w) => w.id)).toEqual(['sabre']); expect(weapons.current.id).toBe('sabre');
    expect(b.state.ammo).toBe(7); weapons.endLoan(); expect(weapons.current.id).toBe('sabre');
  });
});


describe('equipment contracts and lifecycle', () => {
  it('replaces the held upgrade in-place, preserving ammo, ADS, order and ownership', () => {
    const { weapons, b } = fixture(); weapons.unlock('bow'); weapons.select('bow', true);
    weapons.adsHeld = true; weapons.altHeld = true; b.state.ammo = 7; b.state.reserve = 11;
    const next = new FixtureWeapon({ ...BOW, id: 'weapon.golden-bow', ui: { ...BOW.ui, name: 'Golden Bow' }, meta: { ...BOW.meta, name: 'Golden Bow' } }, 'bow', true);
    const disposed = vi.spyOn(b, 'dispose'); weapons.replace('bow', next);
    expect(disposed).toHaveBeenCalledOnce(); expect(b.enabled).toBe(false);
    expect(weapons.current).toBe(next); expect(next.enabled).toBe(true); expect(next.adsHeld).toBe(true); expect(next.altHeld).toBe(true);
    expect(next.state).toMatchObject({ ammo: 7, reserve: 11 }); expect(weapons.has('bow')).toBe(true);
    expect(weapons.available.map((w) => w.id)).toEqual(['bow', 'sabre']);
    expect(equipmentEntry(next, next)).toMatchObject({ name: 'Golden Bow', melee: false, icon: 'longbow', equipped: true, ammo: 7 });
    weapons.dispose();
  });
  it('replaces a locked slot during a practice loan without granting it permanently', () => {
    const { weapons, b } = fixture(); weapons.lendAll(); b.state.ammo = 9;
    const next = new FixtureWeapon(BOW, 'bow', true); weapons.replace('bow', next); weapons.select('bow', true);
    weapons.endLoan(); expect(weapons.current.id).toBe('sabre'); expect(weapons.has('bow')).toBe(false); expect(next.state.ammo).toBe(9);
    weapons.dispose();
  });
  it('finishes an in-progress swap using the replacement, with the original swap clock', () => {
    const { weapons } = fixture(); weapons.unlock('bow'); weapons.select('bow'); weapons.update(0.1, 0.1);
    const next = new FixtureWeapon(BOW, 'bow', true); weapons.replace('bow', next);
    weapons.update(0.15, 0.25); expect(weapons.current).toBe(next); expect(next.holster).toBe(1);
    weapons.update(0.25, 0.5); expect(weapons.current).toBe(next); expect(next.holster).toBe(0); expect(next.enabled).toBe(true);
    weapons.dispose();
  });
  it('owns its action bindings/listeners and equipment through the supplied scope', () => {
    const parent = new Scope('level'), a = new FixtureWeapon(SABRE, 'sabre'), b = new FixtureWeapon(BOW, 'bow', true);
    const weapons = new EquipmentService(a, { scope: parent }); weapons.add(b, { locked: false });
    expect(parent.census.listeners).toBe(0); key('KeyQ'); weapons.update(0.5, 0.5); expect(weapons.current).toBe(b);
    const camera = new THREE.Group(); camera.add(a.model, b.model);
    parent.dispose(); expect(parent.census.listeners).toBe(0); expect(a.enabled).toBe(false); expect(b.enabled).toBe(false);
    expect(camera.children).toHaveLength(0); expect(a.model.visible).toBe(false); expect(b.model.visible).toBe(false);
    key('KeyQ'); expect(weapons.swappingNow).toBe(false); expect(weapons.current).toBe(b);
  });
  it('runs owned tools alongside every weapon and returns borrowed tools at the end of a loan', () => {
    class Hook extends Tool {
      readonly id = 'tool.fei-zhua' as const; readonly slot = 'offhand'; readonly actions = ['lock', 'jump'] as const;
      holster = 0; enabled = true; update = vi.fn((): void => undefined);
    }
    const { weapons, a } = fixture(); const tool = new Hook({ ...SABRE, id: 'tool.fei-zhua', meta: { name: 'Fei Zhua', icon: 'grapple', blurb: 'Lock a hook, then jump', category: 'tool' } });
    weapons.add(tool, { locked: true }); weapons.update(0.1, 0.1); expect(tool.update).not.toHaveBeenCalled();
    weapons.lendAll(); weapons.update(0.1, 0.2); expect(tool.update).toHaveBeenCalledOnce(); expect(a.update).toHaveBeenCalledTimes(2);
    weapons.endLoan(); weapons.update(0.1, 0.3); expect(tool.update).toHaveBeenCalledOnce(); expect(weapons.has(tool.id)).toBe(false);
    weapons.dispose(); expect(tool.enabled).toBe(false);
  });
  it('keeps quiver and normalized ammo synchronized without a manager cache', () => {
    const state = quiverState({ bolts: 24, loaded: true, reloading: false, reloadProgress: 0, ads: false }, 24);
    state.bolts = 7; expect(state.ammo).toBe(7); state.ammo = 5; expect(state.bolts).toBe(5);
    expect(state).toMatchObject({ magazine: 24, reserve: 0 });
  });
  it('reads Bag names and flags from metadata regardless of the legacy slot id', () => {
    const a = new FixtureWeapon({ ...SABRE, meta: { ...SABRE.meta, name: 'Custom weapon', icon: 'grapple' } }, 'rifle');
    expect(equipmentEntry(a, a, ' · Bright')).toMatchObject({ name: 'Custom weapon · Bright', icon: 'grapple', melee: true, tracers: false });
  });
  it('preserves the default Bag ammo label while showing each selected bolt type', () => {
    const a = new FixtureWeapon(CROSSBOW, 'crossbow', true);
    expect(equipmentEntry(a, a).ammoLabel).toBe('Iron bolts');
    for (const label of ['Broadheads', 'Pitch bolts', 'Bolts']) {
      if (a.row.ui.ammo === undefined) throw new Error('Fixture has no ammo row');
      a.row = { ...a.row, ui: { ...a.row.ui, ammo: { ...a.row.ui.ammo, label } } };
      expect(equipmentEntry(a, a).ammoLabel).toBe(label === 'Bolts' ? 'Iron bolts' : label);
    }
  });
  it('exposes the resident level kit and clears only the disposed level registration', () => {
    const app = new App(), first = new Scope('first'), second = new Scope('second');
    const a = new EquipmentService(new FixtureWeapon(SABRE, 'sabre'), { scope: first });
    const b = new EquipmentService(new FixtureWeapon(BOW, 'bow'), { scope: second });
    app.registerEquipment(a, first); app.registerEquipment(b, second);
    expect(app.equipment).toBeNull(); app.levelScope = first; expect(app.equipment).toBe(a);
    app.levelScope = second; expect(app.equipment).toBe(b); first.dispose(); expect(app.equipment).toBe(b);
    second.dispose(); expect(app.equipment).toBeNull(); app.engineScope.dispose();
  });
});
