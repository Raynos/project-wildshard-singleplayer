// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { Scope } from '#engine/app/scope';
import { app } from '#engine/app/runtime';
import { buildControlsPanel } from '#engine/input/ControlsPanel';

const scopes: Scope[] = [];
afterEach(() => { for (const scope of scopes.splice(0)) scope.dispose(); document.body.replaceChildren(); });
function panel(width: number, height: number, touchPoints: number, fine: boolean) {
  window.innerWidth = width; window.innerHeight = height;
  vi.spyOn(navigator, 'maxTouchPoints', 'get').mockReturnValue(touchPoints);
  const media = window.matchMedia('(pointer: fine)');
  vi.spyOn(media, 'matches', 'get').mockReturnValue(fine);
  vi.spyOn(window, 'matchMedia').mockReturnValue(media);
  const scope = new Scope('controls-test'); scopes.push(scope);
  const card = buildControlsPanel(scope); document.body.append(card);
  return { card, media };
}
it.each([[1440, 900, 0], [1280, 800, 0], [1440, 900, 10]])('shows keyboard bindings on a %ix%i desktop, including a touchscreen laptop (%i touch points)', (width, height, touchPoints) => {
  const { card } = panel(width, height, touchPoints, true);
  expect(window.matchMedia).toHaveBeenCalledWith('(pointer: fine)');
  expect(card.hidden).toBe(false); expect(card.inert).toBe(false);
  expect(card.querySelector('.ws-gmenu-cardtitle')?.textContent).toBe('Key bindings');
  expect(card.querySelectorAll('button').length).toBeGreaterThan(0);
});
it.each([[390, 844], [1440, 900]])('hides the entire Controls entry and panel on %ix%i touch-only devices, including desktop-site mode', (width, height) => {
  const { card } = panel(width, height, 5, false);
  expect(card.hidden).toBe(true); expect(card.inert).toBe(true);
  expect(card.querySelectorAll('.ws-gmenu-row').length).toBe(1);
});
it('responds to pointer-mode changes, cancels active key capture, and disposes its media listener', () => {
  const { card, media } = panel(1440, 900, 5, true);
  const capture = vi.spyOn(app.input, 'captureNextKey');
  // Supply a real row so the test exercises capture cancellation when the device changes.
  app.input.bindings.define('onFoot', { 'move.forward': ['KeyW'] }); card.refresh();
  card.querySelector<HTMLButtonElement>('.ws-gmenu-row button')?.click();
  const owner = capture.mock.calls[0]?.[1]; expect(owner?.disposed).toBe(false);
  vi.spyOn(media, 'matches', 'get').mockReturnValue(false); media.dispatchEvent(new Event('change'));
  expect(card.hidden).toBe(true); expect(owner?.disposed).toBe(true);
  vi.spyOn(media, 'matches', 'get').mockReturnValue(true); media.dispatchEvent(new Event('change'));
  expect(card.hidden).toBe(false);
  scopes[0]?.dispose(); expect(card.isConnected).toBe(false);
  media.dispatchEvent(new Event('change')); expect(card.isConnected).toBe(false);
});
