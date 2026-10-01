import { Scope } from '#engine/app/scope';
// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { app } from '#engine';
import { containMenuInput } from '#engine/input/menuInput';
import { weaponActionGate } from '#engine/input/weaponActions';
import type { Weapon } from '#engine/combat/Weapon';
import { CROSSBOW } from '#shards/pine-hollow/weapons/equipment';
import { legacyDouble } from '../fake/FakeGame';

afterEach(() => { document.body.replaceChildren(); app.setState('boot'); });
it('contains a resume tap and compatibility mouse events while allowing its target click to resume', () => {
  const root = document.createElement('div'), button = document.createElement('button');
  root.append(button); document.body.append(root); containMenuInput(root, new Scope('menu'));
  const shot = vi.fn<() => void>(), resume = vi.fn(() => app.setState('play'));
  const controller = new AbortController();
  for (const type of ['mousedown', 'mouseup', 'pointerdown', 'pointerup', 'click']) document.addEventListener(type, shot, { signal: controller.signal });
  button.addEventListener('click', resume);
  app.setState('paused');
  for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) button.dispatchEvent(new MouseEvent(type, { bubbles: true }));
  expect(resume).toHaveBeenCalledOnce(); expect(app.state).toBe('play'); expect(shot).not.toHaveBeenCalled();
  controller.abort();
});
it('keeps weapon actions under an additive context and blocks them under a menu', () => {
  const scope = new Scope('weapon-input'), shots = vi.fn<() => void>();
  const weapon = legacyDouble<Weapon & { allowUnlocked: boolean }>({ enabled: true, allowUnlocked: true, row: CROSSBOW });
  app.input.register({ id: 'weapon.ranged', actions: ['attack'] }, scope);
  app.input.register({ id: 'test.tool', actions: ['jump'] }, scope);
  app.input.register({ id: 'test.menu', actions: ['back'], blocks: 'below' }, scope);
  app.input.push('weapon.ranged', scope); app.input.push('test.tool', scope);
  app.input.bind('attack', shots, scope, weaponActionGate(weapon, { locked: false }));
  app.input.press('attack'); expect(shots).toHaveBeenCalledOnce();
  app.input.push('test.menu', scope); app.input.press('attack'); expect(shots).toHaveBeenCalledOnce();
  app.input.pop('test.menu'); app.input.press('attack'); expect(shots).toHaveBeenCalledTimes(2);
  scope.dispose();
});
