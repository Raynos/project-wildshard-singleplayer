// SF58 (13), G168: the HUD half of a disabled script's notice. The amber warn toast and the Developer-only red strip carry
// content-supplied text through textContent; the strip never shows with Developer off.
// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { ToastStack } from '../src/engine/ui/ToastStack';
import { mountDeveloperAlert } from '../src/engine/ui/developerBanner';
import { setDev } from '../src/engine/core/devMode';
import { Scope } from '../src/engine/app/scope';

afterEach(() => { setDev(false); });

describe('G168: the HUD pieces', () => {
  it('the warn toast is amber-classed text, never markup', () => {
    const box = document.createElement('div'), stack = new ToastStack(box);
    stack.push('<b>SOMETHING</b>', 'warn');
    const el = box.querySelector('.ws-game-toast');
    expect(el?.classList.contains('ws-game-toast-warn')).toBe(true);
    expect(el?.textContent).toBe('<b>SOMETHING</b>'); expect(el?.querySelector('b')).toBeNull();
    stack.push('Bolt recovered'); expect(box.querySelectorAll('.ws-game-toast-warn')).toHaveLength(1);
  });
  it('the red strip shows only with Developer on, live, and sets its line as text', () => {
    const root = document.createElement('div'), scope = new Scope('test'), alert = mountDeveloperAlert(root, scope);
    const strip = root.querySelector<HTMLElement>('.ws-game-dev-alert');
    expect(strip?.hidden).toBe(true);
    alert('SCRIPT DISABLED · <i>door.wasm</i> · out of fuel ×3');
    expect(strip?.hidden).toBe(true); // players never see it
    setDev(true); expect(strip?.hidden).toBe(false);
    expect(strip?.textContent).toBe('SCRIPT DISABLED · <i>door.wasm</i> · out of fuel ×3'); expect(strip?.querySelector('i')).toBeNull();
    setDev(false); expect(strip?.hidden).toBe(true);
    scope.dispose();
  });
});
