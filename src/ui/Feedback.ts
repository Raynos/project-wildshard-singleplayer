/**
 * The review inbox's composer (project/archive/2026-09-22-feedback-inbox.md, mockups art/feedback/round-1-inbox/) — loaded lazily on the first
 * F8 / ✎ / FEEDBACK tab, so the boot bundle never carries it. Styled by src/ui/styles/feedback.css (prefix ws-fb-).
 *
 *   const fb = new Feedback(host);
 *   await fb.openQuick()        // desktop F8: the frame is captured + frozen, a one-line bar under the crosshair; Tab → the sheet
 *   await fb.openSheet()        // the full sheet: right-docked on desktop, a bottom sheet on touch (the ✎ disc)
 *   await fb.mountTab(panel)    // the MENU's FEEDBACK tab: the same composer inside the panel (the world keeps running)
 *
 * A note = the words + a category chip + a JPEG of the frame (freehand pen strokes baked in) + the repro context
 * (host.context() + build / viewport / tier / the `?at=` URL that puts you back on the spot). Sending goes through
 * src/ui/review.ts (offline queue there). Keys typed into the composer never reach the game: the root stops them.
 */
import { CATEGORIES, queuedCount, sendNote, type Category, type ContextValue } from './review';

declare const __BUILD_ID__: string; // vite.config.ts define

export interface FeedbackHost {
  /** a copy of the next rendered frame (Game.captureFrame) */
  capture: () => Promise<HTMLCanvasElement>;
  /** where the player is and what they hold — main.ts */
  context: () => Record<string, ContextValue>;
  /** freeze the world + input under an overlay composer and release it (the menu tab does not use it) */
  hold: (on: boolean) => void;
  toast: (text: string) => void;
  /** the touch layer is up (#hud.touch): bottom sheet, no quick bar */
  touch: () => boolean;
}

type Mode = 'bar' | 'sheet' | 'tab';
interface Stroke { pts: number[] } // normalised x, y pairs (0..1 of the frame)

export const SHOT_MAX_W = 1280;
export const SHOT_MAX_BYTES = 300 * 1024;
const PEN_PX = 4; // stroke width at 1280 px wide
const LABEL: Record<Category, string> = { bug: 'Bug', art: 'Art', feel: 'Feel', perf: 'Perf', idea: 'Idea' };

const el = (cls: string, html = '', tag = 'div'): HTMLElement => { const e = document.createElement(tag); e.className = cls; if (html) e.innerHTML = html; return e; };
const button = (cls: string, html: string): HTMLButtonElement => { const b = document.createElement('button'); b.type = 'button'; b.className = cls; b.innerHTML = html; return b; };
const esc = (s: string): string => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;');

/** compass heading as the HUD shows it: +Z is north, `180 − yaw°` (src/ui/HUD.ts) */
export function headingDeg(yaw: number): number { const d = 180 - (yaw * 180) / Math.PI; return Math.round(((d % 360) + 360) % 360) % 360; }

/** the URL that reloads the game on this spot: `?chunk=&at=x,y,z,yaw,pitch&weapon=&skipintro` (main.ts reads `at`) */
export function reproUrl(origin: string, c: Record<string, ContextValue>): string {
  const q = new URLSearchParams();
  if (typeof c['shard'] === 'string') q.set('chunk', c['shard']);
  const pos = c['pos'], yaw = c['yaw'], pitch = c['pitch'];
  if (Array.isArray(pos) && typeof yaw === 'number' && typeof pitch === 'number') q.set('at', [...pos, yaw, pitch].map((v) => Number(v.toFixed(2))).join(','));
  if (typeof c['weapon'] === 'string') q.set('weapon', c['weapon']);
  q.set('skipintro', '');
  return `${origin}/?${q.toString().replace('skipintro=', 'skipintro')}`;
}

/** the frame with the pen strokes drawn on it, as a JPEG data URL under SHOT_MAX_BYTES (quality steps down until it fits) */
export function bake(shot: HTMLCanvasElement, strokes: readonly Stroke[]): string {
  const c = document.createElement('canvas'); c.width = shot.width; c.height = shot.height;
  const g = c.getContext('2d');
  if (!g) return '';
  g.drawImage(shot, 0, 0);
  g.strokeStyle = '#8fe3ff'; g.lineWidth = Math.max(2, (PEN_PX * c.width) / SHOT_MAX_W); g.lineCap = 'round'; g.lineJoin = 'round';
  g.shadowColor = 'rgba(0, 0, 0, 0.6)'; g.shadowBlur = 3;
  for (const s of strokes) {
    g.beginPath();
    for (let i = 0; i + 1 < s.pts.length; i += 2) {
      const x = (s.pts[i] ?? 0) * c.width, y = (s.pts[i + 1] ?? 0) * c.height;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
  }
  for (const q of [0.7, 0.55, 0.4]) {
    const url = c.toDataURL('image/jpeg', q);
    if (url.length * 0.75 <= SHOT_MAX_BYTES) return url;
  }
  return c.toDataURL('image/jpeg', 0.3);
}

export class Feedback {
  private root: HTMLElement | null = null;
  private mode: Mode | null = null;
  private shot: HTMLCanvasElement | null = null;
  private strokes: Stroke[] = [];
  private category: Category = 'bug';
  private text = '';
  private ctx: Record<string, ContextValue> = {};
  private sending = false;
  private held = false;

  constructor(private host: FeedbackHost) {}

  get isOpen(): boolean { return this.mode === 'bar' || this.mode === 'sheet'; }

  /** F8: the quick bar (touch goes straight to the sheet) */
  async openQuick(): Promise<void> {
    if (this.host.touch()) { await this.openSheet(); return; }
    if (this.isOpen) return;
    await this.begin();
    this.render('bar');
  }

  /** the ✎ disc / Tab from the bar: the full sheet */
  async openSheet(): Promise<void> {
    if (this.mode === 'sheet') return;
    if (!this.isOpen) await this.begin();
    this.render('sheet');
  }

  /** the MENU's FEEDBACK tab: re-capture the frame (the world runs under the menu) and draw the composer into the panel */
  async mountTab(panel: HTMLElement): Promise<void> {
    if (this.isOpen) this.close();
    this.shot = await this.host.capture();
    this.ctx = this.host.context();
    this.strokes = [];
    this.render('tab', panel);
  }

  close(): void {
    const wasOverlay = this.isOpen;
    this.root?.remove();
    this.root = null; this.mode = null;
    if (wasOverlay && this.held) { this.held = false; this.host.hold(false); }
  }

  private async begin(): Promise<void> {
    this.shot = await this.host.capture(); // the frame as it was when you pressed — then the world stops
    this.ctx = this.host.context();
    this.strokes = [];
    this.held = true;
    this.host.hold(true);
  }

  // ── rendering ──
  private render(mode: Mode, panel?: HTMLElement): void {
    this.root?.remove();
    this.mode = mode;
    const root = mode === 'tab' ? el('ws-fb-tab') : el(`ws-fb ${mode}${this.host.touch() ? ' phone' : ''}`);
    this.root = root;
    // the composer owns the keyboard: nothing typed here reaches Player / Weapons / HUD (they listen on document)
    // (in the menu tab Esc still goes through, so it closes the menu as everywhere else)
    for (const t of ['keydown', 'keyup'] as const) root.addEventListener(t, (e) => { if (mode === 'tab' && e.code === 'Escape') return; e.stopPropagation(); if (t === 'keydown') this.onKey(e); });
    if (mode === 'bar') this.buildBar(root);
    else this.buildSheet(root, mode);
    if (panel) panel.replaceChildren(root); else document.body.append(root);
    const field = root.querySelector<HTMLInputElement | HTMLTextAreaElement>('.ws-fb-input, .ws-fb-text');
    if (field && mode !== 'tab') { field.focus(); field.setSelectionRange(field.value.length, field.value.length); }
  }

  private onKey(e: KeyboardEvent): void {
    if (this.mode === 'tab') return; // the menu owns Esc there
    if (e.code === 'Escape') { e.preventDefault(); this.close(); return; }
    if (e.code === 'Tab' && this.mode === 'bar') { e.preventDefault(); void this.openSheet(); return; }
    if (e.code === 'Enter' && !e.shiftKey) { e.preventDefault(); void this.send(); }
  }

  private chips(): HTMLElement {
    const box = el('ws-fb-chips');
    for (const c of CATEGORIES) {
      const b = button(`ws-fb-chip${c === this.category ? ' on' : ''}`, LABEL[c]);
      b.addEventListener('click', () => { this.category = c; for (const x of box.children) x.classList.toggle('on', x === b); });
      box.append(b);
    }
    return box;
  }

  private buildBar(root: HTMLElement): void {
    root.append(el('ws-fb-dim'));
    const wrap = el('ws-fb-quick');
    wrap.append(el('ws-fb-cap', 'Quick note · F8 · Tab for more'));
    const bar = el('ws-fb-bar');
    bar.append(el('ws-fb-cam', '<svg viewBox="0 0 24 24"><path d="M4 7h3l2-2.5h6L17 7h3v12H4z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="12" cy="13" r="3.6" fill="none" stroke="currentColor" stroke-width="1.6"/></svg><span>Frame captured</span>'));
    const input = document.createElement('input'); input.className = 'ws-fb-input'; input.type = 'text'; input.maxLength = 4000;
    input.placeholder = 'What looks wrong or feels off?'; input.value = this.text; input.enterKeyHint = 'send';
    input.addEventListener('input', () => { this.text = input.value; });
    bar.append(input, this.chips(), el('ws-fb-keys', '⏎ Send · Esc'));
    wrap.append(bar);
    root.append(wrap);
  }

  private buildSheet(root: HTMLElement, mode: Mode): void {
    if (mode === 'sheet') {
      const dim = el('ws-fb-dim');
      dim.addEventListener('pointerdown', () => this.close());
      root.append(dim);
    }
    const sheet = el(mode === 'tab' ? 'ws-fb-body' : 'ws-fb-sheet ws-glass');
    if (mode === 'sheet') {
      const head = el('ws-fb-head', '<div class="ws-fb-title">Feedback <b>· Note</b></div>');
      if (!this.host.touch()) head.append(el('ws-fb-key', 'F8'));
      const x = button('ws-fb-close', '×'); x.setAttribute('aria-label', 'Close'); x.addEventListener('click', () => this.close());
      head.append(x);
      sheet.append(head);
    }
    // the frame + the pen
    const shotBox = el('ws-fb-shot');
    const img = document.createElement('img'); img.alt = 'Screenshot of the frame';
    if (this.shot) img.src = bake(this.shot, this.strokes);
    const draw = button('ws-fb-draw', '<svg viewBox="0 0 24 24"><path d="M4 20l1-4L16 5l3 3L8 19z M14 7l3 3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>Draw');
    draw.addEventListener('click', () => this.openPen(img));
    shotBox.append(img, draw);
    const kb = this.shot ? Math.round((bake(this.shot, this.strokes).length * 0.75) / 1024) : 0;
    sheet.append(shotBox, el('ws-fb-meta', this.shot ? `Screenshot · ${this.shot.width}×${this.shot.height} · ${kb} KB · tap Draw to mark it` : 'No screenshot'));
    sheet.append(this.chips());
    const text = document.createElement('textarea'); text.className = 'ws-fb-text'; text.rows = mode === 'tab' ? 4 : 3; text.maxLength = 4000;
    text.placeholder = 'What looks wrong or feels off? Enter sends, Shift+Enter is a new line.'; text.value = this.text;
    text.addEventListener('input', () => { this.text = text.value; });
    if (mode === 'tab') text.addEventListener('keydown', (e) => { if (e.code === 'Enter' && !e.shiftKey) { e.preventDefault(); void this.send(); } });
    sheet.append(text);
    const c = this.ctx, pos = c['pos'];
    const kv: [string, string][] = [
      ['Shard', String(c['shard'] ?? '—')],
      ['Pos', Array.isArray(pos) ? `${Math.round(pos[0] ?? 0)} · ${Math.round(pos[2] ?? 0)}` : '—'],
      ['Heading', typeof c['yaw'] === 'number' ? `${headingDeg(c['yaw'])}°` : '—'],
      ['Weapon', String(c['weapon'] ?? '—')],
      ['Tier', String(c['tier'] ?? '—')],
      ['FPS', String(c['fps'] ?? '—')],
      ['Build', buildId().slice(0, 7) || 'dev'],
    ];
    sheet.append(el('ws-fb-ctx', kv.map(([k, v]) => `<span class="ws-fb-kv"><i>${k}</i>${esc(v)}</span>`).join('')));
    const send = button('ws-fb-send', 'Send note ⏎');
    send.addEventListener('click', () => { void this.send(); });
    sheet.append(send);
    const q = queuedCount();
    const queued = q > 0 ? `<b class="ws-fb-queued">${q} queued · sends when online</b>` : '';
    if (mode === 'sheet') sheet.append(el('ws-fb-hint', `${this.host.touch() ? 'Tap outside' : 'Esc'} to resume · notes queue offline${queued ? ` · ${queued}` : ''}`));
    else if (queued) sheet.append(el('ws-fb-hint', queued)); // the menu's own hint line explains the tab
    root.append(sheet);
  }

  // ── the pen: full-screen over the frozen frame; strokes are kept normalised and baked at send ──
  private openPen(thumb: HTMLImageElement): void {
    const shot = this.shot;
    if (!shot) return;
    const pen = el('ws-fb-pen');
    const cv = document.createElement('canvas'); cv.className = 'ws-fb-pencanvas';
    const tools = el('ws-fb-tools');
    const tool = (label: string, fn: () => void, cls = ''): HTMLButtonElement => { const b = button(`ws-fb-tool${cls}`, label); b.addEventListener('click', fn); tools.append(b); return b; };
    pen.append(cv, tools, el('ws-fb-penhint', 'Draw on the frame · what you mark is sent with the note'));
    const fit = (): { w: number; h: number } => {
      const k = Math.min(innerWidth / shot.width, innerHeight / shot.height);
      const w = Math.round(shot.width * k), h = Math.round(shot.height * k), dpr = Math.min(2, devicePixelRatio || 1);
      cv.style.width = `${w}px`; cv.style.height = `${h}px`; cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      return { w, h };
    };
    const paint = (): void => {
      const g = cv.getContext('2d');
      if (!g) return;
      g.drawImage(shot, 0, 0, cv.width, cv.height);
      g.strokeStyle = '#8fe3ff'; g.lineWidth = Math.max(2, (PEN_PX * cv.width) / SHOT_MAX_W); g.lineCap = 'round'; g.lineJoin = 'round';
      for (const s of this.strokes) {
        g.beginPath();
        for (let i = 0; i + 1 < s.pts.length; i += 2) { const x = (s.pts[i] ?? 0) * cv.width, y = (s.pts[i + 1] ?? 0) * cv.height; if (i === 0) g.moveTo(x, y); else g.lineTo(x, y); }
        g.stroke();
      }
    };
    fit(); paint();
    let live: Stroke | null = null;
    const at = (e: PointerEvent): [number, number] => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; };
    cv.addEventListener('pointerdown', (e) => { e.preventDefault(); cv.setPointerCapture(e.pointerId); live = { pts: at(e) }; this.strokes.push(live); paint(); });
    cv.addEventListener('pointermove', (e) => { if (!live) return; live.pts.push(...at(e)); paint(); });
    const end = (): void => { live = null; };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
    const onResize = (): void => { fit(); paint(); };
    const done = (): void => { removeEventListener('resize', onResize); pen.remove(); thumb.src = bake(shot, this.strokes); };
    addEventListener('resize', onResize);
    tool('Pen', () => undefined, ' on');
    tool('Undo', () => { this.strokes.pop(); paint(); });
    tool('Clear', () => { this.strokes = []; paint(); });
    tool('Done', done, ' done');
    // on <body>, not inside the composer: the menu's backdrop-filter would make a fixed child fixed to the menu sheet
    for (const t of ['keydown', 'keyup'] as const) pen.addEventListener(t, (e) => { e.stopPropagation(); if (t === 'keydown' && e.code === 'Escape') done(); });
    pen.tabIndex = -1;
    document.body.append(pen);
    pen.focus();
  }

  // ── sending ──
  private async send(): Promise<void> {
    const note = this.text.trim();
    if (this.sending) return;
    if (!note) { this.host.toast('Write a few words first'); this.root?.querySelector<HTMLElement>('.ws-fb-input, .ws-fb-text')?.focus(); return; }
    this.sending = true;
    this.root?.classList.add('sending');
    const context: Record<string, ContextValue> = {
      ...this.ctx,
      build: buildId(),
      dpr: devicePixelRatio,
      viewport: `${innerWidth}×${innerHeight}`,
      canvas: this.shot ? `${this.shot.width}×${this.shot.height}` : '',
      ua: navigator.userAgent,
      url: location.href,
      at: new Date().toISOString(),
      repro: reproUrl(location.origin, this.ctx),
    };
    const screenshot = this.shot ? bake(this.shot, this.strokes) : null;
    const r = await sendNote({ note, category: this.category, context, screenshot });
    this.sending = false;
    this.root?.classList.remove('sending');
    if (r === 'locked') { this.host.toast('Review password no longer works — unlock again in Settings'); return; }
    this.host.toast(r === 'queued' ? 'Offline · note queued' : `Note sent · ${r.id.slice(-4)}`);
    this.text = '';
    this.strokes = [];
    if (this.mode === 'tab') { const panel = this.root?.parentElement; if (panel) await this.mountTab(panel); }
    else this.close();
  }
}

function buildId(): string { try { return __BUILD_ID__; } catch { return ''; } }
