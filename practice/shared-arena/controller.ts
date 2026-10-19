import { replacePracticeCanvas } from '../../src/practiceCanvas';
import { arenaUrlOpponent } from './selection';
import type { PracticeDemo } from './runtime';

export type ArenaControllerDemo = Pick<PracticeDemo, 'choices' | 'select' | 'retry' | 'back' | 'dispose'>;

/** Serialized UI lifecycle; the real boot function is supplied by the page entry. */
export function installArenaPage(boot: (canvas: HTMLCanvasElement, status: (message: string) => void) => Promise<ArenaControllerDemo>): void {
  const status = document.getElementById('arena-status');
  const start = document.getElementById('arena-start');
  const select = document.getElementById('arena-opponent');
  const back = document.getElementById('arena-back');
  const retry = document.getElementById('arena-retry');
  let canvas = document.getElementById('game');
  if (!(start instanceof HTMLButtonElement) || !(select instanceof HTMLSelectElement) ||
      !(back instanceof HTMLButtonElement) || !(retry instanceof HTMLButtonElement) ||
      !(canvas instanceof HTMLCanvasElement) || status === null) throw new Error('Arena page is incomplete');
  const controls = { start, select, back, retry, status };
  const requested = arenaUrlOpponent(location.search, location.hash);
  if (requested !== undefined) controls.select.value = requested;
  const unavailable = (): boolean => Array.from(controls.select.options).find(option => option.value === controls.select.value)?.disabled !== false;
  const unavailableMessage = (): string => controls.select.value === 'bellback' ? 'Bellback is unavailable pending admission. Choose another enemy.' : 'This enemy is mockup only and unavailable for play. Choose another enemy.';
  if (unavailable()) controls.status.textContent = unavailableMessage();
  let demo: ArenaControllerDemo | null = null;
  let busy = false;
  let active = false;
  let disposed = false;
  const isDisposed = (): boolean => disposed;
  const report = (message: string): void => { controls.status.textContent = message; };
  function update(): void {
    controls.start.hidden = active;
    controls.back.hidden = !active;
    controls.retry.hidden = !active;
    controls.start.disabled = busy || unavailable();
    controls.select.disabled = busy;
    controls.retry.disabled = busy;
    controls.back.disabled = busy;
  }
  async function begin(): Promise<void> {
    if (busy || disposed || unavailable() || !(canvas instanceof HTMLCanvasElement)) return;
    busy = true; update(); report('Loading the shared arena…');
    try {
      if (demo === null) {
        const loaded = await boot(canvas, report);
        if (isDisposed()) { loaded.dispose(); return; }
        demo = loaded;
      }
      const choice = demo.choices.find(row => row.id.startsWith(`${controls.select.value}:`));
      if (choice === undefined) throw new Error('This opponent is unavailable.');
      active = await demo.select(choice.id);
      if (!active) report('Opponent failed to load. Start retries this selection.');
    } catch (error: unknown) {
      active = false;
      if (demo === null && canvas instanceof HTMLCanvasElement) canvas = replacePracticeCanvas(canvas);
      report(error instanceof Error ? error.message : 'Arena failed to load.');
    } finally { busy = false; update(); }
  }
  controls.start.addEventListener('click', () => { void begin(); });
  controls.select.addEventListener('change', () => {
    update();
    if (active) void begin();
    else report(unavailable() ? unavailableMessage() : 'Choose an enemy, then Start.');
  });
  controls.retry.addEventListener('click', () => { if (!busy && active) demo?.retry(); });
  controls.back.addEventListener('click', () => {
    if (busy) return;
    demo?.back(); active = false; update();
    if (typeof document.exitPointerLock === 'function' && document.pointerLockElement !== null) document.exitPointerLock();
    report('Choose an enemy, then Start. Bellback is awaiting admission.');
  });
  window.addEventListener('pagehide', () => { disposed = true; demo?.dispose(); demo = null; });
  window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
  update();

}
