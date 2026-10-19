import { replacePracticeCanvas } from '../../src/practiceCanvas';
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
    controls.start.disabled = busy;
    controls.select.disabled = busy;
    controls.retry.disabled = busy;
    controls.back.disabled = busy;
  }
  async function begin(): Promise<void> {
    if (busy || disposed || !(canvas instanceof HTMLCanvasElement)) return;
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
  controls.select.addEventListener('change', () => { if (active) void begin(); });
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
