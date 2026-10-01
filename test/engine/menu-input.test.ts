// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { app } from '#engine';
import { containMenuInput } from '#engine/input/menuInput';
import { Crossbow } from '#engine/player/Crossbow';

afterEach(() => { document.body.replaceChildren(); app.setState('boot'); });
it('contains a resume tap and compatibility mouse events while allowing its target click to resume', () => {
  const root = document.createElement('div'), button = document.createElement('button');
  root.append(button); document.body.append(root); containMenuInput(root);
  const shot = vi.fn<() => void>(), resume = vi.fn(() => app.setState('play'));
  const controller = new AbortController();
  for (const type of ['mousedown', 'mouseup', 'pointerdown', 'pointerup', 'click']) document.addEventListener(type, shot, { signal: controller.signal });
  button.addEventListener('click', resume);
  app.setState('paused');
  for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) button.dispatchEvent(new MouseEvent(type, { bubbles: true }));
  expect(resume).toHaveBeenCalledOnce(); expect(app.state).toBe('play'); expect(shot).not.toHaveBeenCalled();
  controller.abort();
});
it('blocks the real crossbow input predicate while the pause menu is open', () => {
  const state = { enabled: true, player: { locked: false }, allowUnlocked: true };
  const method: unknown = Reflect.get(Crossbow.prototype, 'inputAllowed');
  if (typeof method !== 'function') throw new Error('Missing crossbow input predicate');
  const allowed = method as (this: typeof state) => boolean;
  app.setState('play'); expect(allowed.call(state)).toBe(true);
  app.setState('paused'); expect(allowed.call(state)).toBe(false);
  app.setState('play'); expect(allowed.call(state)).toBe(true);
});
