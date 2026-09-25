/**
 * Explore World — the viewer (project/archive/2026-09-23-explore-world.md): the title's EXPLORE WORLD panel opens it over the already
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
import { ModelExplorer } from './ModelExplorer';
import { catalogEntries, type CatalogEntry } from './catalog';
import { registeredPicks } from './registry';
import { Select, type SelectTarget } from './Select';
import { MiniMap } from './MiniMap';
import { Compare, hasCompareTargets } from './Compare';
import modelsArt from './img/models.webp';
import worldArt from './img/world.webp';

export type ExploreMode = 'hub' | 'world' | 'model';

export interface ExploreHost {
  world: World;
  /** ✕ / ◀ TITLE: main.ts shows the title again */
  onExit: () => void;
  /** ✎: main.ts opens the review composer (src/ui/Feedback.ts) */
  openFeedback: () => void;
  /** hidden while exploring: the chunk-edge force field (it draws lines across the sea from the air) */
  hide?: THREE.Object3D[];
  /** the shard's live animals (ambient AI): the catalog gets one creature per species, a tap on one opens its species.
   *  The models themselves come from the registry (src/explore/registry.ts) — whatever the shard's setup registered. */
  creatures?: readonly { mesh: THREE.Object3D; kind: string; position: THREE.Vector3; scale: number }[];
  /** left out of the map's top-down shot (MiniMap): the layers that only fill in around the eye — grass, undergrowth,
   *  mist, ground cover, gulls — which from 1.4 km up are dark tiles, not detail */
  overhead?: THREE.Object3D[];
}

/** a mode that lives in its own module (Model Explorer, …): shown / hidden with its tab, ticked while shown */
export interface ExplorePane {
  readonly el: HTMLElement;
  show: (opts: Record<string, string>) => void;
  hide: () => void;
  update: (dt: number) => void;
  context: () => Record<string, ContextValue>;
}

/** the World Explorer's first view: up and behind the shard's spawn, looking the way the spawn faces — over the
 *  canopy on a forest shard (its pines reach 26 m), so the first frame is the land, not a trunk */
function homeView(world: World): { pos: THREE.Vector3; look: THREE.Vector3 } {
  const s = world.chunk.spawn, fx = -Math.sin(s.yaw), fz = -Math.cos(s.yaw);
  const ground = Math.max(heightAt(s.x, s.z), world.chunk.ocean?.level ?? -Infinity);
  const up = world.forest.trees.length > 0 ? 42 : 26;
  return { pos: new THREE.Vector3(s.x - fx * 12 - fz * 12, ground + up, s.z - fz * 12 + fx * 12), look: new THREE.Vector3(s.x + fx * 150, ground + 4, s.z + fz * 150) };
}
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
    const shard = host.world.chunk, own = shard.slug === 'driftwood-isle'; // the hub art is Driftwood's; another shard shows its picker art
    this.hubEl = html('div', 'ws-x-hub', `
      <button class="ws-x-card" type="button" data-m="model"><span class="ws-x-card-art" style="background-image:url('${own ? modelsArt : shard.thumbnail}')"></span><span class="ws-x-card-text"><b>Model explorer</b><small>Inspect every model up close</small></span><span class="ws-x-card-go">›</span></button>
      <button class="ws-x-card" type="button" data-m="world"><span class="ws-x-card-art" style="background-image:url('${own ? worldArt : shard.heroLandscape}')"></span><span class="ws-x-card-text"><b>World explorer</b><small>Fly over ${shard.displayName} in god mode · ${shard.slug}</small></span><span class="ws-x-card-go">›</span></button>`);
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
    if ((host.world.chunk.pois ?? []).length > 0) this.map = new MiniMap(this, host.world, host.overhead ?? []);
    if (hasCompareTargets(host.world.chunk.slug)) this.compare = new Compare(this, host.world);
    const { chunk } = host.world;
    const entries = catalogEntries(host.world.sky, host.creatures ?? [], chunk.style ?? 'pbr', chunk.spawn); // the shard's own creature style (Nalati: painterly)
    if (entries.length > 0) {
      this.addPane('model', new ModelExplorer(this, host.world, entries));
      this.select = new Select(this, host.world, selectTargets(entries, host.creatures ?? []), entries);
      this.onTap = (x, y) => { this.select?.pick(x, y); };
    }
  }

  private select: Select | null = null;
  private map: MiniMap | null = null;
  private compare: Compare | null = null;

  /** ORBIT on a selection: one finger (phone) / Alt-drag (desktop) turns around it; off = free flight again */
  setOrbit(on: boolean, centre?: THREE.Vector3): void {
    if (this.fly) this.fly.orbiting = on;
    if (on && centre) { this.cam.focus(centre, this.host.world.game.camera.position.distanceTo(centre)); this.toast(this.fly ? 'Orbiting · one finger turns around it' : 'Orbiting · Alt-drag turns around it'); }
  }

  /** VIEW IN WORLD: the World Explorer flies to the model, three-quarter view, a little above */
  viewInWorld(e: CatalogEntry): void {
    const o = e.object();
    const box = new THREE.Box3().setFromObject(o);
    const r = Math.max(3, box.getBoundingSphere(new THREE.Sphere()).radius);
    const look = box.getCenter(new THREE.Vector3());
    const from = look.clone().add(new THREE.Vector3(Math.sin(0.7) * r * 2.2, r * 0.9, Math.cos(0.7) * r * 2.2));
    this.setMode('world');
    this.flyTo(from, look);
    this.landing = e;
  }
  private landing: CatalogEntry | null = null;

  /** a smooth camera flight (god mode stays god mode: controls come back on arrival) */
  flyTo(to: THREE.Vector3, look: THREE.Vector3, seconds = 1.1): void {
    const cam = this.host.world.game.camera;
    this.flight = { t: 0, dur: seconds, from: cam.position.clone(), fromQ: cam.quaternion.clone(), to: to.clone(), look: look.clone() };
  }
  private flight: { t: number; dur: number; from: THREE.Vector3; fromQ: THREE.Quaternion; to: THREE.Vector3; look: THREE.Vector3 } | null = null;

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
    this.setMode(mode, opts.model !== undefined ? { model: opts.model } : {});
    const c = opts.cam; // after setMode: entering the world from the hub puts the camera home, a `cam` (a note's "go there") wins
    if (mode === 'world' && c && c.length >= 3 && c.every((v) => Number.isFinite(v))) {
      const [x = 0, y = 0, z = 0, yaw = 0, pitch = 0] = c;
      this.cam.placeAt(new THREE.Vector3(x, y, z)); this.cam.setAngles(yaw, pitch);
    }
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
    if (this.fly) this.fly.enabled = mode === 'world';
    if (mode !== 'world') { this.cam.move.set(0, 0, 0); this.map?.close(); this.compare?.close(); }
    // entering the world from the hub or the Model Explorer (whose camera was orbiting something else) starts at home;
    // VIEW IN WORLD / the map fly from there, a `cam` link (open) overrides it
    if (mode === 'world' && prev !== 'world') { const h = homeView(this.host.world); this.cam.placeAt(h.pos, h.look); }
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
    return { explore: this.mode, cam, ...(pane ? pane.context() : {}), ...(this.mode === 'world' && this.select ? this.select.context() : {}), ...(this.mode === 'world' && this.compare ? this.compare.context() : {}) };
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
    else if (e.code === 'Escape' && !this.held) { if (this.compare?.isOpen === true) this.compare.close(); else if (this.map?.isOpen === true) this.map.close(); else if (this.mode === 'hub') this.close(); else this.setMode('hub'); }
    else if (e.code === 'KeyM' && this.mode === 'world') this.map?.toggle();
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
      camera.position.set(Math.sin(a) * CHUNK_HALF, CHUNK_HALF * 0.47, Math.cos(a) * -CHUNK_HALF); // the whole shard from above its edge
      camera.lookAt(0, 4, 0);
    } else if (this.mode === 'world') {
      const f = this.flight;
      if (f) {
        f.t = Math.min(1, f.t + dt / f.dur);
        const k = f.t * f.t * (3 - 2 * f.t);
        camera.position.lerpVectors(f.from, f.to, k);
        camera.position.y += Math.sin(Math.PI * k) * f.from.distanceTo(f.to) * 0.18; // a little arc over whatever is between
        const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(camera.position, f.look, camera.up));
        camera.quaternion.slerpQuaternions(f.fromQ, q, k);
        if (f.t >= 1) { this.flight = null; this.cam.placeAt(f.to, f.look); if (this.landing) { this.select?.selectEntry(this.landing); this.landing = null; } }
      } else this.cam.update(dt);
      this.select?.update();
      this.map?.update();
    }
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

/** what a tap in the World Explorer can hit: every live registered model, the registered batch picks, each live animal */
function selectTargets(entries: readonly CatalogEntry[], creatures: NonNullable<ExploreHost['creatures']>): SelectTarget[] {
  const out: SelectTarget[] = entries.filter((e) => e.live).map((e) => ({ object: e.object(), entry: e.id }));
  for (const p of registeredPicks()) out.push({ object: p.object, entry: p.entry, ...(p.boxAt ? { boxAt: p.boxAt } : {}) });
  const ids = new Set(entries.map((e) => e.id));
  for (const a of creatures) {
    if (!ids.has(a.kind)) continue;
    out.push({ object: a.mesh, entry: a.kind, boxAt: () => new THREE.Box3(new THREE.Vector3(a.position.x - 0.9 * a.scale, a.position.y - 0.2, a.position.z - 0.9 * a.scale), new THREE.Vector3(a.position.x + 0.9 * a.scale, a.position.y + 1.6 * a.scale, a.position.z + 0.9 * a.scale)) });
  }
  return out;
}
