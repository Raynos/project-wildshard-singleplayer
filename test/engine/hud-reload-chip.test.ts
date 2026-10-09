// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Scope } from '../../src/engine/app/scope';
import { app } from '../../src/engine/app/runtime';
import { hudSlots } from '../../src/engine/ui/hudSlots';
import { HUD, type HUDState } from '../../src/engine/ui/HUD';
import { INPUT_CONTEXTS } from '../../src/game/inputContexts';
import { LEVER, CROSSBOW, LONGBOW } from '../../src/shards/pine-hollow/weapons/equipment';
import { AR15 } from '../../src/shards/nalati-grasslands/weapons/equipment';
import { SWORD } from '../../src/game/weapons/starterEquipment';
import { LeverRifle } from '../../src/shards/pine-hollow/runtime/weapons/LeverRifle';
import { Rifle } from '../../src/shards/nalati-grasslands/runtime/weapons/Rifle';
import { legacyActor } from '../fake/legacyActor';

let scope: Scope;
const parked = hudSlots.snapshot();
beforeEach(() => {
  scope = new Scope('reload-chip-test'); app.levelScope = scope;
  hudSlots.restore({ layer: null, status: null, pending: [] });
  const layer = document.createElement('div'), status = document.createElement('div');
  layer.append(status); document.body.append(layer); hudSlots.mount(layer, status);
});
afterEach(() => { scope.dispose(); app.levelScope = null; app.input.clear(); hudSlots.restore(parked); document.body.replaceChildren(); });
function fixture(ui = LEVER.ui, max = 7) {
  const hud = new HUD({ pointerLock: false, weaponUi: ui, maxBolts: max }); hud.entered = true;
  const chip = document.querySelector<HTMLButtonElement>('.ws-game-bolts');
  if (!chip) throw new Error('Missing ammo chip');
  const glyph = chip.querySelector<HTMLElement>('.ws-game-glyph');
  if (!glyph) throw new Error('Missing ammo glyph');
  const state: HUDState = { weaponUi: ui, bolts: max, maxBolts: max, reserve: 21, loaded: true, reloading: false, health: 100, pos: { x: 0, z: 0 }, yaw: 0, kills: 0 };
  hud.setState(state);
  return { hud, chip, glyph, state };
}
describe('J13 magazine chip reload', () => {
  it.each([[LEVER.ui, 7], [AR15.ui, 30]] as const)('shows the reload glyph only below full for %s', (ui, max) => {
    const f = fixture(ui, max), reload = vi.fn(); app.input.bind('reload', () => { reload(); }, scope);
    expect(f.chip.classList.contains('magazine')).toBe(true); expect(f.glyph.hidden).toBe(true); expect(f.chip.disabled).toBe(true);
    f.chip.click(); expect(reload).not.toHaveBeenCalled();
    f.state.bolts = max - 1; f.hud.setState(f.state);
    expect(f.glyph.hidden).toBe(false); expect(f.chip.disabled).toBe(false); f.chip.click(); expect(reload).toHaveBeenCalledOnce();
    f.state.reloading = true; f.hud.setState(f.state);
    expect(f.glyph.hidden).toBe(false); expect(f.chip.disabled).toBe(true); expect(f.chip.classList.contains('reloading')).toBe(true);
    f.chip.click(); expect(reload).toHaveBeenCalledOnce();
    f.state.bolts = max; f.hud.setState(f.state); expect(f.glyph.hidden).toBe(true);
    f.state.reloading = false; f.state.bolts = 0; f.state.loaded = false; f.hud.setState(f.state); expect(f.glyph.hidden).toBe(false);
    f.state.reserve = 0; f.hud.setState(f.state); expect(f.glyph.hidden).toBe(false); expect(f.chip.disabled).toBe(true);
  });
  it('taps through the real lever reload method', () => {
    const f = fixture(), lever = legacyActor(LeverRifle.prototype, {
      state: { ammo: 4, magazine: 7, reserve: 21, reloading: false, reloadProgress: 0 },
      tube: 3, chambered: true, phase: 'idle', phaseT: 0, fed: 0, stopAfter: false,
      equipEvents: undefined, onReloadStart: undefined,
    });
    app.input.bind('reload', () => { lever.reload(); }, scope);
    f.state.bolts = 4; f.hud.setState(f.state); f.chip.click(); expect(lever.state.reloading).toBe(true);
  });
  it('uses the rifle reload path and leaves desktop R and desktop markup unchanged', () => {
    const f = fixture(AR15.ui, 30);
    const rifle = legacyActor(Rifle.prototype, { state: { ammo: 29, magazine: 30, reserve: 90, reloading: false, reloadProgress: 0 }, profile: { magazine: 30 }, equipEvents: undefined, onReloadStart: undefined });
    app.input.bind('reload', () => { rifle.reload(); }, scope);

    f.state.bolts = 29; f.hud.setState(f.state); f.chip.click(); expect(rifle.state.reloading).toBe(true);
    rifle.state.reloading = false;
    for (const context of INPUT_CONTEXTS) app.input.register(context, scope);
    app.input.push('weapon.ranged', scope); app.input.install(scope);
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR', bubbles: true }));
    expect(rifle.state.reloading).toBe(true);
    document.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyR', bubbles: true }));
    // Only the shared ammo count/status updates; no reload button or reload glyph is added to desktop.
    expect(document.querySelector('.ws-game-ammo button')).toBeNull(); expect(document.querySelector('.ws-game-ammo .ws-game-reload')).toBeNull();
    expect(document.querySelector('.ws-game-ammo .ws-game-count .c')?.textContent).toBe('29');
  });
  it('removes reload behavior when swapping to a quiver or melee and does not reload on the title or after disposal', () => {
    const f = fixture(), reload = vi.fn(); app.input.bind('reload', () => { reload(); }, scope);
    f.state.bolts = 4; f.hud.setState(f.state); f.hud.entered = false; f.chip.click(); expect(reload).not.toHaveBeenCalled(); f.hud.entered = true;
    const modal = app.ui.push('modal', { root: document.createElement('div'), back: () => undefined }, scope);
    f.chip.click(); expect(reload).not.toHaveBeenCalled(); modal.dispose();
    for (const ui of [CROSSBOW.ui, LONGBOW.ui, SWORD.ui]) {
      f.state.weaponUi = ui; f.state.bolts = ui.ammo ? 4 : undefined; f.hud.setState(f.state);
      expect(f.chip.classList.contains('magazine')).toBe(false); expect(f.chip.disabled).toBe(true); expect(f.glyph.classList.contains('ws-game-reload')).toBe(false);
      f.chip.click(); expect(reload).not.toHaveBeenCalled();
    }
    scope.dispose(); f.chip.dispatchEvent(new MouseEvent('click')); expect(reload).not.toHaveBeenCalled();
  });
});
