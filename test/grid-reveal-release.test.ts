// @vitest-environment happy-dom
import { afterEach, expect, test, vi } from 'vitest';
import { PerspectiveCamera } from 'three';
import { Scope } from '../src/engine/app/scope';
import { app } from '../src/engine/app/runtime';
import { installGridReveal } from '../src/game/grid/reveal';

const scopes: Scope[] = [];
afterEach(() => {
  for (const scope of scopes.splice(0)) scope.dispose();
  document.body.replaceChildren();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function arrival(ready = false) {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
  const scope = new Scope('reveal.test'); scopes.push(scope);
  const hudRoot = document.createElement('div'); document.body.append(hudRoot);
  const controls = document.createElement('button'); controls.textContent = 'MOVE'; hudRoot.append(controls);
  const weapons = { enabled: true, visible: true, setEnabled(on: boolean): void { this.enabled = on; } };
  const viewmodel = { visible: true };
  let late: () => void = () => { throw new Error('Missing late callback'); };
  const active = installGridReveal({ scope, camera: new PerspectiveCamera(), hudRoot, home: 'Driftwood Isle',
    onLate: fn => { late = () => { fn(1 / 30); }; }, ringsReady: () => ready, homeSimReady: () => ready,
    weapons, viewmodel, entered: () => true });
  late();
  expect(hudRoot.classList.contains('ws-grid-revealing')).toBe(true);
  const released = (): void => {
    expect(active()).toBe(false);
    expect(hudRoot.classList.contains('ws-grid-revealing')).toBe(false);
    expect(hudRoot.querySelector('.ws-grid-reveal')).toBeNull();
    expect(weapons).toMatchObject({ enabled: true, visible: true });
    expect(viewmodel.visible).toBe(true);
    const collect = vi.spyOn(app.input, 'clear');
    const input = app.systemsByPhase().input.find(system => system.id === 'game.grid.reveal.input');
    input?.run(0, 0);
    expect(collect).not.toHaveBeenCalled();
  };
  return { late, hudRoot, released };
}

test('skip releases immediately without ready rings or another gameplay frame', () => {
  const run = arrival();
  run.hudRoot.querySelector('.ws-grid-reveal')?.dispatchEvent(new Event('pointerdown', { bubbles: true }));
  run.released();
  expect(window.__wsReveal?.skipped).toBe(true);
});

test('real-time ceiling releases while gameplay and its clock are gated', () => {
  const run = arrival();
  const frameClock = app.clock.real;
  vi.advanceTimersByTime(27_000);
  expect(app.clock.real).toBe(frameClock);
  run.released();
  expect(window.__wsReveal).toMatchObject({ ceiling: true, endedMs: 27_000 });
});

test('opening and closing a pause menu during arrival leaves it usable', () => {
  const run = arrival();
  window.dispatchEvent(new Event('ws-menu'));
  run.released();
  window.dispatchEvent(new Event('ws-menu'));
  run.late();
  run.released();
});

test('background and return release without needing a resumed gameplay frame', () => {
  const run = arrival();
  document.dispatchEvent(new Event('ws:background'));
  run.released();
  document.dispatchEvent(new Event('visibilitychange'));
  run.late();
  run.released();
});

test('a visible return alone releases an arrival whose hidden event was missed', () => {
  const run = arrival();
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  document.dispatchEvent(new Event('visibilitychange'));
  run.released();
});

test('ready arrival still finishes its authored seven-second path', () => {
  const run = arrival(true);
  vi.advanceTimersByTime(7000);
  run.late();
  run.released();
  expect(window.__wsReveal?.ceiling).toBe(false);
});
