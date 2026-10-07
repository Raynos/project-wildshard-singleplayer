// @vitest-environment happy-dom
// oxlint-disable-next-line import/no-nodejs-modules -- Node-hosted happy-dom test reads the shipped stylesheet to verify the actual cascade.
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { app } from '../../src/engine/app/runtime';
import { Scope } from '../../src/engine/app/scope';
import { EquipmentService } from '../../src/engine/combat/EquipmentService';
import { INPUT_CONTEXTS } from '../../src/game/inputContexts';
import { TouchControls } from '../../src/engine/player/TouchControls';
import { Spear } from '../../src/shards/nalati-grasslands/runtime/weapons/Spear';
import { fakeWorld } from '../fake/world';

it('renders the spear touch row with working JUMP and THROW, and no BRACE', () => {
  const scope = new Scope('J14-touch'), previous = app.levelScope;
  app.levelScope = scope;
  const style = document.createElement('style');
  style.textContent = readFileSync('src/engine/ui/styles/touch.css', 'utf8'); document.head.append(style);
  const f = fakeWorld(), spear = new Spear({ game: f.game.asGame(), sky: f.sky, player: f.player, forest: f.forest }, { raycast: () => null });
  for (const key of ['preUpdate', 'onHoverChange', 'onSwimChange']) Reflect.set(f.player, key, undefined);
  for (const key of ['hover', 'swimming', 'submerged']) Reflect.set(f.player, key, false);
  const weapons = new EquipmentService(spear, { scope });
  try {
    for (const context of INPUT_CONTEXTS) app.input.register(context, scope);
    app.input.push('onFoot', scope); app.input.push('weapon.spear', scope); app.input.install(scope);
    new TouchControls(f.player, weapons, true);
    const root = document.querySelector('.ws-touch');
    if (!(root instanceof HTMLElement)) throw new Error('touch root missing');
    root.classList.add('throwing', 'lockable');
    const jump = root.querySelector('.jump'), throwButton = root.querySelector('.throw');
    if (!(jump instanceof HTMLElement) || !(throwButton instanceof HTMLElement)) throw new Error('spear row missing');
    expect(root.querySelector('.brace')).toBeNull(); expect(root.textContent).not.toContain('Brace');
    expect(jump.textContent).toBe('Jump'); expect(getComputedStyle(jump).display).toBe('flex');
    expect(jump.style.visibility).not.toBe('hidden'); expect(getComputedStyle(throwButton).display).toBe('flex');
    jump.dispatchEvent(new PointerEvent('pointerdown')); expect(app.input.consume('jump')).toBe(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    expect(app.input.pressed('jump')).toBe(true); expect(app.input.held('heavy')).toBe(false);
    document.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }));
    expect(app.input.bindings.entries().filter((row) => row.context === 'weapon.spear').map((row) => row.action)).toEqual(['attack', 'aim']);
    throwButton.dispatchEvent(new PointerEvent('pointerdown')); expect(weapons.adsHeld).toBe(true);
    throwButton.dispatchEvent(new PointerEvent('pointerup')); expect(weapons.adsHeld).toBe(false);
  } finally { scope.dispose(); app.levelScope = previous; app.input.clear(); style.remove(); document.body.replaceChildren(); }
});
