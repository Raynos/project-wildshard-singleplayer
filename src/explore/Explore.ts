/**
 * Explore World — the viewer (docs/plans/EXPLORE-WORLD.md): the title's EXPLORE WORLD panel opens it over the already
 * loaded shard. A lazy chunk (main.ts `import('./explore/Explore')`), styled by src/ui/styles/explore.css (prefix ws-x-).
 *
 *   const x = new Explore(host);
 *   x.open('hub' | 'world' | 'model', { cam?: [x, y, z, yaw, pitch], model?: id })
 *   x.close()                 // ✕ → host.onExit() (back to the title)
 *   x.context()               // the feedback note's context while exploring (camera pose, mode, model …)
 *   x.toast('Note sent') / x.hold(true)   // the review composer is up: input off, frame frozen by main.ts
 *
 * Modes:
 *   hub    — the p02 hub: a slow orbit of the island behind two cards, MODEL EXPLORER and WORLD EXPLORER
 *   world  — god mode in the real scene: FreeCam (desktop: RMB look, WASD, Q/E, Shift, wheel, F) or TouchFly (phone:
 *            FLY stick, drag to spin, pinch, ▲▼); the player is parked far away (bootstrap `freeCamera`), so the
 *            animals run their ambient AI and nothing notices the camera (D6)
 *   model  — the Model Explorer (src/explore/ModelExplorer.ts)
 * ✎ everywhere: the frame + a note → the review inbox (D5: fire and forget); sending needs the review password (D3),
 * which ✎ asks for once if this device has none.
 */
import * as THREE from 'three';
import '../ui/styles/explore.css';
import { FreeCam } from './FreeCam';
import { TouchFly } from './TouchFly';
import { heightAt } from '../world/Heightfield';
import { CHUNK_HALF } from '../core/config';
import { reviewUnlocked, unlockReview, type ContextValue } from '../ui/review';
import type { World } from '../core/bootstrap';
import modelsArt from './art/models.webp';
import worldArt from './art/world.webp';

export type ExploreMode = 'hub' | 'world' | 'model';

export interface ExploreHost {
  world: World;
  /** ✕ / ◀ TITLE: main.ts shows the title again */
  onExit: () => void;
  /** ✎: main.ts opens the review composer (src/ui/Feedback.ts) */
  openFeedback: () => void;
  /** hidden while exploring: the chunk-edge force field (it draws lines across the sea from the air) */
  hide?: THREE.Object3D[];
}

/** a mode that lives in its own module (Model Explorer, …): shown / hidden with its tab, ticked while shown */
export interface ExplorePane {
  readonly el: HTMLElement;
  show: (opts: Record<string, string>) => void;
  hide: () => void;
  update: (dt: number) => void;
  context: () => Record<string, ContextValue>;
}

const HOME = { pos: new THREE.Vector3(-18, 30, -236), look: new THREE.Vector3(0, 6, -70) }; // off the pier's sea end, the island ahead
const SPEEDS = [['Slow', 4], ['Normal', 12], ['Fast', 40]] as const;
const PARK = new THREE.Vector3(0, -600, -CHUNK_HALF * 12); // where the player waits: out of every animal's senses

const html = (tag: string, cls: string, inner = ''): HTMLElement => { const e = document.createElement(tag); e.className = cls; e.innerHTML = inner; return e; };
/** the same switch the play HUD uses (TouchControls puts `touch` on #hud on coarse-pointer devices, `?touch=1` forces it) */
const touchDevice = (): boolean => document.getElementById('hud')?.classList.contains('touch') === true;

export class Explore {
  active = false;
  mode: ExploreMode = 'hub';
  readonly cam: FreeCam;
  readonly root: HTMLElement;
  private fly: TouchFly | null = null;
  private readonly hubEl: HTMLElement;
  private readonly flyEl: HTMLElement;
  private readonly readout: HTMLElement;
  private readonly toastEl: HTMLElement;
  private readonly tabs: HTMLElement;
  private readonly speedBtn: HTMLElement;
  private readonly panes = new Map<ExploreMode, ExplorePane>();
  private speed = 1;
  private hubT = 0;
  private held = false;
  private readoutT = 0;
  private readonly parkedFrom = new THREE.Vector3();
  private toastTimer = 0;

  constructor(private readonly host: ExploreHost) {
    const { game } = host.world;
    this.cam = new FreeCam(game.camera, game.canvas, { moveSpeed: SPEEDS[1][1], damping: 0.82, pointerLock: true });
    this.cam.enabled = false;
    this.cam.floor = (x, z) => heightAt(x, z);

    this.root = html('div', 'ws-x');
    const top = html('div', 'ws-x-top', `
      <div class="ws-x-brand"><span>Project <b>Wildshard</b></span><i>Explore</i></div>
      <div class="ws-x-tabs"><button type="button" data-m="model">Models</button><button type="button" data-m="world">World</button></div>
      <button class="ws-x-close" type="button" aria-label="Back to the title">✕</button>`);
    this.tabs = top.querySelector<HTMLElement>('.ws-x-tabs') ?? top;
    this.readout = html('div', 'ws-x-readout');
    this.hubEl = html('div', 'ws-x-hub', `
      <button class="ws-x-card" type="button" data-m="model"><span class="ws-x-card-art" style="background-image:url('${modelsArt}')"></span><span class="ws-x-card-text"><b>Model explorer</b><small>Inspect every model up close</small></span><span class="ws-x-card-go">›</span></button>
      <button class="ws-x-card" type="button" data-m="world"><span class="ws-x-card-art" style="background-image:url('${worldArt}')"></span><span class="ws-x-card-text"><b>World explorer</b><small>Fly over the island in god mode · driftwood-isle</small></span><span class="ws-x-card-go">›</span></button>`);
    this.flyEl = html('div', 'ws-x-fly', `
      <div class="ws-x-rail">
        <button class="ws-x-btn ws-x-up" type="button" aria-label="Up">▲</button>
        <button class="ws-x-btn ws-x-down" type="button" aria-label="Down">▼</button>
        <button class="ws-x-chip ws-x-speed" type="button">Speed · Normal</button>
      </div>
      <div class="ws-x-hint">RMB drag look · WASD fly · Q / E down · up · Shift fast · wheel speed · F frame</div>`);
    this.speedBtn = this.flyEl.querySelector<HTMLElement>('.ws-x-speed') ?? this.flyEl;
    const note = html('button', 'ws-x-note', '<svg viewBox="0 0 24 24"><path d="M4 20l1-4L16 5l3 3L8 19z M14 7l3 3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>');
    note.setAttribute('aria-label', 'Feedback note');
    this.toastEl = html('div', 'ws-x-toast');
    this.root.append(top, this.readout, this.hubEl, this.flyEl, note, this.toastEl);
    document.body.append(this.root);

    top.querySelector('.ws-x-close')?.addEventListener('click', () => { this.close(); });
    this.tabs.querySelectorAll<HTMLElement>('button').forEach((b) => { b.addEventListener('click', () => { this.setMode(b.dataset['m'] === 'model' ? 'model' : 'world'); }); });
    this.hubEl.querySelectorAll<HTMLElement>('.ws-x-card').forEach((b) => { b.addEventListener('click', () => { this.setMode(b.dataset['m'] === 'model' ? 'model' : 'world'); }); });
    this.speedBtn.addEventListener('click', () => { this.setSpeed((this.speed + 1) % SPEEDS.length); });
    note.addEventListener('click', () => { void this.note(); });
    const hold = (sel: string, v: number): void => {
      const b = this.flyEl.querySelector<HTMLElement>(sel);
      if (!b) return;
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); this.cam.move.y = v; b.classList.add('on'); });
      const up = (): void => { if (this.cam.move.y === v) this.cam.move.y = 0; b.classList.remove('on'); };
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
    };
    hold('.ws-x-up', 1); hold('.ws-x-down', -1);
    document.addEventListener('keydown', this.onKey);
    game.onUpdate((dt) => { this.update(dt); });
  }

  /** a mode implemented elsewhere (the Model Explorer); its element joins the overlay */
  addPane(mode: ExploreMode, pane: ExplorePane): void {
    this.panes.set(mode, pane);
    pane.el.classList.add('ws-x-pane');
    this.root.insertBefore(pane.el, this.toastEl);
  }

  open(mode: ExploreMode = 'hub', opts: { cam?: number[]; model?: string } = {}): void {
    const { world } = this.host;
    if (!this.active) {
      this.active = true;
      this.parkedFrom.copy(world.player.position);
      world.freeCamera = true;
      world.player.position.copy(PARK);
      world.player.keys.clear();
      this.root.classList.add('show');
      for (const o of this.host.hide ?? []) o.visible = false;
      this.setChrome(false);
      if (touchDevice() && !this.fly) {
        this.fly = new TouchFly(world.game.canvas, this.cam, this.flyEl);
        this.fly.onTap = (x, y) => { this.onTap?.(x, y); };
      }
      this.root.classList.toggle('touch', touchDevice());
    }
    const c = opts.cam;
    if (c && c.length >= 3 && c.every((v) => Number.isFinite(v))) {
      const [x = 0, y = 0, z = 0, yaw = 0, pitch = 0] = c;
      this.cam.placeAt(new THREE.Vector3(x, y, z)); this.cam.setAngles(yaw, pitch);
    } else if (mode === 'world') this.cam.placeAt(HOME.pos, HOME.look);
    this.setMode(mode, opts.model !== undefined ? { model: opts.model } : {});
  }

  /** leave to the title; the player is put back where they were */
  close(): void {
    if (!this.active) return;
    const { world } = this.host;
    this.hidePanes();
    this.active = false;
    this.cam.enabled = false; this.cam.move.set(0, 0, 0);
    world.player.position.copy(this.parkedFrom);
    world.freeCamera = false;
    this.root.classList.remove('show');
    for (const o of this.host.hide ?? []) o.visible = true;
    this.setChrome(true);
    if (document.pointerLockElement) document.exitPointerLock();
    this.host.onExit();
  }

  /** set by the select layer (X4): a click / tap on the world at client (x, y) */
  onTap?: (x: number, y: number) => void;

  setMode(mode: ExploreMode, opts: Record<string, string> = {}): void {
    if (mode === 'model' && !this.panes.has('model')) { this.toast('Model Explorer lands next'); return; }
    const prev = this.mode;
    this.mode = mode;
    this.root.dataset['mode'] = mode;
    this.tabs.querySelectorAll<HTMLElement>('button').forEach((b) => { b.classList.toggle('on', b.dataset['m'] === mode); });
    this.cam.enabled = mode === 'world' && !this.held;
    if (mode !== 'world') this.cam.move.set(0, 0, 0);
    if (mode === 'world' && prev === 'hub') this.cam.placeAt(HOME.pos, HOME.look);
    for (const [m, p] of this.panes) { if (m === mode) p.show(opts); else p.hide(); }
  }

  /** the build chip (src/ui/Update.ts) sits where the Explore bar is; the frame meter's numbers move into the readout */
  private setChrome(on: boolean): void {
    const chip = document.querySelector<HTMLElement>('.ws-update');
    if (chip) chip.style.visibility = on ? '' : 'hidden';
  }

  private hidePanes(): void { for (const p of this.panes.values()) p.hide(); }

  private setSpeed(i: number): void {
    this.speed = i;
    const s = SPEEDS[i] ?? SPEEDS[1];
    this.cam.moveSpeed = s[1];
    this.speedBtn.textContent = `Speed · ${s[0]}`;
  }

  /** the review composer is up (main.ts Feedback host.hold) */
  hold(on: boolean): void { this.held = on; this.cam.enabled = !on && this.mode === 'world'; if (on) this.cam.move.set(0, 0, 0); }

  toast(text: string): void {
    this.toastEl.textContent = text;
    this.toastEl.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => { this.toastEl.classList.remove('show'); }, 2600);
  }

  /** the note's context: what you were looking at, and the URL that reopens it (`?explore=` — main.ts) */
  context(): Record<string, ContextValue> {
    const c = this.host.world.game.camera.position;
    const pane = this.panes.get(this.mode);
    const cam = [c.x, c.y, c.z, this.cam.yaw, this.cam.pitch].map((v) => Number(v.toFixed(2)));
    return { explore: this.mode, cam, ...(pane ? pane.context() : {}) };
  }

  private async note(): Promise<void> {
    if (!reviewUnlocked()) { this.askPassword(); return; }
    await Promise.resolve();
    this.host.openFeedback();
  }

  /** ✎ without a review password on this device: ask for it once (the inbox's own gate, D3) */
  private askPassword(): void {
    if (this.root.querySelector('.ws-x-unlock')) return;
    const box = html('form', 'ws-x-unlock', `<b>Feedback needs the review password</b><input type="password" autocomplete="current-password" placeholder="Review password"><div><button type="submit">Unlock</button><button type="button" class="ws-x-unlock-cancel">Cancel</button></div><small></small>`);
    const input = box.querySelector('input'), msg = box.querySelector('small');
    const done = (): void => { box.remove(); this.hold(false); };
    box.querySelector('.ws-x-unlock-cancel')?.addEventListener('click', done);
    const submit = async (): Promise<void> => {
      const r = await unlockReview(input?.value ?? '');
      if (r === 'ok') { done(); this.host.openFeedback(); return; }
      if (msg) msg.textContent = r === 'bad' ? 'Wrong password' : 'Offline — try again';
    };
    box.addEventListener('submit', (e) => { e.preventDefault(); void submit(); });
    this.root.append(box);
    this.hold(true);
    input?.focus();
  }

  private readonly onKey = (e: KeyboardEvent): void => {
    if (!this.active || e.repeat) return;
    const t = e.target;
    if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) return;
    if (e.code === 'F8') { e.preventDefault(); void this.note(); }
    else if (e.code === 'Escape' && !this.held) { if (this.mode === 'hub') this.close(); else this.setMode('hub'); }
    else if (e.code === 'Digit1') this.setMode('model');
    else if (e.code === 'Digit2') this.setMode('world');
  };

  private update(dt: number): void {
    if (!this.active) return;
    const { camera } = this.host.world.game;
    if (this.mode === 'hub') {
      // a slow cinematic orbit of the island behind the hub cards
      this.hubT += dt * 0.035;
      const a = this.hubT - 1.1;
      camera.position.set(Math.sin(a) * 250, 118, 12 + Math.cos(a) * -250);
      camera.lookAt(0, 4, 12);
    } else if (this.mode === 'world') this.cam.update(dt);
    this.panes.get(this.mode)?.update(dt);
    this.readoutT -= dt;
    if (this.readoutT <= 0 && this.mode === 'world') {
      this.readoutT = 0.2;
      const p = camera.position, hdg = Math.round((((180 - (this.cam.yaw * 180) / Math.PI) % 360) + 360) % 360);
      const alt = p.y - Math.max(heightAt(p.x, p.z), 0);
      const { stats, lastFrame } = this.host.world.game;
      this.readout.textContent = `ALT ${alt.toFixed(alt < 10 ? 1 : 0)} m · x ${Math.round(p.x)} z ${Math.round(p.z)} · HDG ${String(hdg).padStart(3, '0')}°\n${stats.fps} fps · ${lastFrame.calls} calls · ${(lastFrame.triangles / 1e6).toFixed(2)} M tris`;
    }
  }
}
