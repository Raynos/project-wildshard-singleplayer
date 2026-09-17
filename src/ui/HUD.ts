import { CHUNK_ID, CHUNK_COORDS, TREE_COUNT, CHUNK_SIZE, TERRAIN_RES, SEED } from '../core/config';

/**
 * HUD — DOM overlay in `#hud`, styled by `src/ui/hud.css` (Wildshard glass identity).
 *
 *   const hud = new HUD({ pointerLock?: boolean });   // pointerLock:false in ?nolock dev mode (no pause overlay)
 *   hud.showIntro(() => player.lock(), stats?)         // intro overlay; ENTER THE CHUNK / Enter key → onEnter
 *   hud.setState({ bolts, loaded, reloading, reloadProgress?, health, fps, pos: {x, z}, yaw, kills, prompt?, speed?, ads? })
 *   hud.showHitMarker(headshot, killed)  hud.killFeed('Boar · headshot')  hud.toast('Bolt recovered')
 *   hud.damageFlash()  hud.setBoundaryWarning(visible)  hud.setPaused(bool)  hud.onResume = () => …
 *   hud.setAimInfo(crossbow.aimInfo)   // "BOAR · 15 M" under the crosshair
 *
 * Call `setState` every frame (it diffs and only touches the DOM on change). Pause overlay appears on
 * pointer-unlock after the chunk was entered (`pointerLock` mode only); clicking it fires `onResume`.
 */

export interface HUDState {
  bolts: number; loaded: boolean; reloading: boolean; reloadProgress?: number;
  health: number; fps: number; pos: { x: number; z: number }; yaw: number; kills: number;
  prompt?: string; speed?: number; ads?: boolean; maxBolts?: number;
}
export interface HUDOptions { pointerLock?: boolean; maxBolts?: number }
export type IntroStats = Record<string, string | { value: string; tone?: 'ok' | 'warn' }>;

const CARDINALS: [number, string, boolean][] = [[0, 'N', true], [45, 'NE', false], [90, 'E', true], [135, 'SE', false], [180, 'S', true], [225, 'SW', false], [270, 'W', true], [315, 'NW', false]];
const PX_PER_DEG = 2.4;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, html?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

export class HUD {
  root: HTMLElement;
  onResume?: () => void;
  onSoundToggle?: (on: boolean) => void;
  private opts: HUDOptions;
  entered = false;
  private onEnter?: () => void;

  private compassStrip!: HTMLElement; private heading!: HTMLElement;
  private feed!: HTMLElement; private toasts!: HTMLElement;
  private fps!: HTMLElement; private coords!: HTMLElement;
  private healthVal!: HTMLElement; private healthBar!: HTMLElement;
  private ammoCount!: HTMLElement; private ammoStatus!: HTMLElement; private ammoStatusText!: HTMLElement; private reloadBar!: HTMLElement; private pips: HTMLElement[] = [];
  private cross!: HTMLElement; private killX!: HTMLElement; private hitRing!: HTMLElement; private aim!: HTMLElement; private aimText = '';
  private prompt!: HTMLElement; private boundary!: HTMLElement; private flash!: HTMLElement;
  private intro?: HTMLElement; private pause!: HTMLElement;
  private last: Partial<HUDState> & { statusKey?: string; headingDeg?: number; fpsShown?: number } = {};
  private hitTimer = 0; private spread = 7;

  constructor(opts: HUDOptions = {}) {
    this.opts = { pointerLock: true, maxBolts: 30, ...opts };
    this.root = document.getElementById('hud') ?? document.body.appendChild(el('div'));
    this.root.id = 'hud';
    this.build();
    document.addEventListener('pointerlockchange', () => {
      if (!this.opts.pointerLock || !this.entered) return;
      const locked = !!document.pointerLockElement;
      this.setPaused(!locked);
    });
    document.addEventListener('keydown', (e) => { if (this.intro && !this.entered && !e.metaKey && !e.ctrlKey && e.code !== 'Escape') this.enter(); });
  }

  private build() {
    const r = this.root;
    // chunk panel
    const chunk = el('div', 'ws-glass ws-chunk');
    chunk.innerHTML = `<div class="ws-title">Project <b>Wildshard</b></div><div class="ws-sub">Chunk playtest</div>
      <div class="ws-row"><span>chunk</span><span class="ws-id">${CHUNK_ID}</span></div>
      <div class="ws-row"><span>grid</span><span>${CHUNK_COORDS}</span></div>
      <div class="ws-row"><span>pos</span><span class="ws-coords">+000 · +000</span></div>
      <div class="ws-tag"><i></i>Local build · unuploaded</div>`;
    this.coords = chunk.querySelector('.ws-coords')!;
    r.appendChild(chunk);

    // compass
    const compass = el('div', 'ws-glass ws-compass');
    this.compassStrip = el('div', 'ws-strip');
    for (let deg = -360; deg < 720; deg += 15) {
      const major = deg % 45 === 0;
      const tick = el('i', 'ws-tick' + (major ? ' major' : ''));
      tick.style.left = `${(deg + 360) * PX_PER_DEG}px`;
      this.compassStrip.appendChild(tick);
    }
    for (let lap = -1; lap <= 1; lap++) for (const [deg, label, major] of CARDINALS) {
      const c = el('div', 'ws-card' + (major ? '' : ' minor') + (label === 'N' ? ' n' : ''), label);
      c.style.left = `${(deg + lap * 360 + 360) * PX_PER_DEG}px`;
      this.compassStrip.appendChild(c);
    }
    compass.appendChild(this.compassStrip);
    compass.appendChild(el('div', 'ws-centre'));
    this.heading = el('div', 'ws-heading', '000°');
    compass.appendChild(this.heading);
    r.appendChild(compass);

    this.feed = el('div', 'ws-feed'); r.appendChild(this.feed);
    this.fps = el('div', 'ws-fps', '<b>60</b> FPS<br>R186 · WEBGL2'); r.appendChild(this.fps);

    // health
    const health = el('div', 'ws-glass ws-health');
    health.innerHTML = `<div class="ws-hrow"><span class="ws-label">Vitals</span><span class="ws-hval"><span class="v">100</span><small>/ 100</small></span></div><div class="ws-bar"><i style="width:100%"></i><u style="left:25%"></u><u style="left:50%"></u><u style="left:75%"></u></div>`;
    this.healthVal = health.querySelector('.v')!; this.healthBar = health.querySelector('.ws-bar i')!;
    r.appendChild(health);

    // ammo
    const ammo = el('div', 'ws-glass ws-ammo');
    ammo.innerHTML = `<div class="ws-arow"><span class="ws-label">Bolts</span><span class="ws-count"><span class="c">30</span> <small>/ ${this.opts.maxBolts}</small></span></div>
      <div class="ws-pips"></div><div class="ws-rbar"><i></i></div><div class="ws-status"><span class="s">Loaded</span><i></i></div>`;
    this.ammoCount = ammo.querySelector('.ws-count')!; this.ammoStatus = ammo.querySelector('.ws-status')!; this.ammoStatusText = ammo.querySelector('.ws-status .s')!; this.reloadBar = ammo.querySelector('.ws-rbar i')!;
    const pips = ammo.querySelector('.ws-pips')!;
    for (let i = 0; i < (this.opts.maxBolts ?? 30); i++) { const p = el('i'); pips.appendChild(p); this.pips.push(p); }
    r.appendChild(ammo);

    // crosshair
    this.cross = el('div', 'ws-cross', '<i class="t"></i><i class="b"></i><i class="l"></i><i class="r"></i><u></u><div class="ws-x"></div>');
    this.killX = this.cross.querySelector('.ws-x')!;
    r.appendChild(this.cross);
    this.hitRing = el('div', 'ws-hitring'); r.appendChild(this.hitRing);
    this.aim = el('div', 'ws-aim'); r.appendChild(this.aim);

    this.prompt = el('div', 'ws-glass ws-prompt'); r.appendChild(this.prompt);
    this.boundary = el('div', 'ws-boundary', '<div class="ws-bt">Chunk boundary</div><div class="ws-bs">No-man\'s land beyond · nothing has been generated here</div>'); r.appendChild(this.boundary);
    this.toasts = el('div', 'ws-toasts'); r.appendChild(this.toasts);
    this.flash = el('div', 'ws-flash'); r.appendChild(this.flash);

    this.pause = el('div', 'ws-pause', '<div class="ws-glass ws-pbox"><div class="ws-pt">Paused</div><div class="ws-ps">Click to resume · Esc to release the cursor</div></div>');
    this.pause.addEventListener('click', () => { this.setPaused(false); this.onResume?.(); });
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
      this.compassStrip.style.transform = `translateX(${220 - (deg + 360) * PX_PER_DEG}px)`;
      this.heading.textContent = `${String(Math.round(deg)).padStart(3, '0')}°`;
    }
    if (s.health !== L.health) {
      L.health = s.health;
      const h = Math.max(0, Math.min(100, s.health));
      this.healthVal.textContent = String(Math.round(h));
      this.healthBar.style.width = `${h}%`;
      this.healthBar.classList.toggle('low', h <= 30);
    }
    if (s.bolts !== L.bolts) {
      L.bolts = s.bolts;
      this.ammoCount.firstElementChild!.textContent = String(s.bolts);
      this.ammoCount.classList.toggle('empty', s.bolts <= 0);
      this.pips.forEach((p, i) => p.classList.toggle('off', i >= s.bolts));
    }
    const statusKey = s.bolts <= 0 && !s.loaded ? 'empty' : s.reloading ? 'reloading' : s.loaded ? 'loaded' : 'spent';
    if (statusKey !== L.statusKey) {
      L.statusKey = statusKey;
      this.ammoStatus.className = 'ws-status ' + (statusKey === 'empty' ? 'empty' : statusKey === 'reloading' ? 'reloading' : '');
      this.ammoStatusText.textContent = statusKey === 'empty' ? 'No bolts' : statusKey === 'reloading' ? 'Spanning' : statusKey === 'loaded' ? 'Loaded' : 'Spent · R to span';
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
    const item = el('div', 'ws-item', text.replace(/\b(headshot|kill|killed)\b/gi, '<b>$1</b>'));
    this.feed.prepend(item);
    while (this.feed.children.length > 4) this.feed.lastElementChild!.remove();
    setTimeout(() => { item.classList.add('out'); setTimeout(() => item.remove(), 500); }, 4200);
  }

  toast(text: string) {
    const t = el('div', 'ws-glass ws-toast', text);
    this.toasts.appendChild(t);
    while (this.toasts.children.length > 4) this.toasts.firstElementChild!.remove();
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 500); }, 3200);
  }

  damageFlash() { this.flash.classList.remove('show'); void this.flash.offsetWidth; this.flash.classList.add('show'); }
  setBoundaryWarning(visible: boolean) { this.boundary.classList.toggle('show', visible); }

  setPaused(paused: boolean) { this.pause.classList.toggle('show', paused && this.entered); }
  get paused() { return this.pause.classList.contains('show'); }

  /** Intro overlay. `stats` rows go into the CHUNK PLAYTEST panel (string, or {value, tone}). */
  showIntro(onEnter: () => void, stats?: IntroStats) {
    this.onEnter = onEnter;
    this.root.classList.add('intro');
    const rows: IntroStats = {
      'Chunk': CHUNK_ID,
      'Grid': CHUNK_COORDS,
      'Size': `${CHUNK_SIZE} m × ${CHUNK_SIZE} m`,
      'Build': { value: 'local · unuploaded', tone: 'warn' },
      'Seed': `0x${SEED.toString(16).toUpperCase().padStart(8, '0')}`,
      'Validation': { value: `ok · ${TERRAIN_RES}² heightfield · ${TREE_COUNT.toLocaleString()} pines`, tone: 'ok' },
      ...(stats ?? {}),
    };
    const intro = el('div', 'ws-intro');
    intro.innerHTML = `
      <div class="ws-head">
        <div class="ws-wordmark">Project <b>Wildshard</b></div>
        <div class="ws-tagline">A world that does not exist yet, arriving one chunk at a time.</div>
        <div class="ws-phase">Phase 1 — gameplay contract · local chunk playtest</div>
      </div>
      <div class="ws-body"><div class="ws-glass ws-panel">
        <div class="ws-ptitle">Chunk playtest · <b>pine-hollow</b></div>
        <div class="ws-meta"></div>
        <button class="ws-enter"><span>Enter the chunk</span><small>click · or press Enter</small></button>
      </div></div>
      <div class="ws-enterbar"><div class="ws-eicon">⇥</div><div class="ws-etext"><b>Enter the chunk</b><small>Press any key</small></div><div class="ws-ready">Ready</div></div>
      <div class="ws-glass ws-sound">Sound on</div>
      <div class="ws-foot">
        <div class="ws-legend"><span><b>WASD</b>move</span><span><b>Shift</b>sprint</span><span><b>LMB</b>fire</span><span><b>RMB</b>aim</span><span><b>R</b>span</span><span><b>E</b>interact</span><span><b>Esc</b>release cursor</span></div>
        <div class="ws-credit">An in-progress private project</div>
      </div>`;
    const meta = intro.querySelector('.ws-meta')!;
    for (const [k, v] of Object.entries(rows)) {
      const val = typeof v === 'string' ? v : v.value, tone = typeof v === 'string' ? '' : v.tone ?? '';
      meta.appendChild(el('div', undefined, `<span>${k}</span><span class="${tone}">${val}</span>`));
    }
    intro.querySelector('.ws-enter')!.addEventListener('click', () => this.enter());
    intro.querySelector('.ws-enterbar')!.addEventListener('click', () => this.enter());
    intro.querySelector('.ws-sound')!.addEventListener('click', (e) => { e.stopPropagation(); const b = e.currentTarget as HTMLElement; const off = b.classList.toggle('off'); b.textContent = off ? 'Sound off' : 'Sound on'; this.onSoundToggle?.(!off); });
    this.root.appendChild(intro);
    this.intro = intro;
  }

  private enter() {
    if (!this.intro) return;
    const intro = this.intro; this.intro = undefined;
    intro.classList.add('hide');
    setTimeout(() => intro.remove(), 700);
    this.root.classList.remove('intro');
    this.entered = true;
    this.onEnter?.();
  }

  /** dev: skip the intro entirely */
  markEntered() { this.entered = true; this.root.classList.remove('intro'); }
}

function fmt(n: number) { return (n >= 0 ? '+' : '−') + String(Math.abs(n)).padStart(3, '0'); }
