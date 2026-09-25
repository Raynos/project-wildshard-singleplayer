import { CHUNK_SIZE } from '../core/config';
import { CHUNKS, getActiveChunk } from '../chunks/registry';
import { requestShard, shardResident } from '../shard/switch';
import { PLACEHOLDERS } from '../chunks/placeholders';
import { CABIN_SITES } from '../world/Heightfield';
import type { GameMenu } from './Menu';
import { openBootSettings } from './BootSettings';
import { isDev } from '../core/devMode';
import { bindDevToggle } from './devSwitch';
import { ToastStack } from './ToastStack';
import { ROW, hudSlots } from './hudSlots';

/**
 * HUD — DOM overlay in `#hud`, styled by `src/ui/styles/game.css` / `menu.css` (the in-game menu is src/ui/Menu.ts + gmenu.css) on top of `base.css` (Wildshard glass identity; one class prefix per screen, see scripts/check-css.mjs).
 *
 *   const hud = new HUD({ pointerLock?: boolean });   // pointerLock:false in ?nolock dev mode (no pause overlay)
 *   hud.showIntro(() => player.lock())                 // title screen: shard deck + ENTER WORLD / EXPLORE WORLD; any key → onEnter
 *   hud.onExplore = () => …  hud.startExplore()        // EXPLORE WORLD (src/explore/Explore.ts); startExplore = a `?explore=` deep link
 *   hud.setState({ bolts?, loaded, reloading, reloadProgress?, health, pos: {x, z}, yaw, kills, prompt?, speed?, ads?,
 *                  maxBolts?, reserve?, ammoLabel?, weaponName?, segments? })
 *     — the ammo strip is generic: `bolts` is the held weapon's ammo (BOLTS 27 / 30 for the crossbow, ROUNDS 27 / 30 + 60
 *       with the "AR-15" tag for the rifle — src/player/Weapons.ts)
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
 * Weather (Nalati, src/nalati/weather.ts): a `ws:weather` document event (`WeatherHUD` detail, `WEATHER_EVENT`) shows the
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
  prompt?: string | undefined; speed?: number | undefined; ads?: boolean | undefined; maxBolts?: number | undefined;
  /** generic ammo strip (Weapons.ts): `reserve` rounds beyond the magazine (hidden when 0), `ammoLabel` "Bolts" / "Rounds",
   *  `weaponName` tag ("CROSSBOW" / "AR-15"), `segments` bars over the magazine on the touch strip (4 crossbow, 6 rifle) */
  reserve?: number | undefined; ammoLabel?: string | undefined; weaponName?: string | undefined; segments?: number | undefined;
  /** nearest animal for the compass paw: `bearing` in compass degrees (0 = north = +Z, 90 = east = −X) — see `bearingTo` */
  nearest?: { bearing: number; distance: number; kind: string } | undefined;
}
export interface HUDOptions { pointerLock?: boolean; maxBolts?: number }
/** the `ws:weather` event's detail — sent on change only (src/nalati/weather.ts) */
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

/** One card in the title-screen deck: an authored chunk (playable) or a teaser (coming soon). */
interface DeckCard {
  slug: string; displayName: string; label: string; thumbnail: string; tag: string; tagTone: 'ok' | 'soon' | '';
  playable: boolean; active: boolean; heroPortrait?: string; heroLandscape?: string; blurb: string; experimental: boolean; earlyAccess: boolean;
  /** ChunkDef.explore: the shard offers EXPLORE WORLD */
  explore: boolean;
}
const HERO_FADE_MS = 350;
const GLYPH_SWORD = '<svg viewBox="0 0 24 24"><path d="M19.5 3.5L9 14l1 1L20.5 4.5z M6.5 12.5l5 5 M8 14l-4.5 4.5 1 1L9 15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/></svg>';
const GLYPH_EYE = '<svg viewBox="0 0 24 24"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';

const CARDINALS: [number, string, boolean][] = [[0, 'N', true], [45, 'NE', false], [90, 'E', true], [135, 'SE', false], [180, 'S', true], [225, 'SW', false], [270, 'W', true], [315, 'NW', false]];
const BAND_DEGREES = 292; // the band spans this much heading (W · N · E all visible, like the K1 mockup); px/deg follows its width
const PAW_RANGE = 120;   // m — the compass only pins an animal this close
const MARKER_INSET = 22; // px — a marker behind the player parks at the band's edge instead of leaving it

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
  private soundOff = false; // the menu's sound toggle; applied via onSoundToggle when toggled (the title music) and on enter
  onSoundToggle?: (on: boolean) => void;
  private opts: HUDOptions;
  entered = false;
  private onEnter?: () => void;
  /** EXPLORE WORLD on the title (main.ts opens src/explore/Explore.ts) */
  onExplore?: () => void;

  private compassStrip!: HTMLElement; private band!: HTMLElement;
  private markHouse!: HTMLElement; private markPaw!: HTMLElement; private range!: HTMLElement;
  private animals: { x: number; z: number }[] = [];
  /** touch layout E (E42): the vitals + bolts strips rendered into TouchControls' top-left status column (`.ws-touch-status`, under PAUSE) */
  private bar?: { hval: HTMLElement; hbar: HTMLElement; bolts: HTMLElement; bcount: HTMLElement; segs: HTMLElement[]; segBox: HTMLElement; label: HTMLElement; weapon: HTMLElement; max: HTMLElement; reserve: HTMLElement };
  private lastMark = { house: Number.NaN, paw: Number.NaN, range: '' };
  private ppd = 1.2; // compass px per degree — measured from the band (`--ppd`), see build()
  /** the band's width, measured when it resizes (build()'s fit): placeMark ran every frame and read clientWidth after the
   *  frame's HUD writes — a forced layout per frame (E142 aggro-perf) */
  private bandW = -1;
  private feed!: HTMLElement; private toasts!: ToastStack; private toastBox!: HTMLElement;
  private healthVal!: HTMLElement; private healthBar!: HTMLElement;
  private ammoCount!: HTMLElement; private ammoNum!: HTMLElement; private ammoStatus!: HTMLElement; private ammoStatusText!: HTMLElement; private reloadBar!: HTMLElement; private pips: HTMLElement[] = [];
  private cross!: HTMLElement; private killX!: HTMLElement; private hitRing!: HTMLElement; private aim!: HTMLElement; private aimText = '';
  private prompt!: HTMLElement; private boundary!: HTMLElement; private flash!: HTMLElement;
  private intro?: HTMLElement | undefined;
  /** the in-game menu (src/ui/Menu.ts) — pause opens it on Settings; its close is our `onResume` */
  private _menu?: GameMenu;
  private deck?: { cards: DeckCard[]; index: number; select: (i: number, smooth?: boolean) => void; activate: () => void } | undefined;
  private last: Partial<HUDState> & { statusKey?: string | undefined; headingDeg?: number | undefined; noAmmo?: boolean | undefined } = {};
  private ammoPanel!: HTMLElement;
  private ammoLabel!: HTMLElement; private ammoMax!: HTMLElement; private ammoReserve!: HTMLElement; private ammoWeapon!: HTMLElement; private pipBox!: HTMLElement;
  private hitTimer = 0; private spread = 7;

  /** the weather chip + GET LOW warning (built on the first `ws:weather` event) */
  private weather?: { chip: HTMLElement; title: HTMLElement; sub: HTMLElement; low: HTMLElement; last: string };

  /** the review composer (src/ui/Feedback.ts) is up: losing the pointer lock does not open the pause menu */
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
      if (deck && !deck.cards[deck.index]?.playable) return;  // "press any key" is inert on a coming-soon shard
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
    this.healthVal = q(health, '.v'); this.healthBar = q(health, '.ws-bar i');
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

    // pause = the in-game menu on its Settings tab (src/ui/Menu.ts, attached by main.ts as `hud.menu`):
    // the touch PAUSE button (TouchControls) and a released pointer lock; Escape (and M / I) is the menu's own key listener,
    // gated by `keyGate` below (E130 — the HUD's Esc here opened the menu the menu's listener then closed, E32)
    document.addEventListener('ws:pause', () => { if (this.entered) this.setPaused(!this.paused); });
    // native shells (src/native/lifecycle.ts): the app went to the background → pause, never unpause;
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
   *  The base's first two rows of the status column (src/ui/hudSlots.ts; docked whenever the touch layer mounts — never
   *  on a mouse device); the numbers are HUD state, so the HUD owns them. */
  private mountBar(): void {
    const vitals = el('div', 'ws-game-vitals', `<i class="ws-game-glyph">${SVG_HEART}</i><b class="ws-game-num">100</b><span class="ws-game-vbar"><i></i></span><span class="ws-game-tiny">Vitals</span>`);
    const L = this.last, segN = L.segments ?? 4, reserve = L.reserve ?? 0;
    const bolts = el('div', 'ws-game-bolts', `<span class="ws-game-tiny"><span class="ws-game-weapon">${L.weaponName ?? 'Crossbow'}</span><span class="l">${L.ammoLabel ?? 'Bolts'}</span></span><span class="ws-game-segs">${'<i></i>'.repeat(segN)}</span><b class="ws-game-num"><span class="c">30</span><small> / <span class="m">${L.maxBolts ?? this.opts.maxBolts}</span></small><small class="ws-game-reserve">${reserve > 0 ? `+ ${reserve}` : ''}</small></b><i class="ws-game-glyph">${SVG_BOLT}</i>`);
    hudSlots.statusRow(vitals, ROW.vitals, false); hudSlots.statusRow(bolts, ROW.ammo, false);
    if (this.last.noAmmo) bolts.style.display = 'none';
    this.bar = { hval: q(vitals, '.ws-game-num'), hbar: q(vitals, '.ws-game-vbar i'), bolts, bcount: q(bolts, '.c'), segs: Array.from(bolts.querySelectorAll<HTMLElement>('.ws-game-segs i')), segBox: q(bolts, '.ws-game-segs'), label: q(bolts, '.ws-game-tiny .l'), weapon: q(bolts, '.ws-game-weapon'), max: q(bolts, '.m'), reserve: q(bolts, '.ws-game-reserve') };
    this.syncBar('health'); this.syncBar('bolts'); this.syncBar('status');
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
      const h = Math.max(0, Math.min(100, L.health ?? 100));
      b.hval.textContent = String(Math.round(h));
      b.hbar.style.width = `${h}%`;
      b.hbar.classList.toggle('low', h <= 30);
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

  /** one queue (src/ui/ToastStack.ts: ≤ 3 up, the older ones dimmed, stepping down under the elite / boss bars), placed per
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

  set menu(m: GameMenu) { this._menu = m; m.keyGate = () => this.entered && !this.holdPause; m.onClose = () => { this.menuClosedAt = performance.now(); this.onResume?.(); }; m.onExit = () => { this.exitToMenu(); }; }
  get menu(): GameMenu { const m = this._menu; if (!m) throw new Error('HUD: no menu attached (hud.menu = …)'); return m; }
  setPaused(paused: boolean): void { if (!this._menu || !this.entered) return; if (paused) this._menu.open('settings'); else this._menu.close(); }
  get paused(): boolean { return this._menu?.isOpen ?? false; }

  /**
   * Title screen: the shard deck IS the menu. A horizontal snap carousel of shard cards over the live world (the
   * neighbours peek in from the edges, dots below — a swipe steps the shard); the centred card is the selection. Under it
   * two compact buttons: ENTER WORLD (play; the active shard enters, another is switched to in the page — src/shard/ShardHost.ts, E155) and EXPLORE WORLD
   * (the viewer, project/archive/2026-09-23-explore-world.md; the shards whose ChunkDef.explore is on — D4, E66). Teasers from `PLACEHOLDERS` crossfade their hero art in
   * behind the deck and turn ENTER WORLD into COMING SOON. `stats` is accepted for API compatibility. (The user,
   * 2026-09-23, on the p12 split panels: "way too big … it does not make it obvious you can swipe" — back to the deck.)
   */
  showIntro(onEnter: () => void, _stats?: IntroStats): void {
    this.onEnter = onEnter;
    this.root.classList.add('intro');
    const def = getActiveChunk();
    const cards: DeckCard[] = [
      ...CHUNKS.map((c): DeckCard => ({
        slug: c.slug, displayName: c.displayName, thumbnail: c.thumbnail, blurb: c.blurb,
        label: `${c.biome} · ${c.gridCoords} · ${CHUNK_SIZE} m shard`,
        tag: c === def ? 'Loaded' : 'Load', tagTone: c === def ? 'ok' : '', playable: true, active: c === def, experimental: c.experimental === true, earlyAccess: c.earlyAccess === true, explore: c.explore === true,
        heroPortrait: c.heroPortrait, heroLandscape: c.heroLandscape,
      })),
      ...PLACEHOLDERS.map((t): DeckCard => ({
        slug: t.slug, displayName: t.displayName, thumbnail: t.thumbnail, blurb: t.blurb,
        label: `${t.biome} · ${t.gridCoords}`, tag: 'Coming soon', tagTone: 'soon', playable: false, active: false, experimental: false, earlyAccess: false, explore: false,
        heroPortrait: t.heroPortrait, heroLandscape: t.heroLandscape,
      })),
    ];
    const intro = el('div', 'ws-menu');
    intro.innerHTML = `
      <div class="ws-menu-hero"></div>
      <div class="ws-menu-head"><div class="ws-wordmark">Project <b>Wildshard</b></div>
        <button class="ws-menu-mode ws-menu-explore" type="button"><span class="ws-menu-mode-glyph">${GLYPH_EYE}</span><span class="ws-menu-explore-text"><b>Explore world</b><small>Fly · inspect</small></span></button></div>
      <div class="ws-menu-deck">
        <div class="ws-menu-cards"><div class="ws-menu-deck-track">${cards.map((c, i) => `
          <button class="ws-menu-card${c.active ? ' active' : ''}${c.playable ? '' : ' soon'}" type="button" data-i="${i}" title="${c.blurb.replaceAll('"', '&quot;')}">
            <span class="ws-menu-card-img" style="background-image:url('${c.thumbnail}')"><i class="ws-menu-card-tag ${c.tagTone}">${c.tag}</i>${c.earlyAccess ? '<i class="ws-menu-card-exp ws-menu-card-ea">Early access</i>' : c.experimental ? '<i class="ws-menu-card-exp">Experimental</i>' : ''}</span>
            <b>${c.displayName}</b><small>${c.label}</small>
          </button>`).join('')}
        </div></div>
        <div class="ws-menu-dots">${cards.map((_, i) => `<i data-i="${i}"></i>`).join('')}</div>
        <div class="ws-menu-modes">
          <button class="ws-menu-mode ws-menu-play" type="button"><span class="ws-menu-mode-glyph">${GLYPH_SWORD}</span><b>Enter world</b><small></small></button>
        </div>
        <div class="ws-menu-row"><button class="ws-menu-settings" type="button">Settings</button><div class="ws-menu-sound">Sound on</div><button class="ws-menu-sound ws-menu-dev" type="button">Dev</button></div>
      </div>`;
    const hero = q(intro, '.ws-menu-hero');
    const list = q(intro, '.ws-menu-cards');
    const cardEls = Array.from(list.querySelectorAll<HTMLElement>('.ws-menu-card'));
    const dots = Array.from(intro.querySelectorAll<HTMLElement>('.ws-menu-dots i'));
    const enterBtn = intro.querySelector<HTMLButtonElement>('.ws-menu-play');
    if (!enterBtn) throw new Error('HUD: no .ws-menu-play');
    const enterTitle = q(enterBtn, 'b'), enterHint = q(enterBtn, 'small');
    const exploreBtn = q(intro, '.ws-menu-explore');

    const portrait = (): boolean => innerWidth < innerHeight;
    const heroUrl = (c: DeckCard): string => (portrait() ? c.heroPortrait : c.heroLandscape) ?? '';
    let index = Math.max(0, cards.findIndex((c) => c.active));
    // paginated track: one card per swipe, always centred — no native scroll, so it can't rest between cards
    const track = q(list, '.ws-menu-deck-track');
    const offsetOf = (i: number): number => { const ce = cardEls[i]; return ce ? list.clientWidth / 2 - (ce.offsetLeft + ce.offsetWidth / 2) : 0; };
    const place = (i: number, extra = 0, animate = true): void => {
      track.style.transition = animate ? 'transform 0.32s cubic-bezier(0.2, 0.8, 0.2, 1)' : 'none';
      track.style.transform = `translateX(${offsetOf(i) + extra}px)`;
    };

    const apply = (): void => {
      const c = cards[index];
      if (!c) return;
      cardEls.forEach((e, i) => { e.classList.toggle('selected', i === index); });
      dots.forEach((d, i) => { d.classList.toggle('on', i === index); });
      // every card has hero art — the menu never shows the live world (it is paused underneath)
      const url = heroUrl(c);
      if (url) { hero.style.backgroundImage = `url('${url}')`; hero.classList.add('show'); }
      else hero.classList.remove('show');
      enterBtn.classList.toggle('soon', !c.playable);
      enterBtn.disabled = !c.playable;
      enterTitle.textContent = c.playable ? 'Enter world' : 'Coming soon';
      // another shard: in memory it is instant, else it loads here, in the page (E155 — it used to reload with ?chunk=)
      enterHint.textContent = !c.playable ? 'Not yet playable' : c.earlyAccess ? 'Early access' : c.experimental ? 'Experimental · rough edges' : c.active ? 'Play' : shardResident(c.slug) ? `Switch to ${c.displayName}` : `Loads ${c.displayName}`;
      exploreBtn.classList.toggle('off', !c.explore); // the shard's ChunkDef.explore (Driftwood + Pine Hollow — project/archive/2026-09-23-explore-world.md D4, E66)
    };
    const select = (raw: number, smooth = true): void => {
      const i = Math.max(0, Math.min(cards.length - 1, raw));
      place(i, 0, smooth);
      if (i !== index) { index = i; apply(); }
    };
    const activate = (): void => {
      const c = cards[index];
      if (!c || !c.playable) return;
      if (c.active) this.enter(); else requestShard(c.slug, { enter: true }); // another shard: switched to in the page (src/shard/ShardHost.ts)
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
    let swipedAt = 0; // a swipe's trailing click must not re-select the card under the finger
    const endDrag = (e: PointerEvent): void => {
      if (!drag || e.pointerId !== drag.id) return;
      const { dx, t0 } = drag; drag = null;
      const v = dx / Math.max(1, performance.now() - t0); // px/ms
      if (Math.abs(dx) > 36 || (Math.abs(v) > 0.35 && Math.abs(dx) > 14)) { swipedAt = performance.now(); select(index + (dx < 0 ? 1 : -1)); }
      else place(index);
    };
    list.addEventListener('pointerup', endDrag); list.addEventListener('pointercancel', endDrag);
    cardEls.forEach((e, i) => { e.addEventListener('click', (ev) => { ev.stopPropagation(); if (i !== index && performance.now() - swipedAt > 400) select(i); }); });
    dots.forEach((d, i) => { d.addEventListener('click', (ev) => { ev.stopPropagation(); select(i); }); });
    enterBtn.addEventListener('click', (ev) => { ev.stopPropagation(); activate(); });
    exploreBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const c = cards[index];
      if (c?.explore !== true) return;
      if (!c.active) { requestShard(c.slug, { explore: true }); return; }
      this.leaveForExplore();
    });
    q(intro, '.ws-menu-settings').addEventListener('click', (e) => { e.stopPropagation(); openBootSettings(); }); // E55: the reload-to-apply picks
    bindDevToggle(q(intro, '.ws-menu-dev')); // E140: developer mode without opening Settings
    const soundBtn = q(intro, 'div.ws-menu-sound');
    if (this.soundOff) { soundBtn.classList.add('off'); soundBtn.textContent = 'Sound off'; }
    soundBtn.addEventListener('click', (e) => { e.stopPropagation(); this.soundOff = soundBtn.classList.toggle('off'); soundBtn.textContent = this.soundOff ? 'Sound off' : 'Sound on'; this.onSoundToggle?.(!this.soundOff); });
    // orientation flips swap the hero file and re-centre the selected card (card width is viewport-relative)
    let wasPortrait = portrait();
    const onResize = (): void => {
      if (!this.intro) { removeEventListener('resize', onResize); return; }
      place(index, 0, false);
      if (portrait() !== wasPortrait) { wasPortrait = portrait(); apply(); }
    };
    addEventListener('resize', onResize);
    // iOS (E131): a rotation can fire `resize` before the new layout settles (or while the rotate gate hides the menu, all
    // widths 0), and it may leave the strip natively scrolled — so re-centre whenever the strip's own box really changes
    const strip = new ResizeObserver(() => {
      if (!this.intro) { strip.disconnect(); return; }
      list.scrollLeft = 0;
      if (!drag) place(index, 0, false);
    });
    strip.observe(list);
    // hero art is ~0.2–0.3 MB a file and every card has two (portrait + landscape): only the selected card's, in the
    // orientation on screen, loads with the menu (apply() above). A neighbour's loads when a swipe or a card tap starts
    // toward it, so the crossfade on release is usually instant; the other orientation only on a real flip (onResize →
    // apply()). Preloading all six up front was 1.7 MB of every cold launch (LOAD-PERF, first-launch transfer).
    const warmed = new Set<string>();
    const warm = (i: number): void => { const c = cards[i]; const u = c ? heroUrl(c) : ''; if (u && !warmed.has(u)) { warmed.add(u); new Image().src = u; } };
    const warmNeighbours = (): void => { warm(index - 1); warm(index + 1); };
    list.addEventListener('pointerdown', warmNeighbours);
    dots.forEach((d, i) => { d.addEventListener('pointerdown', () => { warm(i); }); });

    this.root.append(intro);
    this.intro = intro;
    this.deck = { cards, get index() { return index; }, select, activate };
    apply();
    requestAnimationFrame(() => { place(index, 0, false); }); // after layout: offsets need the intro in the DOM
  }

  /** EXPLORE WORLD: the title goes away but the play HUD stays hidden (`#hud.intro` is kept) — Explore draws its own overlay */
  private leaveForExplore(): void {
    if (!this.intro) return;
    const intro = this.intro; this.intro = undefined; this.deck = undefined;
    intro.classList.add('hide');
    setTimeout(() => { intro.remove(); }, Math.max(700, HERO_FADE_MS * 2));
    this.onSoundToggle?.(!this.soundOff);
    this.onExplore?.();
  }

  /** skip the title straight into Explore (`?explore=` deep links) */
  startExplore(): void { this.root.classList.add('intro'); if (this.intro) this.leaveForExplore(); else this.onExplore?.(); }

  private enter(): void {
    if (!this.intro) return;
    const intro = this.intro; this.intro = undefined; this.deck = undefined;
    intro.classList.add('hide');
    setTimeout(() => { intro.remove(); }, Math.max(700, HERO_FADE_MS * 2));
    this.root.classList.remove('intro');
    this.entered = true;
    this.onSoundToggle?.(!this.soundOff); // the player's choice (main.ts hushes the world under the menu; the title music plays)
    this.onEnter?.();
  }

  /** skip the intro (`?skipintro`, `?tour`, a GPU-recovery reload): straight into the world. `onEnter` is what the title's
   *  ENTER WORLD runs once pause → "Exit to main menu" brings the title back — without it that exit froze the game (E86) */
  markEntered(onEnter?: () => void): void { if (onEnter) this.onEnter = onEnter; this.entered = true; this.root.classList.remove('intro'); }

  /** E155: the deck picked this shard while it was resident: into the world at once, as its own ENTER WORLD would */
  enterNow(): void {
    if (this.intro) { this.enter(); return; }
    if (this.entered) return;
    this.markEntered();
    this.onSoundToggle?.(!this.soundOff);
    this.onEnter?.();
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
}

