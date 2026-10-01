import { app } from '../app/runtime';
import { tap } from '../core/harnessTap';
import { getActiveChunk } from '#game/shard/registry';
import { requestShard } from '#game/travel/switch';
import { CABIN_SITES } from '../world/Heightfield';
import type { GameMenu } from './Menu';
import { openBootSettings } from './BootSettings';
import { isDev } from '../core/devMode';
import { buildTitleDeck, titleCards, type TitleDeck } from '#game/titleDeck';
import { ToastStack } from './ToastStack';
import { ROW, hudSlots } from './hudSlots';

/**
 * HUD — DOM overlay in `#hud`, styled by `src/engine/ui/styles/game.css` / `menu.css` (the in-game menu is src/engine/ui/Menu.ts + gmenu.css) on top of `base.css` (Wildshard glass identity; one class prefix per screen, see scripts/check-css.mjs).
 *
 *   const hud = new HUD({ pointerLock?: boolean });   // pointerLock:false in ?nolock dev mode (no pause overlay)
 *   hud.showIntro(() => player.lock())                 // title screen: shard deck + ENTER WORLD / EXPLORE WORLD; any key → onEnter
 *   hud.onExplore = () => …  hud.startExplore()        // EXPLORE WORLD (src/engine/explore/Explore.ts); startExplore = a `?explore=` deep link
 *   hud.setState({ bolts?, loaded, reloading, reloadProgress?, health, pos: {x, z}, yaw, kills, prompt?, speed?, ads?,
 *                  maxBolts?, reserve?, ammoLabel?, weaponName?, segments? })
 *     — the ammo strip is generic: `bolts` is the held weapon's ammo (BOLTS 27 / 30 for the crossbow, ROUNDS 27 / 30 + 60
 *       with the "AR-15" tag for the rifle — src/engine/player/Weapons.ts)
 *     — `bolts: undefined` = the weapon has no ammo (the sword): the BOLTS panel, its meter and the touch-bar strip are hidden
 *   hud.showHitMarker(headshot, killed)  hud.killFeed('Boar · headshot')  hud.toast('Bolt recovered')
 *   hud.damageFlash()  hud.setBoundaryWarning(visible)  hud.menu = gameMenu  hud.setPaused(bool)  hud.onResume = () => …  // the menu's close
 *   hud.onExitToMenu = () => …   // pause → "Exit to main menu": the HUD re-shows the intro itself (no reload); stop/mute the world here
 *   hud.setAimInfo(crossbow.aimInfo)   // "BOAR · 15 M" under the crosshair
 *   hud.setAnimals([{ x, z }, …])      // world positions of live animals: the compass pins a paw at the nearest one within 120 m
 *
 * Compass: a smoked-glass band (both desktop and touch) with a cyan house marker at the bearing of the nearest cabin
 * (`CABIN_SITES` — static, so the HUD reads them itself) and a "CABIN · 180 m" readout under it; the paw marker comes
 * from `state.nearest` (bearing in compass degrees, 0 = north) when the caller has one, else from `setAnimals`.
 *
 * Weather (Nalati, src/shards/nalati-grasslands/weather.ts): a `ws:weather` document event (`WeatherHUD` detail, `WEATHER_EVENT`) shows the
 * small STORM chip under the minimap ("STORM IN 0:45 · WIND 14 m/s", "STORM 2:10 · WIND 22 m/s") and the amber
 * "LIGHTNING — GET LOW" warning top-centre. Nothing is built until the first event, so other shards never see either.
 *
 * Call `setState` every frame (it diffs and only touches the DOM on change). Pause = the in-game menu on its
 * Settings tab: opened by the touch PAUSE button, Esc, or a released pointer lock after the chunk was entered
 * (`pointerLock` mode only); closing it fires `onResume`.
 */

export interface HUDState {
  /** bolts carried; undefined = no ammo on this weapon (melee) → the ammo readouts are hidden */
  bolts?: number | undefined; loaded: boolean; reloading: boolean; reloadProgress?: number | undefined;
  health: number; pos: { x: number; z: number }; yaw: number; kills: number;
  /** the health bar's full mark (default 100; Driftwood's sturdy hearts raise it to 120 / 140, E314 stage 2) */
  maxHealth?: number | undefined;
  prompt?: string | undefined; speed?: number | undefined; ads?: boolean | undefined; maxBolts?: number | undefined;
  /** generic ammo strip (Weapons.ts): `reserve` rounds beyond the magazine (hidden when 0), `ammoLabel` "Bolts" / "Rounds",
   *  `weaponName` tag ("CROSSBOW" / "AR-15"), `segments` bars over the magazine on the touch strip (4 crossbow, 6 rifle) */
  reserve?: number | undefined; ammoLabel?: string | undefined; weaponName?: string | undefined; segments?: number | undefined;
  /** nearest animal for the compass paw: `bearing` in compass degrees (0 = north = +Z, 90 = east = −X) — see `bearingTo` */
  nearest?: { bearing: number; distance: number; kind: string } | undefined;
}
export interface HUDOptions { pointerLock?: boolean; maxBolts?: number }
/** the `ws:weather` event's detail — sent on change only (src/shards/nalati-grasslands/weather.ts) */
export interface WeatherHUD {
  /** the chip under the minimap: `title` "STORM IN 0:45" / "STORM 2:10", `sub` "WIND 22 m/s"; null hides it */
  chip: { title: string; sub: string; tone: 'soon' | 'storm' | 'clearing' } | null;
  /** the amber LIGHTNING — GET LOW warning */
  getLow: boolean;
}
export const WEATHER_EVENT = 'ws:weather';
const SVG_STORM = '<svg viewBox="0 0 24 24"><path d="M7 15a5 5 0 0 1-.6-9.96A6.5 6.5 0 0 1 18.8 7.1 4 4 0 0 1 18 15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M13.2 11.5 10 16.6h3l-2 5.2 5.2-6.6h-3l1.6-3.7z" fill="currentColor"/></svg>';
const SVG_WARN = '<svg viewBox="0 0 24 24"><path d="M12 3 1.8 20.5h20.4z" fill="currentColor"/><path d="M12 9.5v5.2M12 16.8v1.6" stroke="#1a1204" stroke-width="2.2" stroke-linecap="round"/></svg>';
export type IntroStats = Record<string, string | { value: string; tone?: 'ok' | 'warn' }>;

const HERO_FADE_MS = 350;

const CARDINALS: [number, string, boolean][] = [[0, 'N', true], [45, 'NE', false], [90, 'E', true], [135, 'SE', false], [180, 'S', true], [225, 'SW', false], [270, 'W', true], [315, 'NW', false]];
const BAND_DEGREES = 292; // the band spans this much heading (W · N · E all visible, like the K1 mockup); px/deg follows its width
const PAW_RANGE = 120;   // m — the compass only pins an animal this close
const MARKER_INSET = 22; // px — a marker behind the player parks at the band's edge instead of leaving it
/** E319 (Jake's clean-HUD pick B, rule 1): VITALS hide at full health — back to full, they stay this long, then fade out
 *  over VITALS_FADE_MS (game.css `.hp-fade`) and leave the column (`.hp-gone`, the rows under them move up). Any hit brings
 *  them back at once. */
const VITALS_HIDE_MS = 2000;
const VITALS_FADE_MS = 400;

/** compass bearing (deg, 0 = north) of the point (tx, tz) seen from (x, z). North is +Z (the south-gate spawn's forward,
 *  yaw π, is `player.forward = (−sin yaw, −cos yaw)` = +Z) and the heading is `180 − yaw°`, which puts east at −X. */
export function bearingTo(x: number, z: number, tx: number, tz: number): number {
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
/** `root.querySelector(sel)` for markup this file wrote itself (build time only): a miss is a bug, so it throws */
function q(root: ParentNode, sel: string): HTMLElement {
  const e = root.querySelector<HTMLElement>(sel);
  if (!e) throw new Error(`HUD: no ${sel}`);
  return e;
}

export class HUD {
  root: HTMLElement;
  onResume?: () => void;
  onExitToMenu?: () => void;
  private opts: HUDOptions;
  private _entered = false;
  get entered(): boolean { return this._entered; }
  set entered(value: boolean) {
    this._entered = value;
    if (app.state !== 'loading') app.setState(value ? 'play' : 'title');
  }
  private onEnter?: () => void;
  /** EXPLORE WORLD on the title (main.ts opens src/engine/explore/Explore.ts) */
  onExplore?: () => void;
  /** Shared HUD + Weapon Explorer practice room, reached as a title spawn mode. */
  onArena?: () => void;

  private compassStrip!: HTMLElement; private band!: HTMLElement;
  private markHouse!: HTMLElement; private markPaw!: HTMLElement; private range!: HTMLElement;
  private animals: { x: number; z: number }[] = [];
  /** touch layout E (E42): the vitals + bolts strips rendered into TouchControls' top-left status column (`.ws-touch-status`, under PAUSE) */
  private bar?: { vitals: HTMLElement; hval: HTMLElement; hbar: HTMLElement; bolts: HTMLElement; bcount: HTMLElement; segs: HTMLElement[]; segBox: HTMLElement; label: HTMLElement; weapon: HTMLElement; max: HTMLElement; reserve: HTMLElement };
  private lastMark = { house: Number.NaN, paw: Number.NaN, range: '' };
  private ppd = 1.2; // compass px per degree — measured from the band (`--ppd`), see build()
  /** the band's width, measured when it resizes (build()'s fit): placeMark ran every frame and read clientWidth after the
   *  frame's HUD writes — a forced layout per frame (E142 aggro-perf) */
  private bandW = -1;
  private feed!: HTMLElement; private toasts!: ToastStack; private toastBox!: HTMLElement;
  private healthVal!: HTMLElement; private healthBar!: HTMLElement; private healthPanel!: HTMLElement; private healthMax!: HTMLElement;
  /** E319: when health last reached full (performance.now; -Infinity = full since the start, null = hurt) and the VITALS
   *  visibility as last painted — they start hidden, the player spawns at full health */
  private hpFullAt: number | null = Number.NEGATIVE_INFINITY; private hpShown: 'show' | 'fade' | 'gone' = 'gone';
  private ammoCount!: HTMLElement; private ammoNum!: HTMLElement; private ammoStatus!: HTMLElement; private ammoStatusText!: HTMLElement; private reloadBar!: HTMLElement; private pips: HTMLElement[] = [];
  private cross!: HTMLElement; private killX!: HTMLElement; private hitRing!: HTMLElement; private aim!: HTMLElement; private aimText = '';
  private prompt!: HTMLElement; private boundary!: HTMLElement; private flash!: HTMLElement;
  private intro?: HTMLElement | undefined;
  /** the in-game menu (src/engine/ui/Menu.ts) — pause opens it on Settings; its close is our `onResume` */
  private _menu?: GameMenu;
  private deck?: TitleDeck | undefined;
  private last: Partial<HUDState> & { statusKey?: string | undefined; headingDeg?: number | undefined; noAmmo?: boolean | undefined } = {};
  private ammoPanel!: HTMLElement;
  private ammoLabel!: HTMLElement; private ammoMax!: HTMLElement; private ammoReserve!: HTMLElement; private ammoWeapon!: HTMLElement; private pipBox!: HTMLElement;
  private hitTimer = 0; private spread = 7;

  /** the weather chip + GET LOW warning (built on the first `ws:weather` event) */
  private weather?: { chip: HTMLElement; title: HTMLElement; sub: HTMLElement; low: HTMLElement; last: string };

  /** the review composer (src/engine/ui/Feedback.ts) is up: losing the pointer lock does not open the pause menu */
  holdPause = false;
  /** when the menu last closed (performance.now) — see the pointerlockchange listener */
  private menuClosedAt = -Infinity;

  constructor(opts: HUDOptions = {}) {
    this.opts = { pointerLock: true, maxBolts: 30, ...opts };
    const hud = document.getElementById('hud');
    this.root = hud ?? el('div');
    if (!hud) document.body.append(this.root);
    this.root.id = 'hud';
    this.build();
    this.mountBar();
    document.addEventListener('pointerlockchange', () => {
      if (!this.opts.pointerLock || !this.entered || this.holdPause) return;
      const locked = Boolean(document.pointerLockElement); // undefined where pointer lock is absent (iOS)
      // the lock came back: close the menu. It went away: pause — unless the menu is already up. M / I / the minimap open it
      // on their tab and release the lock themselves (Menu.onOpen); that release used to flip it to Settings (E130)
      // A lock lost within a moment of the menu closing is the Esc that closed it (the browser's own Esc handling
      // releases the lock the close had just re-taken): stay closed, a click on the canvas takes the lock back
      if (locked) this.setPaused(false); else if (!this.paused && performance.now() - this.menuClosedAt > 400) this.setPaused(true);
    });
    document.addEventListener('keydown', (e) => {
      if (!this.intro || this.entered || e.metaKey || e.ctrlKey || e.code === 'Escape') return;
      const deck = this.deck;
      if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') { e.preventDefault(); deck?.select(deck.index + (e.code === 'ArrowLeft' ? -1 : 1)); return; }
      if (deck) deck.activate(); else this.enter();
    });
  }

  private build(): void {
    const r = this.root;
    // (the desktop chunk panel — chunk:// id, grid, pos, "local build" — is gone: E140, the user's verdict on dead item 1)

    // compass: a slim band; the strip sits at the band's centre and slides by the heading (see setState)
    const compass = el('div', 'ws-game-compass');
    compass.innerHTML = '<i class="ws-game-brk tl"></i><i class="ws-game-brk tr"></i><i class="ws-game-brk bl"></i><i class="ws-game-brk br"></i>';
    const band = el('div', 'ws-game-band');
    this.compassStrip = el('div', 'ws-game-strip');
    for (let deg = -360; deg < 720; deg += 15) {
      const major = deg % 45 === 0;
      const tick = el('i', `ws-game-tick${major ? ' major' : ''}`);
      tick.style.left = `calc(${deg + 360} * var(--ppd))`;
      this.compassStrip.append(tick);
    }
    for (let lap = -1; lap <= 1; lap++) for (const [deg, label, major] of CARDINALS) {
      const c = el('div', `ws-game-cardinal${major ? '' : ' minor'}${label === 'N' ? ' n' : ''}`, label);
      c.style.left = `calc(${deg + lap * 360 + 360} * var(--ppd))`;
      this.compassStrip.append(c);
    }
    this.band = band;
    band.append(this.compassStrip);
    this.markHouse = el('div', 'ws-game-mark house', SVG_HOUSE); band.append(this.markHouse);
    this.markPaw = el('div', 'ws-game-mark paw', SVG_PAW); band.append(this.markPaw);
    band.append(el('div', 'ws-game-centre'));
    compass.append(band);
    compass.append(el('div', 'ws-game-notch'));
    // px/deg scales with the band (90 vw on a phone, fixed on desktop): ticks and cardinals are laid out in `--ppd` units
    const fit = (): void => { const w = band.clientWidth; this.bandW = w; if (!w) return; this.ppd = w / BAND_DEGREES; band.style.setProperty('--ppd', `${this.ppd}px`); this.last.headingDeg = undefined; this.lastMark.house = this.lastMark.paw = Number.NaN; };
    new ResizeObserver(fit).observe(band);
    fit();
    this.range = el('div', 'ws-game-range'); compass.append(this.range);
    r.append(compass);

    this.feed = el('div', 'ws-game-feed'); r.append(this.feed);

    // health
    const health = el('div', 'ws-glass ws-game-health');
    health.innerHTML = `<div class="ws-game-hrow"><span class="ws-label">Vitals</span><span class="ws-game-hval"><span class="v">100</span><small>/ 100</small></span></div><div class="ws-bar"><i style="width:100%"></i><u style="left:25%"></u><u style="left:50%"></u><u style="left:75%"></u></div>`;
    this.healthVal = q(health, '.v'); this.healthBar = q(health, '.ws-bar i'); this.healthMax = q(health, '.ws-game-hval small');
    this.healthPanel = health; health.classList.add('hp-fade', 'hp-gone'); // E319: hidden at full health (setState)
    r.append(health);

    // ammo
    const ammo = el('div', 'ws-glass ws-game-ammo');
    ammo.innerHTML = `<div class="ws-game-arow"><span class="ws-label"><span class="ws-game-weapon">Crossbow</span><span class="l">Bolts</span></span><span class="ws-game-count"><span class="c">30</span> <small>/ <span class="m">${this.opts.maxBolts}</span></small><small class="ws-game-reserve"></small></span></div>
      <div class="ws-game-pips"></div><div class="ws-game-rbar"><i></i></div><div class="ws-game-status"><span class="s">Loaded</span><i></i></div>`;
    this.ammoPanel = ammo;
    this.ammoCount = q(ammo, '.ws-game-count'); this.ammoNum = q(this.ammoCount, '.c'); this.ammoStatus = q(ammo, '.ws-game-status'); this.ammoStatusText = q(ammo, '.ws-game-status .s'); this.reloadBar = q(ammo, '.ws-game-rbar i');
    this.ammoLabel = q(ammo, '.ws-label .l'); this.ammoWeapon = q(ammo, '.ws-game-weapon'); this.ammoMax = q(ammo, '.m'); this.ammoReserve = q(ammo, '.ws-game-reserve');
    this.pipBox = q(ammo, '.ws-game-pips');
    this.buildPips(this.opts.maxBolts ?? 30);
    r.append(ammo);

    // crosshair
    this.cross = el('div', 'ws-game-cross', '<i class="t"></i><i class="b"></i><i class="l"></i><i class="r"></i><u></u><div class="ws-game-x"></div>');
    this.killX = q(this.cross, '.ws-game-x');
    r.append(this.cross);
    this.hitRing = el('div', 'ws-game-hitring'); r.append(this.hitRing);
    this.aim = el('div', 'ws-game-aim'); r.append(this.aim);

    this.prompt = el('div', 'ws-glass ws-game-prompt'); r.append(this.prompt);
    this.boundary = el('div', 'ws-game-boundary', '<div class="ws-game-bt">Chunk boundary</div><div class="ws-game-bs">No-man\'s land beyond · nothing has been generated here</div>'); r.append(this.boundary);
    const toasts = el('div', 'ws-game-toasts'); r.append(toasts); this.toasts = new ToastStack(toasts); this.toastBox = toasts;
    this.flash = el('div', 'ws-game-flash'); r.append(this.flash);

    // pause = the in-game menu on its Settings tab (src/engine/ui/Menu.ts, attached by main.ts as `hud.menu`):
    // the touch PAUSE button (TouchControls) and a released pointer lock; Escape (and M / I) is the menu's own key listener,
    // gated by `keyGate` below (E130 — the HUD's Esc here opened the menu the menu's listener then closed, E32)
    document.addEventListener('ws:pause', () => { if (this.entered) this.setPaused(!this.paused); });
    // native shells (src/engine/native/lifecycle.ts): the app went to the background → pause, never unpause;
    // Android Back → close the menu or pause; preventDefault() tells the shell it was used (else it minimizes the app)
    document.addEventListener('ws:background', () => { if (this.entered && !this.paused) this.setPaused(true); });
    document.addEventListener('ws:back', (e) => { if (!this.entered) return; e.preventDefault(); this.setPaused(!this.paused); });
    document.addEventListener(WEATHER_EVENT, (e) => { if (e instanceof CustomEvent) this.setWeather(e.detail as WeatherHUD); });
  }

  /** the storm chip + GET LOW warning (see WeatherHUD); normally driven by the `ws:weather` event */
  setWeather(w: WeatherHUD): void {
    if (!this.weather) {
      if (!w.chip && !w.getLow) return;
      const chip = el('div', 'ws-game-weather', `<i class="ws-game-wicon">${SVG_STORM}</i><div><div class="ws-game-wt"></div><div class="ws-game-ws"></div></div>`);
      const low = el('div', 'ws-game-getlow', `<i>${SVG_WARN}</i><span>Lightning — get low</span>`);
      this.root.append(chip, low);
      this.weather = { chip, title: q(chip, '.ws-game-wt'), sub: q(chip, '.ws-game-ws'), low, last: '' };
    }
    const W = this.weather;
    const key = `${w.chip?.title ?? ''}|${w.chip?.sub ?? ''}|${w.chip?.tone ?? ''}|${String(w.getLow)}`;
    if (key === W.last) return;
    W.last = key;
    W.chip.classList.toggle('show', w.chip !== null);
    if (w.chip) {
      W.title.textContent = w.chip.title; W.sub.textContent = w.chip.sub;
      W.chip.classList.toggle('storm', w.chip.tone === 'storm');
    }
    W.low.classList.toggle('show', w.getLow);
  }

  private buildPips(n: number): void {
    this.pipBox.replaceChildren(); this.pips.length = 0;
    for (let i = 0; i < n; i++) { const p = el('i'); this.pipBox.append(p); this.pips.push(p); }
  }

  // ── per-frame state ──
  setState(s: HUDState): void {
    const L = this.last;
    this.toasts.tick();
    // the held weapon: label / name / magazine size / reserve (Weapons.ts) — rebuilds the pips + bars when the weapon changes
    const maxBolts = s.maxBolts ?? this.opts.maxBolts ?? 30, label = s.ammoLabel ?? 'Bolts', name = s.weaponName ?? 'Crossbow', segments = s.segments ?? 4, reserve = s.reserve ?? 0;
    if (maxBolts !== L.maxBolts || label !== L.ammoLabel || name !== L.weaponName || segments !== L.segments) {
      L.maxBolts = maxBolts; L.ammoLabel = label; L.weaponName = name; L.segments = segments; L.statusKey = undefined; L.bolts = undefined;
      this.ammoLabel.textContent = label; this.ammoWeapon.textContent = name; this.ammoMax.textContent = String(maxBolts);
      if (this.pips.length !== maxBolts) this.buildPips(maxBolts);
      if (this.bar) { this.bar.label.textContent = label; this.bar.weapon.textContent = name; this.bar.max.textContent = String(maxBolts); this.buildSegs(segments); }
    }
    if (reserve !== L.reserve) { L.reserve = reserve; const txt = reserve > 0 ? `+ ${reserve}` : ''; this.ammoReserve.textContent = txt; if (this.bar) this.bar.reserve.textContent = txt; }
    // compass: +Z (the south-gate spawn's forward, yaw π) is north; turning left decreases the heading
    let deg = 180 - (s.yaw * 180) / Math.PI; deg = ((deg % 360) + 360) % 360;
    const degR = Math.round(deg * 2) / 2;
    if (degR !== L.headingDeg) {
      L.headingDeg = degR;
      this.compassStrip.style.transform = `translateX(${-(deg + 360) * this.ppd}px)`;
    }
    this.updateMarkers(s, deg);
    const maxHp = s.maxHealth ?? 100;
    if (s.health !== L.health || maxHp !== L.maxHealth) {
      if (maxHp !== L.maxHealth) { L.maxHealth = maxHp; this.healthMax.textContent = `/ ${maxHp}`; }
      L.health = s.health;
      const h = Math.max(0, Math.min(maxHp, s.health)), pct = (h / maxHp) * 100;
      this.healthVal.textContent = String(Math.round(h));
      this.healthBar.style.width = `${pct}%`;
      this.healthBar.classList.toggle('low', pct <= 30);
      this.syncBar('health');
    }
    // E319: VITALS only while hurt — full → VITALS_HIDE_MS → a fade → gone; a hit shows them the same frame
    const now = performance.now();
    if (s.health < maxHp) this.hpFullAt = null; else this.hpFullAt ??= now;
    const fullFor = this.hpFullAt === null ? -1 : now - this.hpFullAt;
    const hp = fullFor < VITALS_HIDE_MS ? 'show' : fullFor < VITALS_HIDE_MS + VITALS_FADE_MS ? 'fade' : 'gone';
    if (hp !== this.hpShown) { this.hpShown = hp; this.paintVitals(); }
    const noAmmo = s.bolts === undefined;
    if (noAmmo !== L.noAmmo) { L.noAmmo = noAmmo; this.ammoPanel.style.display = noAmmo ? 'none' : ''; if (this.bar) this.bar.bolts.style.display = noAmmo ? 'none' : ''; }
    const bolts = s.bolts ?? 0;
    if (!noAmmo && bolts !== L.bolts) {
      L.bolts = bolts;
      this.ammoNum.textContent = String(bolts);
      this.ammoCount.classList.toggle('empty', bolts <= 0);
      this.pips.forEach((p, i) => { p.classList.toggle('off', i >= bolts); });
      this.syncBar('bolts');
    }
    const statusKey = noAmmo ? 'loaded' : bolts <= 0 && !s.loaded ? 'empty' : s.reloading ? 'reloading' : s.loaded ? 'loaded' : 'spent';
    if (statusKey !== L.statusKey) {
      L.statusKey = statusKey;
      this.ammoStatus.className = `ws-game-status ${statusKey === 'empty' ? 'empty' : statusKey === 'reloading' ? 'reloading' : ''}`;
      const bow = label === 'Bolts' || label === 'Pitch bolts' || label === 'Broadheads', arrows = label === 'Arrows'; // the crossbow's kinds (Pine Hollow's loadout), the longbow's quiver
      this.ammoStatusText.textContent = statusKey === 'empty' ? (bow ? 'No bolts' : arrows ? 'No arrows' : reserve > 0 ? 'Empty · R to reload' : 'No rounds') : statusKey === 'reloading' ? (bow ? 'Spanning' : 'Reloading') : statusKey === 'loaded' ? (bow ? 'Loaded' : arrows ? 'Nocked' : 'Ready') : (bow ? 'Spent · R to span' : 'R to reload');
      this.syncBar('status');
    }
    const rp = s.reloading ? (s.reloadProgress ?? 0) : 0;
    if (rp !== L.reloadProgress) { L.reloadProgress = rp; this.reloadBar.style.width = `${rp * 100}%`; }
    // crosshair spread
    const target = (s.ads ? 4 : 7) + (s.speed ?? 0) * 7 + (s.reloading ? 6 : 0);
    if (Math.abs(target - this.spread) > 0.05) { this.spread += (target - this.spread) * 0.2; this.cross.style.setProperty('--gap', `${this.spread.toFixed(1)}px`); }
    if (s.ads !== L.ads) { L.ads = s.ads; this.cross.classList.toggle('ads', s.ads === true); }
    if (s.prompt !== L.prompt) {
      L.prompt = s.prompt;
      if (s.prompt) { this.prompt.innerHTML = s.prompt.replace(/^\[(\w+)\]\s*/, '<b>$1</b>'); this.prompt.classList.add('show'); }
      else this.prompt.classList.remove('show');
    }
    if (this.hitTimer > 0 && (this.hitTimer -= 1) === 0) this.cross.classList.remove('hit', 'head');
  }

  /** touch (E42): heart · 100 · bar · VITALS top-left under PAUSE / the frame meter, and under it (ranged kit) BOLTS · segments · 27 / 30 · bolt.
   *  The base's first two rows of the status column (src/engine/ui/hudSlots.ts; docked whenever the touch layer mounts — never
   *  on a mouse device); the numbers are HUD state, so the HUD owns them. */
  private mountBar(): void {
    const vitals = el('div', 'ws-game-vitals', `<i class="ws-game-glyph">${SVG_HEART}</i><b class="ws-game-num">100</b><span class="ws-game-vbar"><i></i></span><span class="ws-game-tiny">Vitals</span>`);
    const L = this.last, segN = L.segments ?? 4, reserve = L.reserve ?? 0;
    const bolts = el('div', 'ws-game-bolts', `<span class="ws-game-tiny"><span class="ws-game-weapon">${L.weaponName ?? 'Crossbow'}</span><span class="l">${L.ammoLabel ?? 'Bolts'}</span></span><span class="ws-game-segs">${'<i></i>'.repeat(segN)}</span><b class="ws-game-num"><span class="c">30</span><small> / <span class="m">${L.maxBolts ?? this.opts.maxBolts}</span></small><small class="ws-game-reserve">${reserve > 0 ? `+ ${reserve}` : ''}</small></b><i class="ws-game-glyph">${SVG_BOLT}</i>`);
    hudSlots.statusRow(vitals, ROW.vitals, false); hudSlots.statusRow(bolts, ROW.ammo, false);
    if (this.last.noAmmo) bolts.style.display = 'none';
    this.bar = { vitals, hval: q(vitals, '.ws-game-num'), hbar: q(vitals, '.ws-game-vbar i'), bolts, bcount: q(bolts, '.c'), segs: Array.from(bolts.querySelectorAll<HTMLElement>('.ws-game-segs i')), segBox: q(bolts, '.ws-game-segs'), label: q(bolts, '.ws-game-tiny .l'), weapon: q(bolts, '.ws-game-weapon'), max: q(bolts, '.m'), reserve: q(bolts, '.ws-game-reserve') };
    this.syncBar('health'); this.syncBar('bolts'); this.syncBar('status'); this.paintVitals();
  }
  /** E319: the desktop VITALS panel and the touch VITALS strip follow `hpShown` (fading out, then out of the layout) */
  private paintVitals(): void {
    for (const e of [this.healthPanel, this.bar?.vitals]) {
      if (e === undefined) continue;
      e.classList.toggle('hp-fade', this.hpShown !== 'show'); e.classList.toggle('hp-gone', this.hpShown === 'gone');
    }
  }
  /** the touch strip's bars over the magazine: 4 for the crossbow, 6 for the rifle (rebuilt on a weapon change) */
  private buildSegs(n: number): void {
    const b = this.bar; if (!b || b.segs.length === n) return;
    b.segBox.innerHTML = '<i></i>'.repeat(n); b.segs = Array.from(b.segBox.querySelectorAll<HTMLElement>('i'));
    this.syncBar('bolts');
  }

  private syncBar(what: 'health' | 'bolts' | 'status'): void {
    const b = this.bar, L = this.last;
    if (!b) return;
    if (what === 'health') {
      const max = L.maxHealth ?? 100, h = Math.max(0, Math.min(max, L.health ?? max)), pct = (h / max) * 100;
      b.hval.textContent = String(Math.round(h));
      b.hbar.style.width = `${pct}%`;
      b.hbar.classList.toggle('low', pct <= 30);
    } else if (what === 'bolts') {
      const max = L.maxBolts ?? this.opts.maxBolts ?? 30, n = L.bolts ?? max;
      b.bcount.textContent = String(n);
      const lit = n <= 0 ? 0 : Math.max(1, Math.floor((n / max) * b.segs.length + 1e-6));
      b.segs.forEach((seg, i) => { seg.classList.toggle('off', i >= lit); });
    } else {
      b.bolts.classList.toggle('empty', L.statusKey === 'empty');
      b.bolts.classList.toggle('reloading', L.statusKey === 'reloading');
    }
  }

  /** world positions of the live animals — the compass pins a paw at the nearest one within `PAW_RANGE` (empty = no paw) */
  setAnimals(list: { x: number; z: number }[]): void { this.animals = list; }

  /** compass markers: the nearest cabin (house + "CABIN · 180 m") and the nearest animal (paw), each at its bearing on the band */
  private updateMarkers(s: HUDState, heading: number): void {
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
    this.placeMark(this.markHouse, 'house', cabin ? cabin.b - heading : Number.NaN);
    this.placeMark(this.markPaw, 'paw', paw ? paw.b - heading : Number.NaN);
    const range = cabin ? `Cabin · ${Math.round(cabin.d)} m` : '';
    if (range !== this.lastMark.range) { this.lastMark.range = range; this.range.textContent = range; this.range.classList.toggle('show', range !== ''); }
  }

  private placeMark(m: HTMLElement, key: 'house' | 'paw', rel: number): void {
    let px = Number.NaN;
    if (!Number.isNaN(rel)) {
      const r = ((rel + 540) % 360) - 180; // −180..180 around the heading
      if (this.bandW < 0) this.bandW = this.band.clientWidth; // before the observer's first report: measured once, then by fit() (0 while the band is hidden)
      const half = this.bandW / 2 - MARKER_INSET;
      px = Math.round(Math.max(-half, Math.min(half, r * this.ppd)) * 2) / 2;
    }
    if (px === this.lastMark[key] || (Number.isNaN(px) && Number.isNaN(this.lastMark[key]))) return;
    this.lastMark[key] = px;
    if (Number.isNaN(px)) m.classList.remove('show');
    else { m.style.transform = `translateX(${px}px)`; m.classList.add('show'); }
  }

  /** range readout under the crosshair: "BOAR · 15 M" (null hides it) */
  setAimInfo(info: { kind: string; distance: number } | null): void {
    const text = info ? `${info.kind} · ${Math.round(info.distance)} m` : '';
    if (text === this.aimText) return;
    this.aimText = text;
    if (text) { this.aim.textContent = text; this.aim.classList.add('show'); } else this.aim.classList.remove('show');
  }

  showHitMarker(headshot: boolean, killed: boolean): void {
    this.cross.classList.add('hit'); this.cross.classList.toggle('head', headshot);
    this.hitTimer = 10;
    this.hitRing.classList.remove('show'); void this.hitRing.offsetWidth; this.hitRing.classList.add('show');
    if (killed) { this.killX.classList.remove('show'); void this.killX.offsetWidth; this.killX.classList.add('show'); }
  }

  killFeed(text: string): void {
    const item = el('div', 'ws-game-feed-item', text.replaceAll(/\b(headshot|kill|killed)\b/gi, '<b>$1</b>'));
    this.feed.prepend(item);
    while (this.feed.children.length > 4) this.feed.lastElementChild?.remove();
    setTimeout(() => { item.classList.add('out'); setTimeout(() => { item.remove(); }, 500); }, 4200);
  }

  /** one queue (src/engine/ui/ToastStack.ts: ≤ 3 up, the older ones dimmed, stepping down under the elite / boss bars), placed per
   *  A1 (E130): right-aligned under the quest chip */
  toast(text: string): void { this.placeToasts(); this.toasts.push(text); }

  /** A1 (E130): the toasts hang right-aligned under the quest chip (placed by QuestUI under the minimap; hidden, its slot
   *  still is) — on a shard without one, under the minimap. Read at each toast: every layout puts them differently */
  private placeToasts(): void {
    const chip = this.root.querySelector('.ws-quest-obj'), anchor = chip ?? this.root.querySelector('.ws-minimap');
    if (anchor === null) return;
    const r = anchor.getBoundingClientRect(), host = this.root.getBoundingClientRect();
    if (r.height === 0) return;
    this.toastBox.style.setProperty('--ws-toast-top', `${Math.round(r.bottom - host.top + (chip ? 8 : 12))}px`); // the rim's ticks poke 6–8 px out
    this.toastBox.style.setProperty('--ws-toast-right', `${Math.round(host.right - r.right)}px`);
  }


  damageFlash(): void { this.flash.classList.remove('show'); void this.flash.offsetWidth; this.flash.classList.add('show'); }
  /** developer mode only (E140, the user's verdict on dead item 2): players get no edge warning. main.ts calls this every
   *  frame, so the Developer switch shows / hides it live. */
  setBoundaryWarning(visible: boolean): void { this.boundary.classList.toggle('show', visible && isDev()); }

  set menu(m: GameMenu) { this._menu = m; m.keyGate = () => this.entered && !this.holdPause; m.onClose = () => { this.menuClosedAt = performance.now(); this.onResume?.(); tap.resumed?.(); }; m.onExit = () => { if (m.inPractice) this.exitToExplore(); else this.exitToMenu(); }; }
  get menu(): GameMenu { const m = this._menu; if (!m) throw new Error('HUD: no menu attached (hud.menu = …)'); return m; }
  setPaused(paused: boolean): void { if (!this._menu || !this.entered) return; if (paused) this._menu.open('settings'); else this._menu.close(); }
  get paused(): boolean { return this._menu?.isOpen ?? false; }

  /**
   * Title screen: the shard deck IS the menu (src/game/titleDeck.ts — the same deck the cold launch shows, E318). A horizontal
   * carousel of shard cards over the selected card's hero art (the world is paused underneath); ENTER WORLD plays this
   * shard or opens another in a fresh page, EXPLORE WORLD opens the viewer (project/archive/2026-09-23-explore-world.md).
   * `stats` is accepted for API compatibility.
   */
  showIntro(onEnter: () => void, _stats?: IntroStats): void {
    this.onEnter = onEnter;
    this.root.classList.add('intro');
    const active = getActiveChunk().slug;
    const deck = buildTitleDeck({
      cards: titleCards(), active,
      onEnter: (c) => { if (c.slug === active) this.enter(); else requestShard(c.slug, { enter: true }); },
      onExplore: (c) => { if (c.slug !== active) { requestShard(c.slug, { explore: true }); return; } this.leaveForExplore(); },
      onSettings: () => { openBootSettings(); }, // E55: the reload-to-apply picks
    });
    this.root.append(deck.root);
    this.intro = deck.root;
    this.deck = deck;
    deck.start();
  }

  /** EXPLORE WORLD: the title goes away but the play HUD stays hidden (`#hud.intro` is kept) — Explore draws its own overlay */
  private leaveForExplore(): void {
    if (!this.intro) return;
    const intro = this.intro; this.intro = undefined; this.deck?.dispose(); this.deck = undefined;
    intro.classList.add('hide');
    setTimeout(() => { intro.remove(); }, Math.max(700, HERO_FADE_MS * 2));
    this.onExplore?.();
  }

  /** skip the title straight into Explore (`?explore=` deep links) */
  startExplore(): void { this.root.classList.add('intro'); if (this.intro) this.leaveForExplore(); else this.onExplore?.(); }

  private enter(): void {
    if (!this.intro) return;
    const intro = this.intro; this.intro = undefined; this.deck?.dispose(); this.deck = undefined;
    intro.classList.add('hide');
    setTimeout(() => { intro.remove(); }, Math.max(700, HERO_FADE_MS * 2));
    this.root.classList.remove('intro');
    this.entered = true;
    this.onEnter?.();
  }

  /** skip the intro (`?skipintro`, `?tour`, a GPU-recovery reload): straight into the world. `onEnter` is what the title's
   *  ENTER WORLD runs once pause → "Exit to main menu" brings the title back — without it that exit froze the game (E86) */
  /** what ENTER WORLD runs, for a boot that opens on Explore instead of the title (a shard switch into EXPLORE WORLD) */
  setOnEnter(onEnter: () => void): void { this.onEnter = onEnter; }

  markEntered(onEnter?: () => void): void { if (onEnter) this.onEnter = onEnter; this.entered = true; this.root.classList.remove('intro'); }

  /** E155: the deck picked this shard while it was resident: into the world at once, as its own ENTER WORLD would */
  enterNow(): void {
    if (this.intro) {
      // the deck was parked on the card the player left for: its own card back first, so the fade-out shows this shard's art
      const d = this.deck, own = d ? d.cards.findIndex((c) => c.slug === getActiveChunk().slug) : -1;
      if (d && own !== -1 && own !== d.index) d.select(own, false);
      this.enter();
      return;
    }
    if (this.entered) return;
    this.markEntered();
    this.onEnter?.();
  }

  /** Enter the selected shard with its starter weapon in the shared practice room. */
  enterArenaNow(): void {
    this.enterNow();
    if (this.entered) this.onArena?.();
  }

  /** Pause → "Exit to main menu": back to the chunk selection without a reload. The world stays loaded;
   *  `onExitToMenu` is where main.ts stops the loop / mutes audio. The next ENTER WORLD fires `onEnter` again. */
  exitToMenu(): void {
    if (!this.entered || this.intro) return;
    this._menu?.close(true);
    this.entered = false;
    if (document.pointerLockElement) document.exitPointerLock();
    this.onExitToMenu?.(); // main.ts hushes the world's sounds; the title theme plays
    if (this.onEnter) this.showIntro(this.onEnter);
  }

  /** The practice pause menu returns straight to Explore's hub, leaving the play HUD behind. */
  exitToExplore(): void {
    if (!this.entered || this.intro) return;
    this._menu?.close(true);
    this.entered = false;
    this.root.classList.add('intro');
    if (document.pointerLockElement) document.exitPointerLock();
    this.onExitToMenu?.();
    this.onExplore?.();
  }
}
