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
 *   show after AWAY_MAX_MS hidden        → reload the same way (E96). After a night in the background iOS handed back a
 *                                          page whose WebGL canvas still drew but whose DOM never repainted: no HUD, no
 *                                          pause menu, no resume screen, white strips round a shifted canvas, and no
 *                                          event to catch it. A long absence is not worth waking in place: the reload
 *                                          lands where the player stood (or on the title, if that is where they were),
 *                                          on the newest build if its worker is waiting.
 *
 */
import type { Game } from './Game';
import { gpuOnlyContent, rebakeGpuContent } from './gpuOnly';
import { resumeScreen, SHOT_KEY } from '../ui/Resume';
import { layout, trace, traceReturn, traceWorldReady } from './lifeTrace';

export interface RecoveryHost {
  game: Game;
  /** re-render content that only ever lived on the GPU (after an in-place restore, before the first frame) */
  rebuild: () => void;
  /** where the player stands, carried through a reload as ?at=x,y,z,yaw,pitch (null: spawn as usual) */
  pose: () => { x: number; y: number; z: number; yaw: number; pitch: number } | null;
  /** this page IS a recovery reload: the resume screen is up from index.html — drop it once the world draws */
  resumed: boolean;
  /**
   * E155: the shard is parked (another resident shard is playing) — a context it loses now is not the player's problem:
   * no resume screen, no reload; `onLostParked` tells the shard host, which evicts it (it rebuilds on the way back).
   * An evicted shard's own `forceContextLoss` lands here too.
   */
  parked?: () => boolean;
  onLostParked?: () => void;
}

/**
 * The shortest the resume screen stays up after an app switch (E98). Dropped two frames after the first draw, it was fully
 * up for ~40 ms and gone in ~170: on a 30 fps phone, one or two frames of dark glass that read as a black blink, never
 * as a screen.
 */
const MIN_SHOW_MS = 500;
/** wall-clock time hidden after which coming back reloads instead of waking the page in place (E96) */
const AWAY_MAX_MS = 10 * 60_000;
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
  if (canvas !== game.canvas) return; // an offscreen canvas of our own, not the one the player sees
  const gl = game.renderer.getContext();
  const screen = resumeScreen();

  let phase: Phase = 'ok';
  let hidden = document.visibilityState === 'hidden';
  let hiddenAt = hidden ? Date.now() : 0; // wall clock: performance.now() does not run while iOS suspends the page
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

  /** drop the resume screen once the loop has drawn a frame on a live context (two animation frames), `minMs` at the earliest */
  const revealWhenDrawn = (minMs = 0): void => {
    const mine = epoch;
    const t0 = performance.now();
    const drop = (): void => { if (mine === epoch && phase === 'ok' && !gl.isContextLost()) screen.hide(); };
    requestAnimationFrame(() => { requestAnimationFrame(() => { window.setTimeout(drop, Math.max(0, minMs - (performance.now() - t0))); }); });
  };

  /**
   * The still for the way back: one frame drawn now and copied in the same task (the buffer is not preserved). Taken on
   * `blur` too, which comes before `hidden` on an app switch while the page still draws. A hidden page may hand back an
   * undrawn (transparent → black JPEG) buffer; a blank still never replaces a good one.
   */
  const takeStill = (): void => {
    if (phase !== 'ok') return;
    const still = game.snapshot(SHOT_W);
    if (!still || blank(still)) return;
    try { shot = still.toDataURL('image/jpeg', 0.7); sessionStorage.setItem(SHOT_KEY, shot); } catch { /* keep the last one */ }
  };

  const stopTimer = (): void => { if (timer !== 0) { clearInterval(timer); timer = 0; } };
  /** `away`: the long-absence reload — a player on the title gets the title back, and a waiting newer build is taken */
  const reload = (why: string, away = false): void => {
    if (phase === 'reloading' || phase === 'stuck') return;
    epoch++;
    stopTimer();
    game.hold = true;
    document.dispatchEvent(new Event('ws:background'));
    console.warn(`[gl] reloading: ${why}`);
    trace('reload', `${why}${away ? ' (away)' : ''}`);
    const now = Date.now();
    let recent: number[] = [];
    try { recent = (JSON.parse(sessionStorage.getItem(RELOAD_KEY) ?? '[]') as number[]).filter((t) => now - t < RELOAD_WINDOW_MS); } catch { /* no session storage: allow the reload */ }
    const url = new URL(location.href);
    url.searchParams.delete('v');
    const pose = host.pose();
    if (pose) url.searchParams.set('at', [pose.x, pose.y, pose.z, pose.yaw, pose.pitch].map((v) => (Math.round(v * 100) / 100).toString()).join(','));
    if (!away || pose) url.searchParams.set(RELOAD_PARAM, '1'); // ?glreload skips the title: only for a player who was in the world
    const to = url.toString();
    const sw = away ? window.__ws_sw : undefined;
    const go = (): void => {
      void (async () => {
        if (sw?.waiting && sw.waiting.state !== 'redundant') await sw.adopt(to); // navigates on the hand-over; returns only if it never landed
        location.replace(to);
      })();
    };
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
    trace('lost', `${why} · canvases ${canvasesWiped() ? 'wiped' : 'intact'}`);
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
    trace('restore', 'in place');
    watch(RESTORE_MAX_S, 'the restore took too long');
    screen.show(shot);
    screen.progress(0);
    const t0 = performance.now();
    try {
      await game.precompile((done, total) => { if (mine === epoch) screen.progress(total > 0 ? 0.9 * done / total : 0); });
      if (mine !== epoch) return;
      host.rebuild();
      rebakeGpuContent(); // the runtime bakes that can paint themselves again (gpuOnly.ts onGpuRestored)
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
    trace('restored', `${Math.round(performance.now() - t0)} ms`);
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

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    if (host.parked?.() === true) { console.warn('[gl] a parked shard lost its context'); host.onLostParked?.(); return; }
    lose('context lost');
  });
  canvas.addEventListener('webglcontextrestored', () => { if (host.parked?.() !== true) void restore(); });

  const hide = (): void => {
    if (hidden) return; // visibilitychange and pagehide both land here
    hidden = true;
    hiddenAt = Date.now();
    epoch++;
    takeStill();
    trace('hide', `${phase} · ${layout()}`);
    screen.show(shot); // up while hidden: the switch back paints this first
    document.dispatchEvent(new Event('ws:background')); // the HUD pauses into the menu (a no-op on the title / already paused)
  };
  const show = (): void => {
    if (!hidden) return;
    hidden = false;
    const away = Date.now() - hiddenAt;
    repaint();
    if (hiddenAt > 0 && away > AWAY_MAX_MS && (phase === 'ok' || phase === 'lost')) { traceReturn(away, 'away-reload'); reload(`back after ${Math.round(away / 60_000)} min away`, true); return; }
    if (phase !== 'ok') { traceReturn(away, `phase ${phase}`); return; } // lost / restoring / reloading: the screen stays until that path ends
    if (gl.isContextLost()) { traceReturn(away, 'lost while hidden'); lose('context lost while hidden (no event)'); return; }
    traceReturn(away, 'in place');
    game.kickLoop(); // the frame loop, if the browser dropped its animation frame across the switch
    revealWhenDrawn(MIN_SHOW_MS);
    const mine = epoch;
    window.setTimeout(() => { if (mine === epoch && phase === 'ok' && !gl.isContextLost()) screen.hide(); }, 1500); // never leave it up
  };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') hide(); else show(); });
  window.addEventListener('pagehide', hide);
  window.addEventListener('blur', () => { if (!hidden) takeStill(); });
  window.addEventListener('pageshow', (e) => { if (e.persisted) show(); });

  // a recovery reload: index.html put the screen up before any of this ran; the world is built and drawing now
  // (still in the background: show() drops it on the way back)
  if (host.resumed) { screen.progress(1); if (!hidden) revealWhenDrawn(); }
  traceWorldReady();
}

/**
 * Make WebKit paint every DOM layer again (E135). Jake's home-screen app came back from 10+ min away with the canvas
 * drawing and nothing the DOM paints showing (white where the page's dark background should be, no HUD): iOS may drop
 * a suspended page's tile backing stores and not repaint them. A two-frame opacity change on <html> makes it a
 * compositing layer and back, which repaints its contents; the player sees nothing (0.999).
 */
function repaint(): void {
  const s = document.documentElement.style;
  s.opacity = '0.999';
  requestAnimationFrame(() => { requestAnimationFrame(() => { s.opacity = ''; }); });
}

/** a still with nothing drawn in it: every sampled pixel near black (a transparent buffer encodes as black) */
function blank(c: HTMLCanvasElement): boolean {
  let d: Uint8ClampedArray;
  try { const ctx = c.getContext('2d'); if (!ctx) return true; d = ctx.getImageData(0, 0, c.width, c.height).data; } catch { return true; }
  let sum = 0, n = 0;
  for (let i = 0; i + 2 < d.length; i += 4 * 7) { sum += (d[i] ?? 0) + (d[i + 1] ?? 0) + (d[i + 2] ?? 0); n++; }
  return n === 0 || sum / (3 * n) < 6;
}
