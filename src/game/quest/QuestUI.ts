/**
 * The adventure's own HUD pieces (kept out of HUD.ts, which the HUD agent owns) — DOM in `#hud`, styled by
 * src/ui/styles/quest.css (prefix ws-quest-):
 *
 *   ObjectiveLine — the quest chip (E51, mockup G art/quest/round-1-compact/G.jpg): ONE slim glass line under the
 *                   minimap, right-aligned to it — ◆ "GLYPH SHARDS 1/3" | "SEA CAVE 230 M" ▲ (the arrow turns with the
 *                   nearest marker's bearing). Pulses cyan when the goal or its count changes. The chapter title, the full
 *                   objective and its sub-steps are on the menu's MAP tab (FullMap.setQuest) and in the step toasts.
 *   DialogueBox   — the NPC dialogue panel: name, a typed-out line, "[E] NEXT"; E / the touch USE / a tap advances,
 *                   a line still typing completes first.
 *   RewardCaption — the big centred caption over the golden-hour reward view.
 */
import '../../ui/styles/quest.css';

const hudRoot = (): HTMLElement => document.getElementById('hud') ?? document.body;
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent?: HTMLElement): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag); e.className = cls; parent?.append(e); return e;
};

export class ObjectiveLine {
  readonly root = el('div', 'ws-quest-obj');
  private goal = el('span', 'ws-quest-obj-goal', this.root);
  private label = el('span', 'ws-quest-obj-label', this.goal);
  private count = el('span', 'ws-quest-obj-count', this.goal);
  private sep = el('span', 'ws-quest-obj-sep', this.root);
  private nav = el('span', 'ws-quest-obj-nav', this.root);
  private navName = el('span', 'ws-quest-obj-name', this.nav);
  private navDist = el('span', 'ws-quest-obj-dist', this.nav);
  private arrow = el('span', 'ws-quest-obj-arrow', this.nav);
  private last = '';
  private lastNav = '';
  private placeT = -Infinity;

  constructor() {
    this.root.prepend(el('i', 'ws-quest-obj-dia'));
    this.arrow.textContent = '▲';
    this.sep.style.display = this.nav.style.display = 'none';
    hudRoot().append(this.root);
  }

  /** the chip's goal: a short label ("Glyph shards") and its counter ("1/3", or '') — pulses cyan when either changes */
  set(label: string, count: string): void {
    const key = `${label}|${count}`;
    if (key === this.last) return;
    if (this.last !== '') { this.root.classList.remove('pulse'); void this.root.offsetWidth; this.root.classList.add('pulse'); }
    this.last = key;
    this.label.textContent = label;
    this.count.textContent = count;
    this.count.style.display = count ? '' : 'none';
    this.root.classList.toggle('show', label !== '');
  }

  /** the nearest marker: short name, metres, and its bearing relative to the view (radians, 0 = straight ahead, + = right) */
  setNav(name: string | null, metres: number, rel: number): void {
    if (name === null) {
      if (this.lastNav !== '') { this.lastNav = ''; this.sep.style.display = this.nav.style.display = 'none'; }
      return;
    }
    if (this.lastNav === '') this.sep.style.display = this.nav.style.display = '';
    if (name !== this.lastNav) { this.lastNav = name; this.navName.textContent = name; }
    const d = `${Math.round(metres)} m`;
    if (this.navDist.textContent !== d) this.navDist.textContent = d;
    this.arrow.style.transform = `rotate(${(rel * 180) / Math.PI}deg)`;
  }

  /** keep it under the minimap, right-aligned to its right edge (called every frame, re-measured ~once a second: the
   *  minimap's size and top differ per layout and the home-screen mode); the toasts stack under it (A1, HUD.toast) */
  update(t: number): void {
    if (t - this.placeT < 1) return;
    this.placeT = t;
    const r = document.querySelector('.ws-minimap')?.getBoundingClientRect();
    if (!r || r.bottom <= 0) return;
    const host = this.root.offsetParent?.getBoundingClientRect() ?? { top: 0, right: window.innerWidth };
    this.root.style.top = `${Math.round(r.bottom - host.top + 12)}px`;   // clear of the rim's ticks (they poke 6–8 px out)
    this.root.style.right = `${Math.round(host.right - r.right)}px`;
  }
}

export class DialogueBox {
  readonly root = el('div', 'ws-quest-talk');
  private name = el('div', 'ws-quest-talk-name', this.root);
  private text = el('div', 'ws-quest-talk-text', this.root);
  private foot = el('div', 'ws-quest-talk-foot', this.root);
  private page = el('span', '', this.foot);
  private next = el('b', '', this.foot);
  private lines: string[] = [];
  private i = 0;
  private shown = 0;
  private open_ = false;
  private onDone: (() => void) | null = null;
  private openT = 0;
  /** chars per second of the type-out */
  cps = 60;

  /** E (desktop) and a tap anywhere on the box (touch) advance it; the game's "[E]" prompt is hidden while it is open */
  constructor() {
    hudRoot().append(this.root);
    this.root.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); this.advance(); });
    document.addEventListener('keydown', (e) => {
      if (e.code !== 'KeyE' || !this.open_ || e.repeat || performance.now() - this.openT < 150) return; // not the press that opened it
      this.advance();
    });
  }

  get isOpen(): boolean { return this.open_; }

  open(name: string, lines: string[], onDone: () => void): void {
    if (lines.length === 0) { onDone(); return; }
    this.name.textContent = name;
    this.lines = lines; this.i = 0; this.shown = 0; this.onDone = onDone; this.open_ = true; this.openT = performance.now();
    this.root.classList.add('show');
    this.render();
  }

  /** E / tap: finish the typing, else the next line, else close */
  advance(): void {
    if (!this.open_) return;
    const cur = this.lines[this.i] ?? '';
    if (this.shown < cur.length) { this.shown = cur.length; this.render(); return; }
    this.i++; this.shown = 0;
    if (this.i >= this.lines.length) { this.close(true); return; }
    this.render();
  }

  close(finished = false): void {
    if (!this.open_) return;
    this.open_ = false;
    this.root.classList.remove('show');
    const done = this.onDone; this.onDone = null;
    if (finished) done?.();
  }

  update(dt: number): void {
    if (!this.open_) return;
    const cur = this.lines[this.i] ?? '';
    if (this.shown >= cur.length) return;
    this.shown = Math.min(cur.length, this.shown + dt * this.cps);
    this.render();
  }

  private render(): void {
    const cur = this.lines[this.i] ?? '';
    this.text.textContent = cur.slice(0, Math.floor(this.shown));
    this.page.textContent = `${this.i + 1} / ${this.lines.length}`;
    const touch = document.getElementById('hud')?.classList.contains('touch') === true;
    this.next.textContent = `${touch ? '' : '[E] '}${this.i + 1 < this.lines.length ? 'NEXT ▸' : 'CLOSE'}`;
  }
}

/** the boss's health across the top of the screen: name, phase pips, a draining bar (the Drowned Captain, A6) */
export class BossBar {
  readonly root = el('div', 'ws-quest-boss');
  private fill: HTMLElement;
  private pips: HTMLElement[] = [];
  private shown = false;
  private lastF = -1;
  private lastP = -1;
  constructor(name = 'The Drowned Captain') {
    const head = el('div', 'ws-quest-boss-head', this.root);
    el('span', 'ws-quest-boss-name', head).textContent = name;
    const pips = el('span', 'ws-quest-boss-pips', head);
    for (let i = 0; i < 3; i++) this.pips.push(el('i', '', pips));
    const track = el('div', 'ws-quest-boss-track', this.root);
    this.fill = el('div', 'ws-quest-boss-fill', track);
    hudRoot().append(this.root);
  }
  /** `f` 0..1 of his health, `phase` 1..3 */
  set(show: boolean, f: number, phase: number): void {
    if (show !== this.shown) { this.shown = show; this.root.classList.toggle('show', show); }
    if (!show) return;
    const q = Math.round(f * 200) / 200;
    if (q !== this.lastF) { this.lastF = q; this.fill.style.transform = `scaleX(${Math.max(0, q)})`; }
    if (phase !== this.lastP) { this.lastP = phase; this.pips.forEach((p, i) => { p.classList.toggle('on', i < phase); }); this.root.classList.toggle('rage', phase >= 3); }
  }
}

export class RewardCaption {
  readonly root = el('div', 'ws-quest-reward');
  constructor(kicker: string, title: string, sub: string) {
    el('div', 'ws-quest-reward-kicker', this.root).textContent = kicker;
    el('div', 'ws-quest-reward-title', this.root).textContent = title;
    el('div', 'ws-quest-reward-sub', this.root).textContent = sub;
    hudRoot().append(this.root);
  }
  show(on: boolean): void { this.root.classList.toggle('show', on); }
}
