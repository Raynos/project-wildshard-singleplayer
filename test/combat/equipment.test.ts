import * as THREE from 'three';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Weapons, type BaseLike } from '#engine/player/Weapons';
import { FakeGame } from '../fake/FakeGame';

function base(ammo = false): BaseLike {
  return { model: new THREE.Group(), enabled: true, adsHeld: false, altHeld: false, holster: 0, hasAmmo: ammo,
    state: { ...(ammo ? { bolts: 24 } : {}), loaded: true, reloading: false, reloadProgress: 0, ads: false }, aimInfo: null,
    tryFire: vi.fn((): void => undefined), update: vi.fn((): void => undefined), addBolts: vi.fn((): void => undefined), reload: vi.fn((): void => undefined), inputAllowed: () => true };
}
beforeEach(() => { vi.stubGlobal('document', new EventTarget()); vi.stubGlobal('window', new EventTarget()); });
function fixture() {
  const a = base(), b = base(true), c = base(), game = new FakeGame();
  const weapons = new Weapons(a, null, [{ weapon: b, id: 'bow', name: 'Bow' }, { weapon: c, id: 'spear', name: 'Spear' }],
    { baseId: 'sabre', baseName: 'Sabre', order: ['bow', 'sabre', 'spear'] });
  game.onUpdate((dt, t) => weapons.update(dt, t));
  return { weapons, game, a, b, c };
}
function key(code: string, repeat = false): void {
  document.dispatchEvent(Object.assign(new Event('keydown'), { code, repeat }));
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
    const wheel = (pixels: number): void => { const event = Object.assign(new Event('wheel'), { deltaY: pixels, deltaMode: 0 }); Object.defineProperty(event, 'target', { value: canvas }); document.dispatchEvent(event); };
    wheel(59); expect(weapons.swappingNow).toBe(false); wheel(1); weapons.update(0.5, 1); expect(weapons.current.id).toBe('spear');
    now.mockReturnValue(1179); wheel(60); expect(weapons.swappingNow).toBe(false);
    now.mockReturnValue(1180); wheel(1); weapons.update(0.5, 2); expect(weapons.current.id).toBe('bow');
    now.mockReturnValue(1400); wheel(-60); weapons.update(0.5, 3); expect(weapons.current.id).toBe('spear');
  });
  it('practice loan is idempotent, returns to an owned slot, and preserves ammo', () => {
    const { weapons, b } = fixture(); weapons.lendAll(); weapons.lendAll(); expect(weapons.available).toHaveLength(3);
    weapons.select('bow', true); if (b.state.bolts !== undefined) b.state.bolts = 7;
    weapons.endLoan(); expect(weapons.available.map((w) => w.id)).toEqual(['sabre']); expect(weapons.current.id).toBe('sabre');
    expect(b.state.bolts).toBe(7); weapons.endLoan(); expect(weapons.current.id).toBe('sabre');
  });
});
