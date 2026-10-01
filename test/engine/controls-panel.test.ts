// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { Scope } from '#engine/app/scope';
import { app } from '#engine/app/runtime';
import { buildControlsPanel } from '#engine/input/ControlsPanel';
import { INPUT_CONTEXTS } from '../../src/game/inputContexts';
import { KEY_BINDINGS } from '../../src/game/keyBindings';

const scopes: Scope[] = [];
afterEach(() => {
  for (const scope of scopes.splice(0)) scope.dispose();
  for (const context of INPUT_CONTEXTS) app.input.bindings.remove(context.id);
  app.input.bindings.reset(); document.body.replaceChildren(); vi.restoreAllMocks();
});
function panel(width: number, height: number, touchPoints: number, fine: boolean) {
  window.innerWidth = width; window.innerHeight = height;
  vi.spyOn(navigator, 'maxTouchPoints', 'get').mockReturnValue(touchPoints);
  const media = window.matchMedia('(pointer: fine)');
  vi.spyOn(media, 'matches', 'get').mockReturnValue(fine);
  vi.spyOn(window, 'matchMedia').mockReturnValue(media);
  const scope = new Scope('controls-test'); scopes.push(scope);
  app.input.bindings.reset();
  for (const context of INPUT_CONTEXTS) app.input.bindings.define(context.id, context.keys ?? {});
  app.input.bindings.describe(KEY_BINDINGS, scope);
  const card = buildControlsPanel(scope); document.body.append(card);
  return { card, media };
}
const cap = (card: HTMLElement, row: string, cell: number): HTMLButtonElement => {
  const b = card.querySelector<HTMLButtonElement>(`.ws-gmenu-keycap[data-row="${row}"][data-cell="${cell}"]`); if (b === null) throw new Error(`no cell ${row}/${cell}`); return b;
};
it.each([[1440, 900, 0], [1280, 800, 0], [1440, 900, 10]])('shows the key table on a %ix%i desktop, including a touchscreen laptop (%i touch points)', (width, height, touchPoints) => {
  const { card } = panel(width, height, touchPoints, true);
  expect(window.matchMedia).toHaveBeenCalledWith('(pointer: fine)');
  expect(card.hidden).toBe(false); expect(card.inert).toBe(false);
  expect(card.querySelector('.ws-gmenu-cardtitle')?.textContent).toBe('Key bindings');
  const cols = [...card.querySelectorAll('.ws-gmenu-keycol')];
  expect(cols).toHaveLength(2);
  expect([...(cols[0]?.querySelectorAll('.ws-gmenu-keyhead') ?? [])].map((h) => h.textContent)).toEqual(['Action', 'Key', 'Alt']);
  expect(cols.map((col) => [...col.querySelectorAll('.ws-gmenu-keygroup')].map((g) => g.textContent))).toEqual([['On foot', 'Swimming'], ['Combat', 'Menus']]);
  expect(card.textContent).toContain('Move forward'); expect(card.textContent).not.toContain('onFoot');
  expect([cap(card, 'forward', 0), cap(card, 'forward', 1), cap(card, 'dodge', 0), cap(card, 'dodge', 1), cap(card, 'attack', 0)].map((b) => b.textContent)).toEqual(['W', '↑', 'V', 'Alt', 'LMB']);
  expect(card.querySelectorAll('.ws-gmenu-keychips .ws-gmenu-keycap')).toHaveLength(4);
});
it.each([[390, 844], [1440, 900]])('hides the whole Key bindings card on %ix%i touch-only devices, including desktop-site mode', (width, height) => {
  const { card } = panel(width, height, 5, false);
  expect(card.hidden).toBe(true); expect(card.inert).toBe(true);
  expect(card.querySelectorAll('.ws-gmenu-keycap')).toHaveLength(0);
});
it('asks before a clash: amber "Key already used by Attack", SWAP KEYS swaps, CANCEL keeps both', () => {
  const { card } = panel(1440, 900, 0, true);
  const capture = vi.spyOn(app.input, 'captureNextKey');
  cap(card, 'use', 0).click();
  expect(cap(card, 'use', 0).classList.contains('pending')).toBe(true);
  capture.mock.calls.at(-1)?.[0]('KeyF');
  const bar = card.querySelector<HTMLElement>('.ws-gmenu-keyclash');
  expect(bar?.hidden).toBe(false); expect(bar?.textContent).toContain('Key already used by Attack. Swap bindings?');
  expect(cap(card, 'attack', 1).classList.contains('clash')).toBe(true); expect(cap(card, 'use', 0).textContent).toBe('F');
  [...(bar?.querySelectorAll('button') ?? [])].find((b) => b.textContent === 'Cancel')?.click();
  expect(bar?.hidden).toBe(true); expect(cap(card, 'use', 0).textContent).toBe('E');
  cap(card, 'use', 0).click(); capture.mock.calls.at(-1)?.[0]('KeyF');
  [...(bar?.querySelectorAll('button') ?? [])].find((b) => b.textContent === 'Swap keys')?.click();
  expect(cap(card, 'use', 0).textContent).toBe('F'); expect(cap(card, 'attack', 1).textContent).toBe('E');
  [...card.querySelectorAll<HTMLButtonElement>('.ws-gmenu-keyfoot button')].find((b) => b.textContent === 'Reset to defaults')?.click();
  expect(cap(card, 'use', 0).textContent).toBe('E');
});
it('binds a mouse button pressed on the waiting key, and gives up on a press elsewhere', () => {
  const { card } = panel(1440, 900, 0, true);
  cap(card, 'lock', 1).click();
  cap(card, 'lock', 1).dispatchEvent(new MouseEvent('mousedown', { button: 4, bubbles: true }));
  expect(cap(card, 'lock', 1).textContent).toBe('Mouse 5');
  cap(card, 'jump', 0).click(); document.body.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true }));
  expect(cap(card, 'jump', 0).classList.contains('pending')).toBe(false); expect(cap(card, 'jump', 0).textContent).toBe('Space');
});
it('responds to pointer-mode changes, cancels active key capture, and disposes its media listener', () => {
  const { card, media } = panel(1440, 900, 5, true);
  const capture = vi.spyOn(app.input, 'captureNextKey');
  cap(card, 'forward', 0).click();
  const owner = capture.mock.calls[0]?.[1]; expect(owner?.disposed).toBe(false);
  vi.spyOn(media, 'matches', 'get').mockReturnValue(false); media.dispatchEvent(new Event('change'));
  expect(card.hidden).toBe(true); expect(owner?.disposed).toBe(true);
  vi.spyOn(media, 'matches', 'get').mockReturnValue(true); media.dispatchEvent(new Event('change'));
  expect(card.hidden).toBe(false);
  scopes[0]?.dispose(); expect(card.isConnected).toBe(false);
  media.dispatchEvent(new Event('change')); expect(card.isConnected).toBe(false);
});
