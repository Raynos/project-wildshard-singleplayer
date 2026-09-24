import './styles/nalati-hud.css';
import type { Weapons } from '../player/Weapons';
import { WEATHER_EVENT, type WeatherHUD } from './HUD';
import { activeClock } from '../world/WorldClock';

/**
 * NalatiHUD — Nalati's phone HUD, layout D "status left" (NALATI-MERGE H2; the user's pick from
 * art/hud/round-12-nalati-merge/board.jpg — D-foot.jpg / D-saddle.jpg; spec docs/design/nalati/merge/review-experience.md
 * §1.3–1.4). It sits on top of main's touch HUD (TouchControls' layer, layout E) and only on Nalati: `#hud.nalati-d` gates
 * every D rule, so Pine Hollow and Driftwood never see any of it.
 *
 *   const nh = new NalatiHUD(weapons);    // nalatiKit.install, after TouchControls
 *   game.onUpdate(() => nh.update());     // cheap: DOM writes only on a change, the stack's layout at ~10 Hz
 *
 * What it owns (the rest of D lives with its element's own module):
 *   - the left status column's ARROWS row (the bow's quiver, whatever is held — JAVELINS while the spear is) and the SKY
 *     row (the day glyph + phase, and the storm's "STORM IN 0:45 · WIND 14 M/S" off the `ws:weather` event; the old storm
 *     chip under the minimap hides). VITALS is HUD.ts's, STEED RideHUD's, HIDDEN stealth.ts's — the column orders them
 *     VITALS · STEED · ARROWS · SKY · HIDDEN (CSS `order`), the GRASS meter and the weapon tabs (WeaponStrip) under it.
 *   - the sun / moon glyph on the minimap's rim (the user's wave-6 pick: no text), from `activeClock()` (WorldClock, F8).
 *   - the ONE under-minimap stack: right-aligned to the minimap, clear of the left column — the quest chip (when a quest
 *     runs), the pinned elite bar or the boss bar, the NAMED ELITE NEARBY banner, LIGHTNING — GET LOW. Each piece keeps
 *     its own markup and stylesheet; this sets its `--nh-top` (and `#hud`'s `--nh-right` / `--nh-w`), and `--nh-free`, the
 *     first free y under both columns, where the toasts and the kill feed go.
 * Desktop keeps its HUD; only the rim glyph shows there.
 */

const SUN = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.4" fill="currentColor"/><path d="M12 2.2v3M12 18.8v3M2.2 12h3M18.8 12h3M5.1 5.1l2.1 2.1M16.8 16.8l2.1 2.1M5.1 18.9l2.1-2.1M16.8 7.2l2.1-2.1" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
const MOON = '<svg viewBox="0 0 24 24"><path d="M15.5 3.2a8.8 8.8 0 1 0 5.3 13.9A7.2 7.2 0 0 1 15.5 3.2z" fill="currentColor"/></svg>';
const STORM = '<svg viewBox="0 0 24 24"><path d="M7 14.5a4.6 4.6 0 0 1-.5-9.2 6 6 0 0 1 11.4 1.8 3.7 3.7 0 0 1-.6 7.4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M13 11 10 15.8h2.8l-1.8 4.8 4.8-6.1H13l1.5-3.5z" fill="currentColor"/></svg>';
const BOW = '<svg viewBox="0 0 24 24"><path d="M6 3c7 3.5 7 14.5 0 18"/><path d="M6 3v18" stroke-width="0.9"/><path d="M4 12h15M16.5 9.5 19 12l-2.5 2.5"/></svg>';
const SPEAR = '<svg viewBox="0 0 24 24"><path d="M4 20 16 8"/><path d="M16 8c.8-2.6 2.6-4.4 5-5-.6 2.4-2.4 4.2-5 5z"/><path d="M13.2 8.6l2.2 2.2"/></svg>';
const PHASE: Record<string, string> = { dawn: 'Dawn', day: 'Day', golden: 'Golden', dusk: 'Dusk', night: 'Night' };
const STACK_GAP = 6, STACK_TOP_GAP = 12, COL_GAP = 10;

const make = (cls: string, html: string): HTMLElement => { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; return d; };
function q(root: HTMLElement, sel: string): HTMLElement {
  const e = root.querySelector<HTMLElement>(sel);
  if (e === null) throw new Error(`NalatiHUD: missing ${sel}`);
  return e;
}

export class NalatiHUD {
  readonly touch: boolean;
  private readonly hud: HTMLElement;
  private readonly arrows: HTMLElement | null = null; private readonly aIcon: HTMLElement | null = null; private readonly aLabel: HTMLElement | null = null;
  private readonly aNum: HTMLElement | null = null; private readonly aMax: HTMLElement | null = null;
  private readonly sky: HTMLElement | null = null; private readonly skyGlyph: HTMLElement | null = null; private readonly skyPhase: HTMLElement | null = null;
  private readonly skyStorm: HTMLElement | null = null; private readonly skyTitle: HTMLElement | null = null; private readonly skySub: HTMLElement | null = null;
  private rim: HTMLElement | null = null;
  private shown = { ammoKey: '', body: '', phase: '', storm: '' };
  private layoutT = 0;
  private readonly stackCache = new Map<HTMLElement, number>();
  private vars = { right: -1, w: -1, free: -1 };

  constructor(private readonly weapons: Weapons) {
    this.hud = document.getElementById('hud') ?? document.body;
    const status = this.hud.classList.contains('touch') ? this.hud.querySelector<HTMLElement>('.ws-touch-status') : null;
    this.touch = status !== null;
    if (status === null) return;
    this.hud.classList.add('nalati-d');
    const arrows = make('ws-nh-row ws-nh-arrows', `<i class="ws-nh-glyph"></i><span class="ws-nh-tiny">Arrows</span><b class="ws-nh-num"><span class="c">0</span><small> / <span class="m">0</span></small></b>`);
    const sky = make('ws-nh-row ws-nh-sky', `<i class="ws-nh-glyph ws-nh-body"></i><span class="ws-nh-tiny ws-nh-phase">Day</span><span class="ws-nh-storm"><i class="ws-nh-glyph">${STORM}</i><span class="ws-nh-st"></span><span class="ws-nh-ss"></span></span>`);
    status.append(arrows, sky);
    this.arrows = arrows; this.aIcon = q(arrows, '.ws-nh-glyph'); this.aLabel = q(arrows, '.ws-nh-tiny'); this.aNum = q(arrows, '.c'); this.aMax = q(arrows, '.m');
    this.sky = sky; this.skyGlyph = q(sky, '.ws-nh-body'); this.skyPhase = q(sky, '.ws-nh-phase');
    this.skyStorm = q(sky, '.ws-nh-storm'); this.skyTitle = q(sky, '.ws-nh-st'); this.skySub = q(sky, '.ws-nh-ss');
    document.addEventListener(WEATHER_EVENT, (e) => { if (e instanceof CustomEvent) this.weather(e.detail as WeatherHUD); });
  }

  /** the storm half of the SKY row (the `ws:weather` chip): "STORM IN 0:45" + "WIND 14 M/S"; null hides it */
  private weather(w: WeatherHUD): void {
    const c = w.chip, key = c === null ? '' : `${c.title}|${c.sub}|${c.tone}`;
    if (key === this.shown.storm || this.skyStorm === null || this.skyTitle === null || this.skySub === null || this.sky === null) return;
    this.shown.storm = key;
    this.sky.classList.toggle('storming', c !== null);
    this.skyStorm.classList.toggle('storm', c?.tone === 'storm');
    this.skyTitle.textContent = c?.title ?? '';
    this.skySub.textContent = (c?.sub ?? '').replace(/(\d) m\/s/i, '$1m/s'); // "WIND 14M/S" (D-foot.jpg): the row is 170 px
  }

  update(): void {
    this.clock();
    if (!this.touch) return;
    this.ammo();
    const now = performance.now();
    if (now - this.layoutT >= 100) { this.layoutT = now; this.layout(); }
  }

  /** the ARROWS row: the bow's quiver (dim while the bow is not in hand); JAVELINS while the spear is held */
  private ammo(): void {
    const w = this.weapons, spear = w.current.id === 'spear';
    let s: { ammo: number | undefined; magazine: number };
    try { s = w.get(spear ? 'spear' : 'bow').state; } catch { return; }
    const key = `${spear ? 's' : 'b'}${String(s.ammo)}/${s.magazine}/${w.current.id === 'bow' ? 1 : 0}`;
    if (key === this.shown.ammoKey || this.arrows === null || this.aIcon === null || this.aLabel === null || this.aNum === null || this.aMax === null) return;
    const kindChanged = !this.shown.ammoKey.startsWith(key.charAt(0));
    this.shown.ammoKey = key;
    if (kindChanged) { this.aIcon.innerHTML = spear ? SPEAR : BOW; this.aLabel.textContent = spear ? 'Javelins' : 'Arrows'; }
    const n = s.ammo ?? 0;
    this.aNum.textContent = String(n); this.aMax.textContent = String(s.magazine);
    this.arrows.classList.toggle('held', spear || w.current.id === 'bow');
    this.arrows.classList.toggle('empty', n <= 0);
  }

  /** the day glyph: the SKY row's (+ the phase word) and the minimap rim's (no text) */
  private clock(): void {
    const c = activeClock();
    if (c === null) return;
    if (this.rim === null) {
      const mini = this.hud.querySelector<HTMLElement>('.ws-minimap');
      if (mini === null) return;
      this.rim = make('ws-nh-clock', '');
      mini.append(this.rim);
    }
    const body = c.body, phase = c.phase;
    if (body !== this.shown.body) {
      this.shown.body = body;
      const svg = body === 'sun' ? SUN : MOON;
      this.rim.innerHTML = svg; this.rim.classList.toggle('moon', body === 'moon');
      if (this.skyGlyph !== null) { this.skyGlyph.innerHTML = svg; this.skyGlyph.classList.toggle('moon', body === 'moon'); }
    }
    if (phase !== this.shown.phase) {
      this.shown.phase = phase;
      this.rim.dataset['phase'] = phase;
      if (this.skyPhase !== null) this.skyPhase.textContent = PHASE[phase] ?? phase;
      if (this.sky !== null) this.sky.dataset['phase'] = phase;
    }
  }

  /** the under-minimap stack + the free line under both columns (toasts, the kill feed) */
  private layout(): void {
    const hud = this.hud, mini = hud.querySelector<HTMLElement>('.ws-minimap'), status = hud.querySelector<HTMLElement>('.ws-touch-status');
    if (mini === null || status === null) return;
    const hr = hud.getBoundingClientRect(), mr = mini.getBoundingClientRect(), sr = status.getBoundingClientRect();
    const right = Math.round(hr.right - mr.right), w = Math.round(mr.right - (sr.right + COL_GAP) - hr.left);
    let y = mr.bottom - hr.top + STACK_TOP_GAP;
    // the stack, top to bottom: quest chip · pinned elite bar | boss bar · the elite banner · GET LOW
    const quest = hud.querySelector<HTMLElement>('.ws-quest-obj.show');
    if (quest !== null) y = Math.max(y, quest.getBoundingClientRect().bottom - hr.top + STACK_GAP); // placed by QuestUI under the minimap
    const pieces: (HTMLElement | null)[] = [
      hud.querySelector<HTMLElement>('.ws-elite-bar.show.pinned'),
      hud.querySelector<HTMLElement>('.ws-boss-bar.show'),
      hud.querySelector<HTMLElement>('.ws-elite-banner.show'),
      hud.querySelector<HTMLElement>('.ws-game-getlow.show'),
    ];
    for (const el of pieces) {
      if (el === null) continue;
      const top = Math.round(y);
      if (this.stackCache.get(el) !== top) { this.stackCache.set(el, top); el.style.setProperty('--nh-top', `${top}px`); }
      y += el.offsetHeight + STACK_GAP;
    }
    const free = Math.round(Math.max(y, sr.bottom - hr.top + COL_GAP));
    if (right !== this.vars.right) { this.vars.right = right; hud.style.setProperty('--nh-right', `${right}px`); }
    if (w !== this.vars.w) { this.vars.w = w; hud.style.setProperty('--nh-w', `${w}px`); }
    if (free !== this.vars.free) { this.vars.free = free; hud.style.setProperty('--nh-free', `${free}px`); }
  }
}
