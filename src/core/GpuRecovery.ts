/**
 * GPU recovery (E54) and the app-switch resume (E61): what the game does when the phone takes its graphics away — the
 * iOS home-screen app switched out and back, Safari backgrounded, a driver reset.
 *
 * What iOS does (reproduced in WebKit by killing its GPU process, scripts/e54-gpu-recovery.mjs): the page's WebGL
 * context is lost AND every 2D canvas is wiped to transparent — the particle / sprite / smoke / water canvases the
 * scene's textures are made from, the minimap's painted terrain and fog of war. three.js restores the WebGL context by
 * itself, then its next render() re-links every program in one synchronous stall (the boot splits that into batches
 * precisely because one stall is minutes on an iPhone, src/boot/precompile.ts) and re-uploads the wiped canvases as
 * blank textures. That was Jake's "blue and orange, completely broken", then "a still frame of the spawn, can't play".
 *
 * So:
 *   hide (visibilitychange / pagehide)   → a small still of the frame (Game.snapshot, kept in sessionStorage for a
 *                                          reload), the resume screen goes up WHILE HIDDEN (src/ui/Resume.ts) so the
 *                                          first frame after the switch back is that screen — never black, never the
 *                                          lost buffer — and `ws:background` pauses into the menu
 *   show                                 → the context is live: restart the loop if it died, drop the screen once a
 *                                          frame has been drawn (a couple of animation frames)
 *   webglcontextlost                     → preventDefault (restorable), the loop holds (no tick, no draw); the canvases
 *                                          are already wiped (the GPU process died, the iOS case) → reload at once,
 *                                          without waiting for the restore
 *   webglcontextrestored                 → canvases intact: restore in place — re-link every program in batches with
 *                                          the hairline as progress (game.precompile), re-render what only lived on
 *                                          the GPU (`rebuild`: the sky's PMREM environment), draw, resume under the menu;
 *                                          canvases wiped, a runtime bake in the scene (gpuOnly.ts), a failed or
 *                                          overlong restore →
 *   reload                               → `location.replace` with `?at=` where the player stood and `?glreload`: the
 *                                          page comes back on the SAME resume screen (index.html's inline script — the
 *                                          first-boot loader never shows), skips the title and lands in the world under
 *                                          the pause menu (main.ts). Saves are write-through to localStorage already.
 *                                          Two reloads inside two minutes stop the loop: a RELOAD button instead.
 *
 * Only for the WebGL canvas the player sees (`?gpu=webgpu` draws through WebGPU and is not covered here).
 */
import type { Game } from './Game';
import { gpuOnlyContent } from './gpuOnly';
import { resumeScreen, SHOT_KEY } from '../ui/Resume';

export interface RecoveryHost {
  game: Game;
  /** re-render content that only ever lived on the GPU (after an in-place restore, before the first frame) */
  rebuild: () => void;
  /** where the player stands, carried through a reload as ?at=x,y,z,yaw,pitch (null: spawn as usual) */
  pose: () => { x: number; y: number; z: number; yaw: number; pitch: number } | null;
  /** this page IS a recovery reload: the resume screen is up from index.html — drop it once the world draws */
  resumed: boolean;
}

/** visible seconds a lost context may stay lost before the page reloads */
const LOST_MAX_S = 5;
/** visible seconds an in-place restore may take before the page reloads */
const RESTORE_MAX_S = 40;
/** automatic reloads allowed inside RELOAD_WINDOW_MS before the page asks instead */
const RELOADS_MAX = 2;
const RELOAD_WINDOW_MS = 120_000;
const RELOAD_KEY = 'wsGpuReloads'; // sessionStorage, deliberately not `ws.`: the native save mirror copies every ws.* key
/** the resume still: px wide (the screen scales it up and blurs it — a few KB of JPEG) */
const SHOT_W = 120;

/** URL param the reload adds (index.html's inline script and main.ts read it; main.ts strips it and ?at= once read) */
export const RELOAD_PARAM = 'glreload';

type Phase = 'ok' | 'lost' | 'restoring' | 'reloading' | 'stuck';

export function installGpuRecovery(host: RecoveryHost): void {
  const { game } = host;
  const canvas = game.renderer.domElement;
  if (canvas !== game.canvas) return; // the WebGPU path draws the visible canvas
  const gl = game.renderer.getContext();
  const screen = resumeScreen();

  let phase: Phase = 'ok';
  let hidden = document.visibilityState === 'hidden';
  let epoch = 0; // a newer loss abandons an in-flight restore / reveal
  let visibleMs = 0; // visible time spent in the current lost / restoring phase
  let timer = 0;
  let shot: string | null = null;
  try { shot = sessionStorage.getItem(SHOT_KEY); } catch { /* no still: the dark glass alone */ }

  // A canvas the size the browsers accelerate, painted once: a GPU-process restart wipes it with the game's own.
  // Read back only on a loss / restore — frequent readbacks would move it to the CPU and hide the wipe.
  const sentinel = document.createElement('canvas');
  sentinel.width = sentinel.height = 64;
  const sctx = sentinel.getContext('2d');
  if (sctx) { sctx.fillStyle = 'rgb(255, 0, 255)'; sctx.fillRect(0, 0, 64, 64); }
  const canvasesWiped = (): boolean => {
    if (!sctx) return false;
    try { const d = sctx.getImageData(32, 32, 1, 1).data; return !(d[0] === 255 && d[1] === 0 && d[2] === 255 && d[3] === 255); } catch { return true; }
  };

  /** drop the resume screen once the loop has drawn a frame on a live context (two animation frames) */
  const revealWhenDrawn = (): void => {
    const mine = epoch;
    requestAnimationFrame(() => { requestAnimationFrame(() => { if (mine === epoch && phase === 'ok' && !gl.isContextLost()) screen.hide(); }); });
  };

  const stopTimer = (): void => { if (timer !== 0) { clearInterval(timer); timer = 0; } };
  const reload = (why: string): void => {
    if (phase === 'reloading' || phase === 'stuck') return;
    epoch++;
    stopTimer();
    game.hold = true;
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
      screen.stuck('Graphics lost · your progress is saved', go);
      return;
    }
    phase = 'reloading';
    try { sessionStorage.setItem(RELOAD_KEY, JSON.stringify([...recent, now])); } catch { /* the guard just will not count this one */ }
    screen.show(shot);
    go();
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
    screen.show(shot);
    document.dispatchEvent(new Event('ws:background'));
    console.warn(`[gl] ${why}: holding the frame loop`);
    // the GPU process died (every canvas wiped): nothing to restore in place — do not wait for the restore event
    if (canvasesWiped()) { reload('the GPU process restarted: every canvas was wiped'); return; }
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
    screen.show(shot);
    screen.progress(0);
    const t0 = performance.now();
    try {
      await game.precompile((done, total) => { if (mine === epoch) screen.progress(total > 0 ? 0.9 * done / total : 0); });
      if (mine !== epoch) return;
      host.rebuild();
      screen.progress(0.95);
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
    screen.progress(1);
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
    if (hidden) return; // visibilitychange and pagehide both land here
    hidden = true;
    epoch++;
    if (phase === 'ok') {
      // the still for the way back: one frame drawn now and copied in the same task (the buffer is not preserved)
      const still = game.snapshot(SHOT_W);
      if (still) {
        try { shot = still.toDataURL('image/jpeg', 0.7); sessionStorage.setItem(SHOT_KEY, shot); } catch { /* keep the last one */ }
      }
    }
    screen.show(shot); // up while hidden: the switch back paints this first
    document.dispatchEvent(new Event('ws:background')); // the HUD pauses into the menu (a no-op on the title / already paused)
  };
  const show = (): void => {
    if (!hidden) return;
    hidden = false;
    if (phase !== 'ok') return; // lost / restoring / reloading: the screen stays until that path ends
    if (gl.isContextLost()) { lose('context lost while hidden (no event)'); return; }
    game.kickLoop(); // the frame loop, if the browser dropped its animation frame across the switch
    revealWhenDrawn();
    const mine = epoch;
    window.setTimeout(() => { if (mine === epoch && phase === 'ok' && !gl.isContextLost()) screen.hide(); }, 1500); // never leave it up
  };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') hide(); else show(); });
  window.addEventListener('pagehide', hide);
  window.addEventListener('pageshow', (e) => { if (e.persisted) show(); });

  // a recovery reload: index.html put the screen up before any of this ran; the world is built and drawing now
  // (still in the background: show() drops it on the way back)
  if (host.resumed) { screen.progress(1); if (!hidden) revealWhenDrawn(); }
}
