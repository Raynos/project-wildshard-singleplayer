// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { app } from '#engine-internal/app/runtime';
import { withOwner } from '#engine-internal/app/ownership';
import { isDev, setDev } from '#engine-internal/core/devMode';
import { devSwitchRows } from '../src/engine/ui/devSwitch';

afterEach(() => { setDev(false); document.body.replaceChildren(); vi.restoreAllMocks(); });
it('flips the visual class and aria state on each click', () => {
  const owner = app.engineScope.child('test.dev-switch');
  try {
    setDev(false);
    const rows = withOwner(owner, devSwitchRows);
    document.body.append(...rows);
    const button = rows[1];
    if (!(button instanceof HTMLButtonElement)) throw new Error('missing developer switch');
    for (const next of [true, false]) {
      button.click();
      expect(isDev()).toBe(next);
      expect(button.getAttribute('aria-checked')).toBe(String(next));
      expect(button.classList.contains('on')).toBe(next);
      expect(document.documentElement.dataset['dev'] !== undefined).toBe(next);
    }
  } finally { owner.dispose(); }
});

it('repaints touch-generated clicks even when the page notification cannot reach the switch', () => {
  const owner = app.engineScope.child('test.dev-switch-touch');
  try {
    setDev(false);
    const rows = withOwner(owner, devSwitchRows);
    document.body.append(...rows);
    const button = rows[1];
    if (!(button instanceof HTMLButtonElement)) throw new Error('missing developer switch');
    vi.spyOn(window, 'dispatchEvent').mockReturnValue(true);
    for (const next of [true, false]) {
      button.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', bubbles: true }));
      button.dispatchEvent(new PointerEvent('pointerup', { pointerType: 'touch', bubbles: true }));
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(isDev()).toBe(next);
      expect(button.getAttribute('aria-checked')).toBe(String(next));
      expect(button.classList.contains('on')).toBe(next);
    }
  } finally { owner.dispose(); }
});
