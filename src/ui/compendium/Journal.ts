/**
 * The Compendium's book — one full-screen overlay, the same DOM for every shard; the skin (CompendiumSkin) adds its
 * modifier class, its tab words, its stamp and its stats row. Pine Hollow's is the leather hunter's journal (board B4 A,
 * art/pine-hollow/round-4-journal-ui/A-journal-open-book.jpg), styled by src/ui/styles/compendium.css (prefix ws-cmp-).
 *
 *   const book = new Journal(state);
 *   book.open()  /  book.open('ghost-stag')   // on an entry (the trophy wall's EXAMINE)   book.close()   book.isOpen
 *   book.onOpen / book.onClose                // the host releases / re-takes the pointer lock and the weapons
 *   book.onViewModel = (model) => …           // optional: a plate's 3D button opens the Explore creature viewer
 *
 * One entry per page. Turn with the neighbour sketches, a swipe, ← / →, or the tabs; Esc / CLOSE shuts it. While it is
 * open every keydown stops here (the player does not walk off under the book); keyups pass, so no key sticks.
 * Unknown entries read "???" over a silhouette; `discovered` shows the name and the hint; `seen` the full plate and
 * notes; `taken` adds the stamp. The trophy tab is a grid of the wall's slots, each opening its entry.
 */
import { STATE_ORDER, type EntryDef, type EntryStats, type Plate, type TrophySlot } from './types';
import type { CompendiumState } from './state';

const esc = (s: string): string => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const el = (cls: string, html = '', tag = 'div'): HTMLElement => { const e = document.createElement(tag); e.className = cls; if (html) e.innerHTML = html; return e; };

/** the silhouette of a sketch (an unknown / discovered page, a ??? neighbour): `<id>-sil.webp` beside it */
export const silhouetteOf = (sketch: string): string => sketch.replace(/\.webp$/, '-sil.webp');

/** tab glyphs by tab id (a skin's unknown tab id gets none) */
const GLYPH: Record<string, string> = {
  beasts: '<svg viewBox="0 0 24 24"><path d="M12 21v-7M12 14c-3 0-5-2-6-5M12 14c3 0 5-2 6-5M6 9L4 5M6 9L8 4M6 9L3 9M18 9l2-4M18 9l-2-5M18 9l3 0" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  elites: '<svg viewBox="0 0 24 24"><path d="M12 3c-4.4 0-7 3-7 6.8 0 2.2 1 3.7 2.4 4.6V18h9.2v-3.6C18 13.5 19 12 19 9.8 19 6 16.4 3 12 3z" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="9.3" cy="10.5" r="1.6" fill="currentColor"/><circle cx="14.7" cy="10.5" r="1.6" fill="currentColor"/><path d="M10 18v3M14 18v3" stroke="currentColor" stroke-width="1.6"/></svg>',
  places: '<svg viewBox="0 0 24 24"><path d="M12 21s-6-6.2-6-11a6 6 0 0 1 12 0c0 4.8-6 11-6 11z" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="10" r="2.2" fill="currentColor"/></svg>',
  trophies: '<svg viewBox="0 0 24 24"><path d="M7 4h10v4a5 5 0 0 1-10 0zM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M12 13v4M8 20h8M9.5 17h5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
};
const GLYPH_3D = '<svg viewBox="0 0 24 24"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12L4 7.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>';

/** the hand-lettered face for names and notes (public/fonts/caveat-600-latin.woff2, SIL OFL), loaded on first open */
let handFont: Promise<void> | null = null;
export function loadHandFont(): Promise<void> {
  handFont ??= (async () => {
    try {
      if (typeof FontFace === 'undefined') return;
      const f = new FontFace('WS Hand', 'url(/fonts/caveat-600-latin.woff2) format("woff2")', { weight: '600', display: 'swap' });
      document.fonts.add(await f.load());
    } catch { /* the fallback cursive face */ }
  })();
  return handFont;
}

type Dir = 1 | -1;

export class Journal {
  readonly root: HTMLElement;
  private tabBar: HTMLElement;
  private leaf: HTMLElement;
  private page: HTMLElement;
  private tab: string;
  /** the page index per tab (the book remembers where you were in each) */
  private at = new Map<string, number>();
  private _open = false;
  private swipe: { x: number; y: number; id: number } | null = null;
  onOpen?: () => void;
  onClose?: () => void;
  onViewModel?: (model: NonNullable<Plate['model']>, entry: EntryDef) => void;

  constructor(private state: CompendiumState) {
    const skin = state.def.skin;
    this.tab = skin.tabs[0]?.id ?? '';
    this.root = el(`ws-cmp ${skin.className}`);
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-label', skin.title);
    this.root.inert = true;
    const close = el('ws-cmp-close', 'Close', 'button') as HTMLButtonElement; close.type = 'button';
    close.addEventListener('click', () => { this.close(); });
    const book = el('ws-cmp-book');
    this.tabBar = el('ws-cmp-tabs');
    for (const t of skin.tabs) {
      const b = el('ws-cmp-tab', `${GLYPH[t.id] ?? ''}<span>${esc(t.label)}</span>`, 'button') as HTMLButtonElement; b.type = 'button'; b.dataset['tab'] = t.id;
      b.addEventListener('click', () => { this.select(t.id); });
      this.tabBar.append(b);
    }
    this.leaf = el('ws-cmp-leaf');
    this.page = el('ws-cmp-page');
    this.leaf.append(this.page);
    book.append(this.tabBar, this.leaf);
    this.root.append(book, close);
    document.body.append(this.root);

    // a swipe on the page turns it (touch and mouse drag alike); taps fall through to the buttons
    this.leaf.addEventListener('pointerdown', (e) => { this.swipe = { x: e.clientX, y: e.clientY, id: e.pointerId }; });
    this.leaf.addEventListener('pointerup', (e) => {
      const s = this.swipe; this.swipe = null;
      if (!s || s.id !== e.pointerId) return;
      const dx = e.clientX - s.x, dy = e.clientY - s.y;
      if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) this.turn(dx < 0 ? 1 : -1);
    });
    this.leaf.addEventListener('pointercancel', () => { this.swipe = null; });
    // every keydown stops at the book while it is open (window, capture phase: before the player and the menu see it)
    window.addEventListener('keydown', (e) => {
      if (!this._open) return;
      e.stopPropagation();
      if (e.code === 'Escape' || e.code === 'KeyN') { e.preventDefault(); this.close(); }
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') this.turn(1);
      else if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.turn(-1);
      else if (e.code === 'Tab') { e.preventDefault(); this.cycleTab(e.shiftKey ? -1 : 1); }
    }, true);
    state.onUpdate = () => { if (this._open) this.render(); };
  }

  get isOpen(): boolean { return this._open; }

  /** open on the current page, or on `entryId` (its tab, its page) */
  open(entryId?: string): void {
    void loadHandFont();
    if (entryId !== undefined) this.goTo(entryId);
    this.render();
    if (this._open) return;
    this._open = true;
    this.root.inert = false;
    this.root.classList.add('show');
    this.onOpen?.();
  }
  close(): void {
    if (!this._open) return;
    this._open = false;
    this.root.classList.remove('show');
    this.root.inert = true;
    this.onClose?.();
  }
  toggle(): void { if (this._open) this.close(); else this.open(); }

  /** point the book at an entry (its tab and page) */
  goTo(entryId: string): void {
    const e = this.state.entry(entryId);
    if (!e) return;
    this.tab = e.tab;
    this.at.set(e.tab, Math.max(0, this.state.tab(e.tab).findIndex((x) => x.id === entryId)));
  }

  select(tab: string): void { if (tab === this.tab) return; this.tab = tab; this.render(); }
  private cycleTab(dir: Dir): void {
    const tabs = this.state.def.skin.tabs, i = tabs.findIndex((t) => t.id === this.tab);
    const next = tabs[(i + dir + tabs.length) % tabs.length];
    if (next) this.select(next.id);
  }

  /** the entries of the current tab (the trophy tab has one page: the wall) */
  private get entries(): EntryDef[] { return this.state.tab(this.tab); }
  private get index(): number { return Math.min(this.at.get(this.tab) ?? 0, Math.max(0, this.entries.length - 1)); }

  /** turn one page; the old page folds away over the new one (forward) or the new one folds in (back) */
  turn(dir: Dir): void {
    const n = this.entries.length, i = this.index + dir;
    if (this.isTrophyTab || i < 0 || i >= n) { this.leaf.classList.remove('bump'); void this.leaf.offsetWidth; this.leaf.classList.add('bump'); return; }
    const old = this.page.cloneNode(true) as HTMLElement;
    old.classList.add('ws-cmp-turn', dir > 0 ? 'out' : 'in');
    old.inert = true;
    this.at.set(this.tab, i);
    this.render();
    if (dir < 0) { this.page.classList.add('ws-cmp-turnin'); old.classList.add('under'); }
    this.leaf.append(old);
    const fresh = this.page;
    const done = (): void => { old.remove(); fresh.classList.remove('ws-cmp-turnin'); };
    (dir > 0 ? old : fresh).addEventListener('animationend', done, { once: true });
    setTimeout(done, 700); // reduced motion / a hidden tab never fires animationend
  }

  private get isTrophyTab(): boolean { return this.tab === this.state.def.skin.trophyTab; }

  private render(): void {
    for (const b of this.tabBar.children) (b as HTMLElement).classList.toggle('active', (b as HTMLElement).dataset['tab'] === this.tab);
    const page = el('ws-cmp-page');
    if (this.isTrophyTab) this.renderWall(page);
    else {
      const e = this.entries[this.index];
      if (e) this.renderEntry(page, e); else page.append(el('ws-cmp-empty', 'Nothing here yet.'));
    }
    this.page.replaceWith(page);
    this.page = page;
  }

  private renderEntry(page: HTMLElement, e: EntryDef): void {
    const skin = this.state.def.skin, s = this.state.stats(e.id);
    const level = STATE_ORDER.indexOf(s.state), named = level >= 1, drawn = level >= 2;
    page.dataset['entry'] = e.id; page.dataset['state'] = s.state;
    const stamp = s.state === 'taken' || (e.kind === 'place' && drawn) ? `<div class="ws-cmp-stamp">${esc(skin.stamp(e))}</div>` : '';
    const sub = named && e.subtitle ? `<div class="ws-cmp-sub">${esc(e.subtitle)}</div>` : '';
    page.append(el('ws-cmp-head', `<h2 class="ws-cmp-name">${named ? esc(e.name) : '???'}</h2>${sub}${stamp}`));
    const plate = el(`ws-cmp-plate${drawn ? '' : ' sil'}${e.kind === 'place' ? ' place' : ''}`);
    const src = drawn ? e.plate.sketch : e.kind === 'place' ? e.plate.sketch : silhouetteOf(e.plate.sketch);
    plate.innerHTML = `<img alt="" draggable="false" decoding="async" src="${esc(src)}">${drawn ? '' : '<span class="ws-cmp-q">???</span>'}`;
    const model = e.plate.model, onView = this.onViewModel;
    if (drawn && model && onView) {
      const b = el('ws-cmp-3d', `${GLYPH_3D}<span>3D</span>`, 'button') as HTMLButtonElement; b.type = 'button';
      b.addEventListener('click', () => { onView(model, e); });
      plate.append(b);
    }
    page.append(plate);
    page.append(this.statsRow(e, s));
    const note = drawn ? e.notes : named ? (e.hint ?? 'Heard of, not yet seen.') : 'Not yet found.';
    page.append(el(`ws-cmp-notes${drawn ? '' : ' hint'}`, esc(note), 'p'));
    const near = el('ws-cmp-near');
    const list = this.entries, i = this.index;
    for (const [dir, n] of [[-1, list[i - 1]], [1, list[i + 1]]] as const) near.append(this.neighbour(n, dir));
    page.append(near);
    page.append(el('ws-cmp-count', `<i></i>${i + 1} / ${list.length}<i></i>`));
  }

  private statsRow(e: EntryDef, s: EntryStats): HTMLElement {
    const row = el('ws-cmp-stats');
    for (const st of this.state.def.skin.stats(e, s)) row.append(el('ws-cmp-stat', `<span>${esc(st.label)}</span><b>${esc(st.value)}</b>`));
    return row;
  }

  /** a neighbour's thumbnail: its sketch once seen, its silhouette and ??? before; an empty slot past either end */
  private neighbour(e: EntryDef | undefined, dir: Dir): HTMLElement {
    if (!e) return el('ws-cmp-nb none');
    const s = this.state.stats(e.id), drawn = STATE_ORDER.indexOf(s.state) >= 2, named = s.state !== 'unknown';
    const src = drawn || e.kind === 'place' ? e.plate.sketch : silhouetteOf(e.plate.sketch);
    const b = el(`ws-cmp-nb${drawn ? '' : ' sil'}${e.kind === 'place' ? ' place' : ''}`, `<img alt="" draggable="false" decoding="async" src="${esc(src)}"><span>${named ? esc(e.name) : '???'}</span>`, 'button') as HTMLButtonElement;
    b.type = 'button'; b.dataset['dir'] = String(dir);
    b.addEventListener('click', () => { this.turn(dir); });
    return b;
  }

  /** the trophy tab: the wall as a grid — taken slots show the sketch and the joke title, the rest the chalk silhouette */
  private renderWall(page: HTMLElement): void {
    const slots: readonly TrophySlot[] = this.state.def.trophies ?? [];
    const taken = slots.filter((t) => this.state.state(t.entry) === 'taken').length;
    page.dataset['entry'] = 'trophies'; page.classList.add('wall');
    page.append(el('ws-cmp-head', `<h2 class="ws-cmp-name">Trophy Wall</h2><div class="ws-cmp-sub">The ranger's cabin · ${taken} / ${slots.length} taken</div>`));
    const grid = el('ws-cmp-wall');
    for (const t of slots) {
      const e = this.state.entry(t.entry);
      if (!e) continue;
      const s = this.state.stats(t.entry), got = s.state === 'taken', named = s.state !== 'unknown';
      const card = el(`ws-cmp-slot${got ? ' got' : ''}`, `
        <img alt="" draggable="false" decoding="async" src="${esc(got ? e.plate.sketch : silhouetteOf(e.plate.sketch))}">
        <b>${named ? esc(e.name) : '???'}</b>
        <span>${got ? esc(t.title) : 'Not yet taken'}</span>`, 'button') as HTMLButtonElement;
      card.type = 'button';
      card.addEventListener('click', () => { this.goTo(t.entry); this.render(); });
      grid.append(card);
    }
    page.append(grid);
    page.append(el('ws-cmp-notes', 'Every one on this wall was the hardest thing in the Hollow once. Chalk marks the rest.', 'p'));
  }
}
