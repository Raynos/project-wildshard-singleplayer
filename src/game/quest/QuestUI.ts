/**
 * The adventure's own HUD pieces (kept out of HUD.ts, which the HUD agent owns) — DOM in `#hud`, styled by
 * src/ui/styles/quest.css (prefix ws-quest-):
 *
 *   ObjectiveLine — the quest's current objective, right-aligned under the minimap: a kicker (the quest title), the line
 *                   ("Recover the glyph shards · 1 / 3"), a hint, and the nearest marker's name + distance + an arrow
 *                   relative to where you face. Pulses when the objective changes.
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
  private title = el('div', 'ws-quest-obj-title', this.root);
  private line = el('div', 'ws-quest-obj-line', this.root);
  private text = el('b', '', this.line);
  private hint = el('div', 'ws-quest-obj-hint', this.root);
  private nav = el('div', 'ws-quest-obj-nav', this.root);
  private navText = document.createTextNode('');
  private arrow = el('span', '', this.nav);
  private last = '';
  private placeT = 0;
  private toasts: Element | null = null;

  constructor() {
    this.line.prepend(el('i', ''));
    this.nav.prepend(this.navText);
    this.arrow.textContent = '▲';
    hudRoot().append(this.root);
  }

  set(title: string, objective: string, hint: string): void {
    this.title.textContent = title;
    if (objective !== this.last) {
      if (this.last !== '') { this.root.classList.remove('pulse'); void this.root.offsetWidth; this.root.classList.add('pulse'); }
      this.last = objective;
      this.text.textContent = objective;
    }
    this.hint.textContent = hint;
    this.hint.style.display = hint ? '' : 'none';
    this.root.classList.toggle('show', objective !== '');
  }

  /** the nearest marker: label, metres, and its bearing relative to the view (radians, 0 = straight ahead, + = right) */
  setNav(label: string | null, metres: number, rel: number): void {
    if (label === null) { this.nav.style.display = 'none'; return; }
    this.nav.style.display = '';
    this.navText.textContent = `${label} · ${Math.round(metres)} m`;
    this.arrow.style.transform = `rotate(${(rel * 180) / Math.PI}deg)`;
  }

  /** keep it under the minimap (called ~once a second; the minimap's size differs per layout); step aside for toasts */
  update(t: number): void {
    this.toasts ??= document.querySelector('.ws-game-toasts');
    this.root.classList.toggle('dim', this.toasts !== null && this.toasts.childElementCount > 0 && window.innerWidth <= 720);
    if (t - this.placeT < 1) return;
    this.placeT = t;
    const mm = document.querySelector('.ws-minimap');
    const heading = document.querySelector('.ws-minimap-heading');
    const r = (heading ?? mm)?.getBoundingClientRect();
    if (r && r.bottom > 0) this.root.style.top = `${Math.round(r.bottom + 10)}px`;
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
