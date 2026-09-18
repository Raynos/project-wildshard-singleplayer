import { CHUNK_SIZE } from '../core/config';
import { CHUNKS, getActiveChunk, chunkUrl } from '../chunks/registry';
import { PLACEHOLDERS } from '../chunks/placeholders';
import { CABIN_SITES } from '../world/Heightfield';
import { getSetting, setSetting, onSetting, type SettingKey } from '../ui/Settings';

/**
 * HUD — DOM overlay in `#hud`, styled by `src/ui/styles/game.css` / `menu.css` / `pause.css` on top of `base.css` (Wildshard glass identity; one class prefix per screen, see scripts/check-css.mjs).
 *
 *   const hud = new HUD({ pointerLock?: boolean });   // pointerLock:false in ?nolock dev mode (no pause overlay)
 *   hud.showIntro(() => player.lock())                 // title screen: shard deck; ENTER WORLD / any key → onEnter
 *   hud.setState({ bolts?, loaded, reloading, reloadProgress?, health, fps, pos: {x, z}, yaw, kills, prompt?, speed?, ads? })
 *     — `bolts: undefined` = the weapon has no ammo (the sword): the BOLTS panel, its meter and the touch-bar strip are hidden
 *   hud.showHitMarker(headshot, killed)  hud.killFeed('Boar · headshot')  hud.toast('Bolt recovered')
 *   hud.damageFlash()  hud.setBoundaryWarning(visible)  hud.setPaused(bool)  hud.onResume = () => …
 *   hud.onExitToMenu = () => …   // pause → "Exit to main menu": the HUD re-shows the intro itself (no reload); stop/mute the world here
 *   hud.setAimInfo(crossbow.aimInfo)   // "BOAR · 15 M" under the crosshair
 *   hud.setAnimals([{ x, z }, …])      // world positions of live animals: the compass pins a paw at the nearest one within 120 m
 *
 * Compass: a smoked-glass band (both desktop and touch) with a cyan house marker at the bearing of the nearest cabin
 * (`CABIN_SITES` — static, so the HUD reads them itself) and a "CABIN · 180 m" readout under it; the paw marker comes
 * from `state.nearest` (bearing in compass degrees, 0 = north) when the caller has one, else from `setAnimals`.
 *
 * Call `setState` every frame (it diffs and only touches the DOM on change). Pause overlay appears on
 * pointer-unlock after the chunk was entered (`pointerLock` mode only); clicking it fires `onResume`.
 */

export interface HUDState {
  /** bolts carried; undefined = no ammo on this weapon (melee) → the ammo readouts are hidden */
  bolts?: number; loaded: boolean; reloading: boolean; reloadProgress?: number;
  health: number; fps: number; pos: { x: number; z: number }; yaw: number; kills: number;
  prompt?: string; speed?: number; ads?: boolean; maxBolts?: number;
  /** nearest animal for the compass paw: `bearing` in compass degrees (0 = north = +Z, 90 = east = −X) — see `bearingTo` */
  nearest?: { bearing: number; distance: number; kind: string };
}
export interface HUDOptions { pointerLock?: boolean; maxBolts?: number }
export type IntroStats = Record<string, string | { value: string; tone?: 'ok' | 'warn' }>;

/** One card in the title-screen deck: an authored chunk (playable) or a teaser (coming soon). */
interface DeckCard {
  slug: string; displayName: string; label: string; thumbnail: string; tag: string; tagTone: 'ok' | 'soon' | '';
  playable: boolean; active: boolean; heroPortrait?: string; heroLandscape?: string; blurb: string;
}
const HERO_FADE_MS = 350;

const CARDINALS: [number, string, boolean][] = [[0, 'N', true], [45, 'NE', false], [90, 'E', true], [135, 'SE', false], [180, 'S', true], [225, 'SW', false], [270, 'W', true], [315, 'NW', false]];
const BAND_DEGREES = 292; // the band spans this much heading (W · N · E all visible, like the K1 mockup); px/deg follows its width
const PAW_RANGE = 120;   // m — the compass only pins an animal this close
const MARKER_INSET = 22; // px — a marker behind the player parks at the band's edge instead of leaving it

/** compass bearing (deg, 0 = north) of the point (tx, tz) seen from (x, z). North is +Z (the south-gate spawn's forward,
 *  yaw π, is `player.forward = (−sin yaw, −cos yaw)` = +Z) and the heading is `180 − yaw°`, which puts east at −X. */
export function bearingTo(x: number, z: number, tx: number, tz: number) {
  const deg = (Math.atan2(-(tx - x), tz - z) * 180) / Math.PI;
  return ((deg % 360) + 360) % 360;
}
const SVG_HEART = '<svg viewBox="0 0 24 24"><path d="M12 21s-7.6-4.7-9.6-9.3C1 8 3.2 4.5 6.7 4.5c2 0 3.6 1.1 5.3 3 1.7-1.9 3.3-3 5.3-3 3.5 0 5.7 3.5 4.3 7.2C19.6 16.3 12 21 12 21z"/></svg>';
const SVG_BOLT = '<svg viewBox="0 0 24 24"><path d="M21 3l-1.2 7.6-2.2-2.2-9.4 9.4 1.6 1.6-1.6 1.6-1.5-1.5-2.2 2.2-1.4-1.4 2.2-2.2-1.5-1.5 1.6-1.6 1.6 1.6 9.4-9.4-2.2-2.2z"/></svg>';
const SVG_HOUSE = '<svg viewBox="0 0 24 24"><path d="M12 3 2 12h3v8h5v-6h4v6h5v-8h3z"/></svg>';
const SVG_PAW = '<svg viewBox="0 0 24 24"><circle cx="4.6" cy="9.6" r="2.4"/><circle cx="9.2" cy="5.2" r="2.7"/><circle cx="14.8" cy="5.2" r="2.7"/><circle cx="19.4" cy="9.6" r="2.4"/><path d="M12 10c-3.6 0-7 3.3-7 6.6 0 2 1.4 3.4 3.3 3.4 1.4 0 2.3-.9 3.7-.9s2.3.9 3.7.9c1.9 0 3.3-1.4 3.3-3.4 0-3.3-3.4-6.6-7-6.6z"/></svg>';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, html?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

export class HUD {
  root: HTMLElement;
  onResume?: () => void;
  onExitToMenu?: () => void;
  private soundOff = false; // the menu's sound toggle; applied via onSoundToggle on enter, muted on exit-to-menu
  onSoundToggle?: (on: boolean) => void;
  private opts: HUDOptions;
  entered = false;
  private onEnter?: () => void;

  private compassStrip!: HTMLElement;
  private markHouse!: HTMLElement; private markPaw!: HTMLElement; private range!: HTMLElement;
  private animals: { x: number; z: number }[] = [];
  /** P2 touch layout: vitals + bolts strips rendered INTO the control bar's corners (`.ws-touch-bar`, TouchControls) */
  private bar?: { hval: HTMLElement; hbar: HTMLElement; bolts: HTMLElement; bcount: HTMLElement; segs: HTMLElement[] };
  private lastMark = { house: NaN, paw: NaN, range: '' };
  private ppd = 1.2; // compass px per degree — measured from the band (`--ppd`), see build()
  private feed!: HTMLElement; private toasts!: HTMLElement;
  private fps!: HTMLElement; private coords!: HTMLElement;
  private healthVal!: HTMLElement; private healthBar!: HTMLElement;
  private ammoCount!: HTMLElement; private ammoStatus!: HTMLElement; private ammoStatusText!: HTMLElement; private reloadBar!: HTMLElement; private pips: HTMLElement[] = [];
  private cross!: HTMLElement; private killX!: HTMLElement; private hitRing!: HTMLElement; private aim!: HTMLElement; private aimText = '';
  private prompt!: HTMLElement; private boundary!: HTMLElement; private flash!: HTMLElement;
  private intro?: HTMLElement; private pause!: HTMLElement;
  private deck?: { cards: DeckCard[]; index: number; select: (i: number, smooth?: boolean) => void; activate: () => void };
  private last: Partial<HUDState> & { statusKey?: string; headingDeg?: number; fpsShown?: number; noAmmo?: boolean } = {};
  private ammoPanel!: HTMLElement;
  private hitTimer = 0; private spread = 7;

  constructor(opts: HUDOptions = {}) {
    this.opts = { pointerLock: true, maxBolts: 30, ...opts };
    this.root = document.getElementById('hud') ?? document.body.appendChild(el('div'));
    this.root.id = 'hud';
    this.build();
    // the touch layer may be built before or after the HUD (main.ts order): mount the bar strips as soon as it exists
    if (!this.mountBar()) { const mo = new MutationObserver(() => { if (this.mountBar()) mo.disconnect(); }); mo.observe(this.root, { childList: true }); }
    document.addEventListener('pointerlockchange', () => {
      if (!this.opts.pointerLock || !this.entered) return;
      const locked = !!document.pointerLockElement;
      this.setPaused(!locked);
    });
    document.addEventListener('keydown', (e) => {
      if (!this.intro || this.entered || e.metaKey || e.ctrlKey || e.code === 'Escape') return;
      const deck = this.deck;
      if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') { e.preventDefault(); deck?.select(deck.index + (e.code === 'ArrowLeft' ? -1 : 1)); return; }
      if (deck && !deck.cards[deck.index]?.playable) return;  // "press any key" is inert on a coming-soon shard
      if (deck) deck.activate(); else this.enter();
    });
  }

  private build() {
    const r = this.root;
    // chunk panel
    const def = getActiveChunk();
    const chunk = el('div', 'ws-glass ws-game-chunk');
    chunk.innerHTML = `<div class="ws-game-title">Project <b>Wildshard</b></div><div class="ws-game-sub">Chunk playtest</div>
      <div class="ws-game-row"><span>chunk</span><span class="ws-game-id">${def.id}</span></div>
      <div class="ws-game-row"><span>grid</span><span>${def.gridCoords}</span></div>
      <div class="ws-game-row"><span>pos</span><span data-el="coords">+000 · +000</span></div>
      <div class="ws-game-tag"><i></i>Local build · unuploaded</div>`;
    this.coords = chunk.querySelector('[data-el="coords"]')!;
    r.appendChild(chunk);

    // compass: a slim band; the strip sits at the band's centre and slides by the heading (see setState)
    const compass = el('div', 'ws-game-compass');
    compass.innerHTML = '<i class="ws-game-brk tl"></i><i class="ws-game-brk tr"></i><i class="ws-game-brk bl"></i><i class="ws-game-brk br"></i>';
    const band = el('div', 'ws-game-band');
    this.compassStrip = el('div', 'ws-game-strip');
    for (let deg = -360; deg < 720; deg += 15) {
      const major = deg % 45 === 0;
      const tick = el('i', 'ws-game-tick' + (major ? ' major' : ''));
      tick.style.left = `calc(${deg + 360} * var(--ppd))`;
      this.compassStrip.appendChild(tick);
    }
    for (let lap = -1; lap <= 1; lap++) for (const [deg, label, major] of CARDINALS) {
      const c = el('div', 'ws-game-cardinal' + (major ? '' : ' minor') + (label === 'N' ? ' n' : ''), label);
      c.style.left = `calc(${deg + lap * 360 + 360} * var(--ppd))`;
      this.compassStrip.appendChild(c);
    }
    band.appendChild(this.compassStrip);
    this.markHouse = el('div', 'ws-game-mark house', SVG_HOUSE); band.appendChild(this.markHouse);
    this.markPaw = el('div', 'ws-game-mark paw', SVG_PAW); band.appendChild(this.markPaw);
    band.appendChild(el('div', 'ws-game-centre'));
    compass.appendChild(band);
    compass.appendChild(el('div', 'ws-game-notch'));
    // px/deg scales with the band (90 vw on a phone, fixed on desktop): ticks and cardinals are laid out in `--ppd` units
    const fit = () => { const w = band.clientWidth; if (!w) return; this.ppd = w / BAND_DEGREES; band.style.setProperty('--ppd', `${this.ppd}px`); this.last.headingDeg = undefined; this.lastMark.house = this.lastMark.paw = NaN; };
    new ResizeObserver(fit).observe(band);
    fit();
    this.range = el('div', 'ws-game-range'); compass.appendChild(this.range);
    r.appendChild(compass);

    this.feed = el('div', 'ws-game-feed'); r.appendChild(this.feed);
    this.fps = el('div', 'ws-game-fps', '<b>60</b> FPS<br>R186 · WEBGL2'); r.appendChild(this.fps);

    // health
    const health = el('div', 'ws-glass ws-game-health');
    health.innerHTML = `<div class="ws-game-hrow"><span class="ws-label">Vitals</span><span class="ws-game-hval"><span class="v">100</span><small>/ 100</small></span></div><div class="ws-bar"><i style="width:100%"></i><u style="left:25%"></u><u style="left:50%"></u><u style="left:75%"></u></div>`;
    this.healthVal = health.querySelector('.v')!; this.healthBar = health.querySelector('.ws-bar i')!;
    r.appendChild(health);

    // ammo
    const ammo = el('div', 'ws-glass ws-game-ammo');
    ammo.innerHTML = `<div class="ws-game-arow"><span class="ws-label">Bolts</span><span class="ws-game-count"><span class="c">30</span> <small>/ ${this.opts.maxBolts}</small></span></div>
      <div class="ws-game-pips"></div><div class="ws-game-rbar"><i></i></div><div class="ws-game-status"><span class="s">Loaded</span><i></i></div>`;
    this.ammoPanel = ammo;
    this.ammoCount = ammo.querySelector('.ws-game-count')!; this.ammoStatus = ammo.querySelector('.ws-game-status')!; this.ammoStatusText = ammo.querySelector('.ws-game-status .s')!; this.reloadBar = ammo.querySelector('.ws-game-rbar i')!;
    const pips = ammo.querySelector('.ws-game-pips')!;
    for (let i = 0; i < (this.opts.maxBolts ?? 30); i++) { const p = el('i'); pips.appendChild(p); this.pips.push(p); }
    r.appendChild(ammo);

    // crosshair
    this.cross = el('div', 'ws-game-cross', '<i class="t"></i><i class="b"></i><i class="l"></i><i class="r"></i><u></u><div class="ws-game-x"></div>');
    this.killX = this.cross.querySelector('.ws-game-x')!;
    r.appendChild(this.cross);
    this.hitRing = el('div', 'ws-game-hitring'); r.appendChild(this.hitRing);
    this.aim = el('div', 'ws-game-aim'); r.appendChild(this.aim);

    this.prompt = el('div', 'ws-glass ws-game-prompt'); r.appendChild(this.prompt);
    this.boundary = el('div', 'ws-game-boundary', '<div class="ws-game-bt">Chunk boundary</div><div class="ws-game-bs">No-man\'s land beyond · nothing has been generated here</div>'); r.appendChild(this.boundary);
    this.toasts = el('div', 'ws-game-toasts'); r.appendChild(this.toasts);
    this.flash = el('div', 'ws-game-flash'); r.appendChild(this.flash);

    this.pause = el('div', 'ws-pause', `<div class="ws-glass ws-pause-box">
      <div class="ws-pause-title">Paused</div><div class="ws-pause-sub">${this.opts.pointerLock ? 'Esc released the cursor' : 'Chunk playtest'}</div>
      <button class="ws-pause-btn resume" type="button">Resume</button>
      <button class="ws-pause-btn exit" type="button">Exit to main menu</button>
      <div class="ws-pause-settings">
        <div class="ws-pause-settings-title">Settings</div>
        <button class="ws-pause-switch" type="button" data-setting="aimAssist" role="switch"><span class="ws-pause-switch-label">Aim assist</span><i class="ws-pause-pill"></i></button>
        <button class="ws-pause-switch" type="button" data-setting="tracers" role="switch"><span class="ws-pause-switch-label">Tracer bolts</span><i class="ws-pause-pill"></i></button>
      </div>
    </div>`);
    // settings switches: tap flips the persisted setting (src/ui/Settings.ts); the pill mirrors it, also when changed elsewhere
    for (const sw of this.pause.querySelectorAll<HTMLElement>('.ws-pause-switch')) {
      const key = sw.dataset.setting as SettingKey;
      const sync = (v: boolean) => { sw.classList.toggle('on', v); sw.setAttribute('aria-checked', String(v)); };
      sync(getSetting(key)); onSetting(key, sync);
      sw.addEventListener('click', (e) => { e.stopPropagation(); setSetting(key, !getSetting(key)); });
    }
    const resume = () => { this.setPaused(false); this.onResume?.(); };
    this.pause.addEventListener('click', (e) => { if (e.target === this.pause) resume(); }); // backdrop click = resume (desktop habit)
    this.pause.querySelector('.resume')!.addEventListener('click', resume);
    this.pause.querySelector('.exit')!.addEventListener('click', () => this.exitToMenu());
    // touch pause button (TouchControls) and Escape on devices without pointer lock
    document.addEventListener('ws:pause', () => { if (this.entered) this.setPaused(!this.paused); });
    document.addEventListener('keydown', (e) => { if (e.code === 'Escape' && !this.opts.pointerLock && this.entered) this.setPaused(!this.paused); });
    r.appendChild(this.pause);
  }

  // ── per-frame state ──
  setState(s: HUDState) {
    const L = this.last;
    if (s.fps !== L.fpsShown) { L.fpsShown = s.fps; this.fps.firstElementChild!.textContent = String(s.fps); }
    const hx = Math.round(s.pos.x), hz = Math.round(s.pos.z);
    if (hx !== L.pos?.x || hz !== L.pos?.z) { L.pos = { x: hx, z: hz }; this.coords.textContent = `${fmt(hx)} · ${fmt(hz)}`; }
    // compass: +Z (the south-gate spawn's forward, yaw π) is north; turning left decreases the heading
    let deg = 180 - (s.yaw * 180) / Math.PI; deg = ((deg % 360) + 360) % 360;
    const degR = Math.round(deg * 2) / 2;
    if (degR !== L.headingDeg) {
      L.headingDeg = degR;
      this.compassStrip.style.transform = `translateX(${-(deg + 360) * this.ppd}px)`;
    }
    this.updateMarkers(s, deg);
    if (s.health !== L.health) {
      L.health = s.health;
      const h = Math.max(0, Math.min(100, s.health));
      this.healthVal.textContent = String(Math.round(h));
      this.healthBar.style.width = `${h}%`;
      this.healthBar.classList.toggle('low', h <= 30);
      this.syncBar('health');
    }
    const noAmmo = s.bolts === undefined;
    if (noAmmo !== L.noAmmo) { L.noAmmo = noAmmo; this.ammoPanel.style.display = noAmmo ? 'none' : ''; if (this.bar) this.bar.bolts.style.display = noAmmo ? 'none' : ''; }
    const bolts = s.bolts ?? 0;
    if (!noAmmo && bolts !== L.bolts) {
      L.bolts = bolts;
      this.ammoCount.firstElementChild!.textContent = String(bolts);
      this.ammoCount.classList.toggle('empty', bolts <= 0);
      this.pips.forEach((p, i) => p.classList.toggle('off', i >= bolts));
      this.syncBar('bolts');
    }
    const statusKey = noAmmo ? 'loaded' : bolts <= 0 && !s.loaded ? 'empty' : s.reloading ? 'reloading' : s.loaded ? 'loaded' : 'spent';
    if (statusKey !== L.statusKey) {
      L.statusKey = statusKey;
      this.ammoStatus.className = 'ws-game-status ' + (statusKey === 'empty' ? 'empty' : statusKey === 'reloading' ? 'reloading' : '');
      this.ammoStatusText.textContent = statusKey === 'empty' ? 'No bolts' : statusKey === 'reloading' ? 'Spanning' : statusKey === 'loaded' ? 'Loaded' : 'Spent · R to span';
      this.syncBar('status');
    }
    const rp = s.reloading ? (s.reloadProgress ?? 0) : 0;
    if (rp !== L.reloadProgress) { L.reloadProgress = rp; this.reloadBar.style.width = `${rp * 100}%`; }
    // crosshair spread
    const target = (s.ads ? 4 : 7) + (s.speed ?? 0) * 7 + (s.reloading ? 6 : 0);
    if (Math.abs(target - this.spread) > 0.05) { this.spread += (target - this.spread) * 0.2; this.cross.style.setProperty('--gap', `${this.spread.toFixed(1)}px`); }
    if (s.ads !== L.ads) { L.ads = s.ads; this.cross.classList.toggle('ads', !!s.ads); }
    if (s.prompt !== L.prompt) {
      L.prompt = s.prompt;
      if (s.prompt) { this.prompt.innerHTML = s.prompt.replace(/^\[(\w+)\]\s*/, '<b>$1</b>'); this.prompt.classList.add('show'); }
      else this.prompt.classList.remove('show');
    }
    if (this.hitTimer > 0 && (this.hitTimer -= 1) === 0) this.cross.classList.remove('hit', 'head');
  }

  /** touch (P2): heart · 100 · bar · VITALS in the bar's top-left corner, BOLTS · segments · 27 / 30 · bolt top-right.
   *  Rendered into TouchControls' `.ws-touch-bar` once it exists; the numbers are HUD state, so the HUD owns them. */
  private mountBar() {
    if (this.bar) return true;
    const bar = this.root.querySelector<HTMLElement>('.ws-touch-bar');
    if (!bar) return false;
    const vitals = el('div', 'ws-game-vitals', `<i class="ws-game-glyph">${SVG_HEART}</i><b class="ws-game-num">100</b><span class="ws-game-vbar"><i></i></span><span class="ws-game-tiny">Vitals</span>`);
    const bolts = el('div', 'ws-game-bolts', `<span class="ws-game-tiny">Bolts</span><span class="ws-game-segs">${'<i></i>'.repeat(4)}</span><b class="ws-game-num"><span class="c">30</span><small> / ${this.opts.maxBolts}</small></b><i class="ws-game-glyph">${SVG_BOLT}</i>`);
    bar.append(vitals, bolts);
    if (this.last.noAmmo) bolts.style.display = 'none';
    this.bar = { hval: vitals.querySelector('.ws-game-num')!, hbar: vitals.querySelector('.ws-game-vbar i')!, bolts, bcount: bolts.querySelector('.c')!, segs: Array.from(bolts.querySelectorAll<HTMLElement>('.ws-game-segs i')) };
    this.syncBar('health'); this.syncBar('bolts'); this.syncBar('status');
    return true;
  }

  private syncBar(what: 'health' | 'bolts' | 'status') {
    const b = this.bar, L = this.last;
    if (!b) return;
    if (what === 'health') {
      const h = Math.max(0, Math.min(100, L.health ?? 100));
      b.hval.textContent = String(Math.round(h));
      b.hbar.style.width = `${h}%`;
      b.hbar.classList.toggle('low', h <= 30);
    } else if (what === 'bolts') {
      const n = L.bolts ?? this.opts.maxBolts ?? 30, max = this.opts.maxBolts ?? 30;
      b.bcount.textContent = String(n);
      const lit = n <= 0 ? 0 : Math.max(1, Math.floor((n / max) * b.segs.length + 1e-6));
      b.segs.forEach((seg, i) => seg.classList.toggle('off', i >= lit));
    } else {
      b.bolts.classList.toggle('empty', L.statusKey === 'empty');
      b.bolts.classList.toggle('reloading', L.statusKey === 'reloading');
    }
  }

  /** world positions of the live animals — the compass pins a paw at the nearest one within `PAW_RANGE` (empty = no paw) */
  setAnimals(list: { x: number; z: number }[]) { this.animals = list; }

  /** compass markers: the nearest cabin (house + "CABIN · 180 m") and the nearest animal (paw), each at its bearing on the band */
  private updateMarkers(s: HUDState, heading: number) {
    const { x, z } = s.pos;
    let cabin: { d: number; b: number } | null = null;
    for (const c of CABIN_SITES) {
      const d = Math.hypot(c.x - x, c.z - z);
      if (!cabin || d < cabin.d) cabin = { d, b: bearingTo(x, z, c.x, c.z) };
    }
    let paw: { d: number; b: number } | null = null;
    if (s.nearest) { if (s.nearest.distance <= PAW_RANGE) paw = { d: s.nearest.distance, b: s.nearest.bearing }; }
    else for (const a of this.animals) {
      const d = Math.hypot(a.x - x, a.z - z);
      if (d <= PAW_RANGE && (!paw || d < paw.d)) paw = { d, b: bearingTo(x, z, a.x, a.z) };
    }
    this.placeMark(this.markHouse, 'house', cabin ? cabin.b - heading : NaN);
    this.placeMark(this.markPaw, 'paw', paw ? paw.b - heading : NaN);
    const range = cabin ? `Cabin · ${Math.round(cabin.d)} m` : '';
    if (range !== this.lastMark.range) { this.lastMark.range = range; this.range.textContent = range; this.range.classList.toggle('show', !!range); }
  }

  private placeMark(m: HTMLElement, key: 'house' | 'paw', rel: number) {
    let px = NaN;
    if (!Number.isNaN(rel)) {
      rel = ((rel + 540) % 360) - 180; // −180..180 around the heading
      const half = m.parentElement!.clientWidth / 2 - MARKER_INSET;
      px = Math.round(Math.max(-half, Math.min(half, rel * this.ppd)) * 2) / 2;
    }
    if (px === this.lastMark[key] || (Number.isNaN(px) && Number.isNaN(this.lastMark[key]))) return;
    this.lastMark[key] = px;
    if (Number.isNaN(px)) m.classList.remove('show');
    else { m.style.transform = `translateX(${px}px)`; m.classList.add('show'); }
  }

  /** range readout under the crosshair: "BOAR · 15 M" (null hides it) */
  setAimInfo(info: { kind: string; distance: number } | null) {
    const text = info ? `${info.kind} · ${Math.round(info.distance)} m` : '';
    if (text === this.aimText) return;
    this.aimText = text;
    if (text) { this.aim.textContent = text; this.aim.classList.add('show'); } else this.aim.classList.remove('show');
  }

  showHitMarker(headshot: boolean, killed: boolean) {
    this.cross.classList.add('hit'); this.cross.classList.toggle('head', headshot);
    this.hitTimer = 10;
    this.hitRing.classList.remove('show'); void this.hitRing.offsetWidth; this.hitRing.classList.add('show');
    if (killed) { this.killX.classList.remove('show'); void this.killX.offsetWidth; this.killX.classList.add('show'); }
  }

  killFeed(text: string) {
    const item = el('div', 'ws-game-feed-item', text.replace(/\b(headshot|kill|killed)\b/gi, '<b>$1</b>'));
    this.feed.prepend(item);
    while (this.feed.children.length > 4) this.feed.lastElementChild!.remove();
    setTimeout(() => { item.classList.add('out'); setTimeout(() => item.remove(), 500); }, 4200);
  }

  toast(text: string) {
    const t = el('div', 'ws-glass ws-game-toast', text);
    this.toasts.appendChild(t);
    while (this.toasts.children.length > 4) this.toasts.firstElementChild!.remove();
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 500); }, 3200);
  }

  damageFlash() { this.flash.classList.remove('show'); void this.flash.offsetWidth; this.flash.classList.add('show'); }
  setBoundaryWarning(visible: boolean) { this.boundary.classList.toggle('show', visible); }

  setPaused(paused: boolean) { this.pause.classList.toggle('show', paused && this.entered); }
  get paused() { return this.pause.classList.contains('show'); }

  /**
   * Title screen: the shard deck IS the menu. A horizontal snap carousel of shard cards over the
   * live world; the centred card is the selection. Real chunks are playable (the active one enters,
   * another reloads with `?chunk=`); teasers from `PLACEHOLDERS` crossfade their hero art in behind
   * the deck and turn ENTER WORLD into COMING SOON. `stats` is accepted for API compatibility.
   */
  showIntro(onEnter: () => void, _stats?: IntroStats) {
    this.onEnter = onEnter;
    this.root.classList.add('intro');
    const def = getActiveChunk();
    const cards: DeckCard[] = [
      ...CHUNKS.map((c): DeckCard => ({
        slug: c.slug, displayName: c.displayName, thumbnail: c.thumbnail, blurb: c.blurb,
        label: `${c.biome} · ${c.gridCoords} · ${CHUNK_SIZE} m shard`,
        tag: c === def ? 'Loaded' : 'Load', tagTone: c === def ? 'ok' : '', playable: true, active: c === def,
        heroPortrait: c.heroPortrait, heroLandscape: c.heroLandscape,
      })),
      ...PLACEHOLDERS.map((t): DeckCard => ({
        slug: t.slug, displayName: t.displayName, thumbnail: t.thumbnail, blurb: t.blurb,
        label: `${t.biome} · ${t.gridCoords}`, tag: 'Coming soon', tagTone: 'soon', playable: false, active: false,
        heroPortrait: t.heroPortrait, heroLandscape: t.heroLandscape,
      })),
    ];
    const intro = el('div', 'ws-menu');
    intro.innerHTML = `
      <div class="ws-menu-hero"></div>
      <div class="ws-menu-head"><div class="ws-wordmark">Project <b>Wildshard</b></div></div>
      <div class="ws-menu-deck">
        <div class="ws-menu-cards"><div class="ws-menu-deck-track">${cards.map((c, i) => `
          <button class="ws-menu-card${c.active ? ' active' : ''}${c.playable ? '' : ' soon'}" type="button" data-i="${i}" title="${c.blurb.replace(/"/g, '&quot;')}">
            <span class="ws-menu-card-img" style="background-image:url('${c.thumbnail}')"><i class="ws-menu-card-tag ${c.tagTone}">${c.tag}</i></span>
            <b>${c.displayName}</b><small>${c.label}</small>
          </button>`).join('')}
        </div></div>
        <div class="ws-menu-dots">${cards.map((_, i) => `<i data-i="${i}"></i>`).join('')}</div>
        <button class="ws-menu-enter" type="button"><b>Enter world</b><small>Press any key</small></button>
        <div class="ws-menu-row"><div class="ws-menu-sound">Sound on</div></div>
      </div>`;
    const hero = intro.querySelector<HTMLElement>('.ws-menu-hero')!;
    const list = intro.querySelector<HTMLElement>('.ws-menu-cards')!;
    const cardEls = Array.from(list.querySelectorAll<HTMLElement>('.ws-menu-card'));
    const dots = Array.from(intro.querySelectorAll<HTMLElement>('.ws-menu-dots i'));
    const enterBtn = intro.querySelector<HTMLButtonElement>('.ws-menu-enter')!;
    const enterTitle = enterBtn.querySelector('b')!, enterHint = enterBtn.querySelector('small')!;

    const portrait = () => innerWidth < innerHeight;
    const heroUrl = (c: DeckCard) => (portrait() ? c.heroPortrait : c.heroLandscape) ?? '';
    let index = Math.max(0, cards.findIndex((c) => c.active));
    // paginated track: one card per swipe, always centred — no native scroll, so it can't rest between cards
    const track = list.querySelector<HTMLElement>('.ws-menu-deck-track')!;
    const offsetOf = (i: number) => list.clientWidth / 2 - (cardEls[i].offsetLeft + cardEls[i].offsetWidth / 2);
    const place = (i: number, extra = 0, animate = true) => {
      track.style.transition = animate ? 'transform 0.32s cubic-bezier(0.2, 0.8, 0.2, 1)' : 'none';
      track.style.transform = `translateX(${offsetOf(i) + extra}px)`;
    };

    const apply = () => {
      const c = cards[index];
      cardEls.forEach((e, i) => e.classList.toggle('selected', i === index));
      dots.forEach((d, i) => d.classList.toggle('on', i === index));
      // every card has hero art — the menu never shows the live world (it is paused underneath)
      const url = heroUrl(c);
      if (url) { hero.style.backgroundImage = `url('${url}')`; hero.classList.add('show'); }
      else hero.classList.remove('show');
      enterBtn.classList.toggle('soon', !c.playable);
      enterBtn.disabled = !c.playable;
      enterTitle.textContent = c.playable ? 'Enter world' : 'Coming soon';
      enterHint.textContent = !c.playable ? 'Not yet playable' : c.active ? 'Press any key' : `Reloads with ${c.displayName}`;
    };
    const select = (i: number, smooth = true) => {
      i = Math.max(0, Math.min(cards.length - 1, i));
      place(i, 0, smooth);
      if (i !== index) { index = i; apply(); }
    };
    const activate = () => {
      const c = cards[index];
      if (!c.playable) return;
      if (c.active) this.enter(); else location.href = chunkUrl(c.slug);
    };
    // swipe → the track follows the finger (rubber-banded at the ends), release = one page in the swipe direction
    let drag: { id: number; x0: number; t0: number; dx: number } | null = null;
    list.addEventListener('pointerdown', (e) => {
      if (drag) return;
      drag = { id: e.pointerId, x0: e.clientX, t0: performance.now(), dx: 0 };
      list.setPointerCapture(e.pointerId);
    });
    list.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      drag.dx = e.clientX - drag.x0;
      const atEnd = (drag.dx > 0 && index === 0) || (drag.dx < 0 && index === cards.length - 1);
      place(index, atEnd ? drag.dx * 0.3 : drag.dx, false);
    });
    const endDrag = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      const { dx, t0 } = drag; drag = null;
      const v = dx / Math.max(1, performance.now() - t0); // px/ms
      if (Math.abs(dx) > 36 || (Math.abs(v) > 0.35 && Math.abs(dx) > 14)) { swipedAt = performance.now(); select(index + (dx < 0 ? 1 : -1)); }
      else place(index);
    };
    let swipedAt = 0; // a swipe's trailing click must not re-select the card under the finger
    list.addEventListener('pointerup', endDrag); list.addEventListener('pointercancel', endDrag);
    cardEls.forEach((e, i) => e.addEventListener('click', (ev) => { ev.stopPropagation(); if (i !== index && performance.now() - swipedAt > 400) select(i); }));
    dots.forEach((d, i) => d.addEventListener('click', (ev) => { ev.stopPropagation(); select(i); }));
    enterBtn.addEventListener('click', (ev) => { ev.stopPropagation(); activate(); });
    const soundBtn = intro.querySelector<HTMLElement>('.ws-menu-sound')!;
    if (this.soundOff) { soundBtn.classList.add('off'); soundBtn.textContent = 'Sound off'; }
    soundBtn.addEventListener('click', (e) => { e.stopPropagation(); this.soundOff = soundBtn.classList.toggle('off'); soundBtn.textContent = this.soundOff ? 'Sound off' : 'Sound on'; });
    // orientation flips swap the hero file and re-centre the selected card (card width is viewport-relative)
    let wasPortrait = portrait();
    const onResize = () => {
      if (!this.intro) { removeEventListener('resize', onResize); return; }
      place(index, 0, false);
      if (portrait() !== wasPortrait) { wasPortrait = portrait(); apply(); }
    };
    addEventListener('resize', onResize);
    // preload the hero art so the crossfade is instant (current orientation first, the other set later)
    const preload = (p: boolean) => { for (const c of cards) { const u = (p ? c.heroPortrait : c.heroLandscape); if (u) new Image().src = u; } };
    preload(portrait()); setTimeout(() => preload(!portrait()), 4000);

    this.root.appendChild(intro);
    this.intro = intro;
    this.deck = { cards, get index() { return index; }, select, activate };
    apply();
    requestAnimationFrame(() => place(index, 0, false)); // after layout: offsets need the intro in the DOM
  }

  private enter() {
    if (!this.intro) return;
    const intro = this.intro; this.intro = undefined; this.deck = undefined;
    intro.classList.add('hide');
    setTimeout(() => intro.remove(), Math.max(700, HERO_FADE_MS * 2));
    this.root.classList.remove('intro');
    this.entered = true;
    this.onSoundToggle?.(!this.soundOff); // the world is silent under the menu; the player's choice applies on entry
    this.onEnter?.();
  }

  /** dev: skip the intro entirely */
  markEntered() { this.entered = true; this.root.classList.remove('intro'); }

  /** Pause → "Exit to main menu": back to the chunk selection without a reload. The world stays loaded;
   *  `onExitToMenu` is where main.ts stops the loop / mutes audio. The next ENTER WORLD fires `onEnter` again. */
  exitToMenu() {
    if (!this.entered || this.intro) return;
    this.setPaused(false);
    this.entered = false;
    if (document.pointerLockElement) document.exitPointerLock?.();
    this.onSoundToggle?.(false);
    this.onExitToMenu?.();
    if (this.onEnter) this.showIntro(this.onEnter);
  }
}

function fmt(n: number) { return (n >= 0 ? '+' : '−') + String(Math.abs(n)).padStart(3, '0'); }
