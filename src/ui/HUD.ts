import { CHUNK_SIZE } from '../core/config';
import { CHUNKS, getActiveChunk, chunkUrl } from '../chunks/registry';
import { PLACEHOLDERS } from '../chunks/placeholders';

/**
 * HUD — DOM overlay in `#hud`, styled by `src/ui/hud.css` (Wildshard glass identity).
 *
 *   const hud = new HUD({ pointerLock?: boolean });   // pointerLock:false in ?nolock dev mode (no pause overlay)
 *   hud.showIntro(() => player.lock())                 // title screen: shard deck; ENTER WORLD / any key → onEnter
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

/** One card in the title-screen deck: an authored chunk (playable) or a teaser (coming soon). */
interface DeckCard {
  slug: string; displayName: string; label: string; thumbnail: string; tag: string; tagTone: 'ok' | 'soon' | '';
  playable: boolean; active: boolean; heroPortrait?: string; heroLandscape?: string; blurb: string;
}
const HERO_FADE_MS = 350;

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
  private deck?: { cards: DeckCard[]; index: number; select: (i: number, smooth?: boolean) => void; activate: () => void };
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
    const chunk = el('div', 'ws-glass ws-chunk');
    chunk.innerHTML = `<div class="ws-title">Project <b>Wildshard</b></div><div class="ws-sub">Chunk playtest</div>
      <div class="ws-row"><span>chunk</span><span class="ws-id">${def.id}</span></div>
      <div class="ws-row"><span>grid</span><span>${def.gridCoords}</span></div>
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

    this.pause = el('div', 'ws-pause', `<div class="ws-glass ws-pbox">
      <div class="ws-pt">Paused</div><div class="ws-ps">${this.opts.pointerLock ? 'Esc released the cursor' : 'Chunk playtest'}</div>
      <button class="ws-pbtn resume" type="button">Resume</button>
      <button class="ws-pbtn exit" type="button">Exit to main menu</button>
    </div>`);
    const resume = () => { this.setPaused(false); this.onResume?.(); };
    this.pause.addEventListener('click', (e) => { if (e.target === this.pause) resume(); }); // backdrop click = resume (desktop habit)
    this.pause.querySelector('.resume')!.addEventListener('click', resume);
    this.pause.querySelector('.exit')!.addEventListener('click', () => location.reload()); // the title screen is the boot; a reload is the honest way back
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
      })),
      ...PLACEHOLDERS.map((t): DeckCard => ({
        slug: t.slug, displayName: t.displayName, thumbnail: t.thumbnail, blurb: t.blurb,
        label: `${t.biome} · ${t.gridCoords}`, tag: 'Coming soon', tagTone: 'soon', playable: false, active: false,
        heroPortrait: t.heroPortrait, heroLandscape: t.heroLandscape,
      })),
    ];
    const intro = el('div', 'ws-intro');
    intro.innerHTML = `
      <div class="ws-hero"></div>
      <div class="ws-head"><div class="ws-wordmark">Project <b>Wildshard</b></div></div>
      <div class="ws-deck">
        <div class="ws-cards"><div class="ws-track">${cards.map((c, i) => `
          <button class="ws-card${c.active ? ' active' : ''}${c.playable ? '' : ' soon'}" type="button" data-i="${i}" title="${c.blurb.replace(/"/g, '&quot;')}">
            <span class="ws-card-img" style="background-image:url('${c.thumbnail}')"><i class="ws-card-tag ${c.tagTone}">${c.tag}</i></span>
            <b>${c.displayName}</b><small>${c.label}</small>
          </button>`).join('')}
        </div></div>
        <div class="ws-dots">${cards.map((_, i) => `<i data-i="${i}"></i>`).join('')}</div>
        <button class="ws-enter" type="button"><b>Enter world</b><small>Press any key</small></button>
        <div class="ws-row"><div class="ws-sound">Sound on</div></div>
      </div>`;
    const hero = intro.querySelector<HTMLElement>('.ws-hero')!;
    const list = intro.querySelector<HTMLElement>('.ws-cards')!;
    const cardEls = Array.from(list.querySelectorAll<HTMLElement>('.ws-card'));
    const dots = Array.from(intro.querySelectorAll<HTMLElement>('.ws-dots i'));
    const enterBtn = intro.querySelector<HTMLButtonElement>('.ws-enter')!;
    const enterTitle = enterBtn.querySelector('b')!, enterHint = enterBtn.querySelector('small')!;

    const portrait = () => innerWidth < innerHeight;
    const heroUrl = (c: DeckCard) => (portrait() ? c.heroPortrait : c.heroLandscape) ?? '';
    let index = Math.max(0, cards.findIndex((c) => c.active));
    // paginated track: one card per swipe, always centred — no native scroll, so it can't rest between cards
    const track = list.querySelector<HTMLElement>('.ws-track')!;
    const offsetOf = (i: number) => list.clientWidth / 2 - (cardEls[i].offsetLeft + cardEls[i].offsetWidth / 2);
    const place = (i: number, extra = 0, animate = true) => {
      track.style.transition = animate ? 'transform 0.32s cubic-bezier(0.2, 0.8, 0.2, 1)' : 'none';
      track.style.transform = `translateX(${offsetOf(i) + extra}px)`;
    };

    const apply = () => {
      const c = cards[index];
      cardEls.forEach((e, i) => e.classList.toggle('selected', i === index));
      dots.forEach((d, i) => d.classList.toggle('on', i === index));
      const url = c.playable ? '' : heroUrl(c);
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
    intro.querySelector('.ws-sound')!.addEventListener('click', (e) => { e.stopPropagation(); const b = e.currentTarget as HTMLElement; const off = b.classList.toggle('off'); b.textContent = off ? 'Sound off' : 'Sound on'; this.onSoundToggle?.(!off); });
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
    this.onEnter?.();
  }

  /** dev: skip the intro entirely */
  markEntered() { this.entered = true; this.root.classList.remove('intro'); }
}

function fmt(n: number) { return (n >= 0 ? '+' : '−') + String(Math.abs(n)).padStart(3, '0'); }
