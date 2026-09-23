/**
 * GPU recovery (E54): what the game does when the phone takes its graphics away — the iOS home-screen app switched
 * out and back, Safari backgrounded, a driver reset.
 *
 * What iOS does (reproduced in WebKit by killing its GPU process, scripts/e54-gpu-recovery.mjs): the page's WebGL
 * context is lost AND every 2D canvas is wiped to transparent — the particle / sprite / smoke / water canvases the
 * scene's textures are made from, the minimap's painted terrain and fog of war. three.js restores the WebGL context by
 * itself, then its next render() re-links every program in one synchronous stall (the boot splits that into batches
 * precisely because one stall is minutes on an iPhone, src/boot/precompile.ts) and re-uploads the wiped canvases as
 * blank textures. That was Jake's "blue and orange, completely broken", then "a still frame of the spawn, can't play".
 *
 * So:
 *   hide (visibilitychange / pagehide)   → `ws:background` (the HUD pauses into the menu, as the native shells and the
 *                                          rotate page already did) and the canvas is hidden, so the lost drawing
 *                                          buffer is never shown on the way back; it is shown again on the first
 *                                          healthy frame
 *   webglcontextlost                     → preventDefault (restorable), the loop holds (no tick, no draw), the
 *                                          "Restoring graphics" page covers everything
 *   webglcontextrestored                 → the canvases survived (a sentinel canvas still holds its colour): restore in
 *                                          place — re-link every program in batches with the page's progress bar
 *                                          (game.precompile, the boot's own step), re-render what only lived on the
 *                                          GPU (`rebuild`: the sky's PMREM environment), draw the first frames, resume
 *                                          under the pause menu;
 *                                          the canvases were wiped (the GPU process died, the iOS case), or the scene
 *                                          holds a runtime bake (gpuOnly.ts), or the restore fails / overruns →
 *   reload                               → save first (every save is already write-through to localStorage), then
 *                                          `location.replace` with `?at=` where the player stood; a clean reload beats
 *                                          a broken frame. Two reloads inside two minutes stop the loop: the page
 *                                          offers a RELOAD button instead.
 *
 * Only for the WebGL canvas the player sees (`?gpu=webgpu` draws through WebGPU and is not covered here).
 */
import '../ui/styles/gpu.css';
import type { Game } from './Game';
import { gpuOnlyContent } from './gpuOnly';

export interface RecoveryHost {
  game: Game;
  /** re-render content that only ever lived on the GPU (after an in-place restore, before the first frame) */
  rebuild: () => void;
  /** where the player stands, carried through a reload as ?at=x,y,z,yaw,pitch (null: spawn as usual) */
  pose: () => { x: number; y: number; z: number; yaw: number; pitch: number } | null;
}

/** visible seconds a lost context may stay lost before the page reloads */
const LOST_MAX_S = 5;
/** visible seconds an in-place restore may take before the page reloads */
const RESTORE_MAX_S = 40;
/** automatic reloads allowed inside RELOAD_WINDOW_MS before the page asks instead */
const RELOADS_MAX = 2;
const RELOAD_WINDOW_MS = 120_000;
const RELOAD_KEY = 'wsGpuReloads'; // sessionStorage, deliberately not `ws.`: the native save mirror copies every ws.* key

/** URL param the reload adds; main.ts strips it (and ?at=) from the address once read */
export const RELOAD_PARAM = 'glreload';

type Phase = 'ok' | 'lost' | 'restoring' | 'reloading' | 'stuck';

/** The full-screen page over everything while the graphics come back (index.html's rotate page is the only thing above it). */
class RecoveryPage {
  private root: HTMLDivElement | null = null;
  private title: HTMLElement | null = null;
  private sub: HTMLElement | null = null;
  private bar: HTMLElement | null = null;
  private btn: HTMLButtonElement | null = null;
  private onButton: (() => void) | null = null;

  private build(): HTMLDivElement {
    const root = document.createElement('div');
    root.className = 'ws-gpu';
    root.setAttribute('role', 'alertdialog');
    root.setAttribute('aria-modal', 'true');
    root.innerHTML = `<div class="ws-gpu-panel">
<div class="ws-gpu-kicker">Graphics</div>
<div class="ws-gpu-title"></div>
<div class="ws-gpu-bar"><i></i></div>
<div class="ws-gpu-sub"></div>
<button type="button" class="ws-gpu-btn">Reload</button>
</div>`;
    this.title = root.querySelector('.ws-gpu-title');
    this.sub = root.querySelector('.ws-gpu-sub');
    this.bar = root.querySelector('.ws-gpu-bar');
    this.btn = root.querySelector('.ws-gpu-btn');
    this.btn?.addEventListener('click', () => { this.onButton?.(); });
    // nothing behind it takes a touch or a key while it is up
    for (const type of ['pointerdown', 'touchstart', 'keydown', 'wheel']) root.addEventListener(type, (e) => { if (e.target !== this.btn) e.stopPropagation(); });
    document.body.append(root);
    this.root = root;
    return root;
  }

  show(title: string, sub: string, progress: number | null, button?: () => void): void {
    const root = this.root ?? this.build();
    if (this.title) this.title.textContent = title;
    if (this.sub) this.sub.textContent = sub;
    this.bar?.classList.toggle('busy', progress === null);
    if (progress !== null) this.progress(progress, sub);
    this.onButton = button ?? null;
    this.btn?.classList.toggle('on', button !== undefined);
    root.classList.add('show');
  }

  progress(f: number, sub: string): void {
    this.bar?.classList.remove('busy');
    const fill = this.bar?.firstElementChild;
    if (fill instanceof HTMLElement) fill.style.transform = `scaleX(${Math.max(0, Math.min(1, f)).toFixed(3)})`;
    if (this.sub) this.sub.textContent = sub;
  }

  hide(): void { this.root?.classList.remove('show'); }
}

export function installGpuRecovery(host: RecoveryHost): void {
  const { game } = host;
  const canvas = game.renderer.domElement;
  if (canvas !== game.canvas) return; // the WebGPU path draws the visible canvas
  const gl = game.renderer.getContext();

  let phase: Phase = 'ok';
  let epoch = 0; // a newer loss abandons an in-flight restore
  let visibleMs = 0; // visible time spent in the current lost / restoring phase
  let timer = 0;
  const page = new RecoveryPage();

  // A canvas the size the browsers accelerate, painted once: a GPU-process restart wipes it with the game's own.
  // Read back only when a context comes back — frequent readbacks would move it to the CPU and hide the wipe.
  const sentinel = document.createElement('canvas');
  sentinel.width = sentinel.height = 64;
  const sctx = sentinel.getContext('2d');
  if (sctx) { sctx.fillStyle = 'rgb(255, 0, 255)'; sctx.fillRect(0, 0, 64, 64); }
  const canvasesWiped = (): boolean => {
    if (!sctx) return false;
    try { const d = sctx.getImageData(32, 32, 1, 1).data; return !(d[0] === 255 && d[1] === 0 && d[2] === 255 && d[3] === 255); } catch { return true; }
  };

  const showCanvas = (on: boolean): void => { canvas.style.visibility = on ? '' : 'hidden'; };
  /** show the canvas again once a frame has been drawn on a live context */
  const revealWhenDrawn = (): void => {
    requestAnimationFrame(() => { requestAnimationFrame(() => { if (phase === 'ok' && !gl.isContextLost()) showCanvas(true); }); });
  };

  const stopTimer = (): void => { if (timer !== 0) { clearInterval(timer); timer = 0; } };
  const reload = (why: string): void => {
    if (phase === 'reloading' || phase === 'stuck') return;
    epoch++;
    stopTimer();
    game.hold = true;
    showCanvas(false);
    document.dispatchEvent(new Event('ws:background'));
    console.warn(`[gl] reloading: ${why}`);
    const now = Date.now();
    let recent: number[] = [];
    try { recent = (JSON.parse(sessionStorage.getItem(RELOAD_KEY) ?? '[]') as number[]).filter((t) => now - t < RELOAD_WINDOW_MS); } catch { /* no session storage: allow the reload */ }
    const url = new URL(location.href);
    url.searchParams.delete('v');
    const pose = host.pose();
    if (pose) url.searchParams.set('at', [pose.x, pose.y, pose.z, pose.yaw, pose.pitch].map((v) => (Math.round(v * 100) / 100).toString()).join(','));
    url.searchParams.set(RELOAD_PARAM, '1');
    const go = (): void => { location.replace(url.toString()); };
    if (recent.length >= RELOADS_MAX) {
      phase = 'stuck';
      page.show('Graphics lost', 'Your progress is saved · reload to continue', null, go);
      return;
    }
    phase = 'reloading';
    try { sessionStorage.setItem(RELOAD_KEY, JSON.stringify([...recent, now])); } catch { /* the guard just will not count this one */ }
    page.show('Restoring graphics', 'Reloading · your progress is saved', null);
    setTimeout(go, 150); // let the page paint first
  };

  /** count visible time in the current phase; past `max` seconds, reload */
  const watch = (max: number, why: string): void => {
    stopTimer(); visibleMs = 0;
    timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      visibleMs += 500;
      if (visibleMs > max * 1000) reload(why);
    }, 500);
  };

  const lose = (why: string): void => {
    epoch++;
    if (phase === 'reloading' || phase === 'stuck') return;
    phase = 'lost';
    game.hold = true;
    showCanvas(false);
    document.dispatchEvent(new Event('ws:background'));
    page.show('Restoring graphics', 'Waiting for the GPU', null);
    console.warn(`[gl] ${why}: holding the frame loop`);
    watch(LOST_MAX_S, 'the context stayed lost');
  };

  const restore = async (): Promise<void> => {
    if (phase === 'reloading' || phase === 'stuck') return;
    if (canvasesWiped()) { reload('the GPU process restarted: every canvas was wiped'); return; }
    const bakes = gpuOnlyContent();
    if (bakes.length > 0) { reload(`runtime bakes cannot be restored (${bakes.join(', ')})`); return; }
    const mine = ++epoch;
    phase = 'restoring';
    watch(RESTORE_MAX_S, 'the restore took too long');
    page.show('Restoring graphics', 'Rebuilding shaders', 0);
    const t0 = performance.now();
    try {
      await game.precompile((done, total) => { if (mine === epoch) page.progress(total > 0 ? done / total : 0, `Rebuilding shaders · ${done} / ${total}`); });
      if (mine !== epoch) return;
      host.rebuild();
      page.progress(1, 'First frame');
      await game.firstFrame();
      if (mine !== epoch) return;
      if (gl.isContextLost()) throw new Error('lost again during the restore');
    } catch (e) {
      if (mine === epoch) reload(`the restore failed (${e instanceof Error ? e.message : String(e)})`);
      return;
    }
    stopTimer();
    phase = 'ok';
    game.hold = false;
    page.hide();
    revealWhenDrawn();
    console.warn(`[gl] restored in place in ${Math.round(performance.now() - t0)} ms`);
    // the scene must actually draw again: no frame on a live, open gate within a few visible seconds → reload
    game.lastFrame.calls = -1;
    let waited = 0;
    const check = window.setInterval(() => {
      if (mine !== epoch || phase !== 'ok') { clearInterval(check); return; }
      if (document.visibilityState !== 'visible' || !game.frameGate()) return;
      waited += 500;
      if (game.lastFrame.calls > 0) clearInterval(check);
      else if (waited > 4000) { clearInterval(check); reload('no frame after the restore'); }
    }, 500);
  };

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lose('context lost'); });
  canvas.addEventListener('webglcontextrestored', () => { void restore(); });

  const hide = (): void => {
    document.dispatchEvent(new Event('ws:background')); // the HUD pauses into the menu (a no-op on the title / already paused)
    if (phase === 'ok') showCanvas(false);
  };
  const show = (): void => {
    if (phase !== 'ok') return;
    if (gl.isContextLost()) { lose('context lost while hidden (no event)'); return; }
    game.kickLoop(); // the frame loop, if the browser dropped its animation frame across the switch
    revealWhenDrawn();
    window.setTimeout(() => { if (phase === 'ok' && !gl.isContextLost()) showCanvas(true); }, 1500); // never leave it hidden
  };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') hide(); else show(); });
  window.addEventListener('pagehide', hide);
  window.addEventListener('pageshow', (e) => { if (e.persisted) show(); });
}
