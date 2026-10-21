/**
 * Entering Infinite Wildshard (SHARD-PLATFORM SF21a, Jake's G98 "B Sky-down reveal"): the camera comes down from about
 * 400 m over Driftwood's pier to the player's eye at the spawn, showing the road and the neighbours on the way, and it
 * covers the streaming the loading screen used to hold for.
 *
 * - It runs in the page's late phase, after the player has placed the camera: each frame reads that pose as the landing
 *   pose, so a spawn that settles on the pier is followed, and the next frame's player update starts from scratch.
 * - Player input is cleared before it is collected and the weapon is off and hidden; the touch layer is hidden behind
 *   the reveal's own full-screen layer, which takes the one tap that skips.
 * - It ends at whichever comes last: the path's end, the rings' readiness (every visible neighbour drawn) and the home
 *   cell's simulation handoff when one is on its way (`gridHomeSim`). A tap releases immediately; the existing soft
 *   walls hold what is not ready. A real-time ceiling and menu/background release cannot depend on gameplay frames.
 * - `window.__wsReveal` carries the timings (ms from the reveal's start) for the menu capture (`sf21a/menu.mjs --reveal`).
 */
import { Matrix4, Quaternion, Vector3, type PerspectiveCamera } from 'three';
import type { Scope } from '@wildshard/engine/app/scope';
import { app } from '@wildshard/engine/app/runtime';
import { hudSlots } from '@wildshard/engine/ui/hudSlots';
import { GAME_STRINGS } from '../strings';
import './gridHud.css';

/** the reveal's timings, in ms of the page clock from its first frame (null: not reached yet) */
export interface RevealTimings {
  readonly startedAt: number; readonly pathEndMs: number | null; readonly ringsReadyMs: number | null; readonly homeSimMs: number | null;
  readonly endedMs: number | null; readonly skipped: boolean; readonly ceiling: boolean;
}
declare global { interface Window { __wsReveal?: RevealTimings } }

export interface GridRevealHost {
  readonly scope: Scope;
  readonly camera: PerspectiveCamera;
  /** the page's #hud root (the reveal hides the HUD under it with a class while it runs) */
  readonly hudRoot: HTMLElement;
  /** the page's late phase, registered after the player's camera */
  readonly onLate: (fn: (dt: number) => void) => void;
  /** the home shard's name for the caption */
  readonly home: string;
  /** the rings' readiness (every visible neighbour drawn) */
  readonly ringsReady: () => boolean;
  /** the home simulation's handoff: true once it arrived, or when none is on its way */
  readonly homeSimReady: () => boolean;
  /** the weapon gate (EquipmentService) */
  readonly weapons: { readonly enabled: boolean; setEnabled: (on: boolean) => void; visible: boolean };
  /** the camera's first-person layer (arms, weapon, board): hidden while the camera flies */
  readonly viewmodel: { visible: boolean };
  /** has the player entered the world (the reveal starts on the first late frame in) */
  readonly entered: () => boolean;
}

/** how long the path takes, and the sky pose relative to the landing pose */
const PATH_S = 7;
const SKY_UP = 400, SKY_BACK = 170, LOOK_AHEAD = 140;
/** past the path's end, how long readiness may hold the player before the reveal lets go anyway */
const CEILING_MS = 20_000;

const smooth = (t: number): number => t * t * (3 - 2 * t);
const clamp01 = (t: number): number => Math.min(1, Math.max(0, t));

/** Install the sky-down reveal on a grid page; it removes itself when it ends or the level scope goes. Returns whether it runs
 *  now (the HUD moments wait for it). */
export function installGridReveal(host: GridRevealHost): () => boolean {
  const { camera } = host;
  const scope = host.scope.child('grid.reveal');
  let started = -1, live = true, skipped = false, ceiling = false;
  let pathEnd: number | null = null, ringsAt: number | null = null, homeAt: number | null = null, endedAt: number | null = null;
  let layer: HTMLElement | null = null;
  let viewmodelWas = true;
  const wasEnabled = host.weapons.enabled, wasVisible = host.weapons.visible;
  const land = new Vector3(), landQ = new Quaternion(), sky = new Vector3(), skyQ = new Quaternion(), look = new Vector3(), fwd = new Vector3(), m = new Matrix4();
  const now = (): number => app.clock.mode === 'capture' ? app.clock.real * 1000 : performance.now();
  const publish = (): void => {
    window.__wsReveal = { startedAt: started, pathEndMs: pathEnd, ringsReadyMs: ringsAt, homeSimMs: homeAt, endedMs: endedAt, skipped, ceiling };
  };
  // the player's input is dropped before it is collected while the reveal runs
  app.addSystem({ id: 'game.grid.reveal.input', phase: 'input', before: ['engine.input.collect'], run: () => { if (live && started >= 0) app.input.clear(); } }, scope);

  const end = (at: number): void => {
    if (!live) return;
    live = false; endedAt = at - started;
    host.hudRoot.classList.remove('ws-grid-revealing');
    if (layer !== null) hudSlots.discard(layer);
    layer = null;
    host.weapons.setEnabled(wasEnabled); host.weapons.visible = wasVisible;
    host.viewmodel.visible = viewmodelWas;
    publish();
    scope.dispose();
  };
  const begin = (at: number): void => {
    started = at;
    host.weapons.setEnabled(false); host.weapons.visible = false;
    viewmodelWas = host.viewmodel.visible;
    host.hudRoot.classList.add('ws-grid-revealing');
    const el = document.createElement('div'); el.className = 'ws-grid-reveal';
    const caption = document.createElement('div'); caption.className = 'ws-grid-reveal-caption';
    const title = document.createElement('b'); title.textContent = GAME_STRINGS.grid.reveal(host.home);
    const skip = document.createElement('span'); skip.textContent = GAME_STRINGS.grid.revealSkip;
    caption.append(title, skip); el.append(caption);
    scope.listen(el, 'pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      skipped = true; pathEnd = now() - started; end(now());
    });
    hudSlots.widget('band.1', el, 0, scope, host.hudRoot);
    layer = el;
    publish();
    // A paused/gated loop never reaches onLate, including its old ceiling.
    // Capture keeps its deterministic clock; live play has a wall-time backstop.
    if (app.clock.mode === 'live') scope.timeout(PATH_S * 1000 + CEILING_MS, () => { ceiling = true; end(now()); });
  };
  scope.onDispose(() => { if (live && started >= 0) { live = false; host.hudRoot.classList.remove('ws-grid-revealing'); host.viewmodel.visible = viewmodelWas; } });
  const release = (): void => { if (live && started >= 0) end(now()); };
  // A pause menu must be visible and usable rather than hidden beneath arrival.
  scope.listen(window, 'ws-menu', release);
  scope.listen(document, 'ws:background', release);
  scope.listen(document, 'visibilitychange', () => { if (document.visibilityState === 'visible') release(); });

  host.onLate(() => {
    if (!live || !host.entered()) return;
    const at = now();
    if (started < 0) begin(at);
    const ms = at - started;
    if (ringsAt === null && host.ringsReady()) ringsAt = ms;
    if (homeAt === null && host.homeSimReady()) homeAt = ms;
    const u = skipped ? 1 : clamp01(ms / (PATH_S * 1000));
    if (u >= 1 && pathEnd === null) { pathEnd = ms; publish(); }
    if (pathEnd !== null && ringsAt !== null && homeAt !== null) { end(at); return; }
    if (pathEnd !== null && ms - pathEnd > CEILING_MS) { ceiling = true; end(at); return; }
    host.viewmodel.visible = u >= 1 && viewmodelWas; // the arms come back only at the landing pose
    if (u >= 1) return; // holding at the landing pose: the player's own camera, input still off
    // the landing pose is where the player put the camera this frame; the sky pose hangs back and up, looking ahead of it
    land.copy(camera.position); landQ.copy(camera.quaternion);
    fwd.set(0, 0, -1).applyQuaternion(landQ); fwd.y = 0;
    if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1);
    fwd.normalize();
    sky.copy(land).addScaledVector(fwd, -SKY_BACK); sky.y += SKY_UP;
    look.copy(land).addScaledVector(fwd, LOOK_AHEAD);
    m.lookAt(sky, look, camera.up); skyQ.setFromRotationMatrix(m);
    // horizontal glide eases in and out; the height falls fast, then settles; the view levels out over the last 60 %
    const glide = smooth(u), fall = 1 - (1 - u) ** 3, level = smooth(clamp01((u - 0.4) / 0.6));
    camera.position.set(sky.x + (land.x - sky.x) * glide, sky.y + (land.y - sky.y) * fall, sky.z + (land.z - sky.z) * glide);
    camera.quaternion.slerpQuaternions(skyQ, landQ, level);
    camera.updateMatrixWorld();
  });
  return () => live;
}
