import { app } from '@wildshard/engine/app/runtime';
import type { Scope } from '@wildshard/engine/app/scope';
import { icon, type IconId } from '@wildshard/engine/ui/icons';
import type { UiHandle } from '@wildshard/engine/ui/layers';
import { uiScope, mountUi } from '@wildshard/engine/ui/ownership';
import { itemCardTile, type ItemCardState } from '@wildshard/engine/ui/ItemCard';
import { onSettingChange, setting } from '@wildshard/engine/ui/Settings';
import { hudAccent } from '../../session/hudAccent';
/**
 * ShopPanel — the trader's counter on Driftwood (E314 stage 2, Jake's pick board 5 **C**: one good per card, flipped with
 * ‹ ›, a big BUY button; buy only). DOM in `#hud`, styled by src/game/loot/ui/shop.css (prefix ws-shop-), in the baseline UI
 * language: navy glass, cyan hairlines with corner brackets, letter-spaced monospace uppercase. The world stays visible
 * above the sheet (the trader at her counter); the sheet holds her one-line greeting, the purse, the card and BUY.
 *
 *   const shop = new ShopPanel({ trader: 'Maren', place: 'Driftwood Isle', goods: GOODS, state: (g) => goodState(g, owned, purse.coins),
 *                                coins: () => purse.coins, needs: (g) => 'Whetstone I', greeting: () => '…' });
 *   shop.onBuy = (g) => buyGood(g, owned, purse)     // true: bought (the card turns OWNED); the host plays the chime / toast
 *   shop.onOpen / shop.onClose                       // the host releases / takes back the pointer lock and the weapons
 *   shop.open() / shop.close() / shop.isOpen / shop.render()   // render(): the purse or Owned changed while open
 *
 * Input: ‹ › (or a swipe on the card, ← →) flips; BUY (or Enter / Space) buys the card shown; CLOSE, Esc or E closes.
 *
 * SF28 (Jake's G87, `art/hud/round-19-ui-kit/B-big-cards-accent.jpg`): with pause ▸ Settings ▸ Debug ▸ Item cards on Big,
 * the sheet is the big-cards kit instead: "<TRADER> · TRADER" and the purse, every good as a big item tile in a 3-up grid
 * (src/engine/ui/ItemCard.ts; a tap picks one, ← → step through), and one wide "BUY <NAME> · <price>" bar, all in the
 * shard's HUD accent (session/hudAccent.ts). Classic (the default) builds nothing of it.
 *
 * SF28 part 2: a barter stall declares its look instead of building DOM. `cost` (what a good takes, as lines: "2 deer
 * hides (3)") replaces the coin price and the purse; `verb` names the deal ("Trade"); `layout: { kind: 'slate', … }` keeps
 * the stall's Classic look, a chalk slate with every good as a row (its name, its line, what it takes, a button), styled by
 * src/game/loot/ui/slate.css (prefix ws-slate-), at the game menu's layer. Big draws the same G87 sheet for both (the tile's
 * name is `tile`, its foot what the good takes, the bar "TRADE <TILE>").
 *
 *   new ShopPanel({ trader: 'Mott', place: '…', goods, state, cost: (g) => [{ text: '2 deer hides (3)', have: true }],
 *                   verb: 'Trade', layout: { kind: 'slate', kicker: "Mott's stall · no coin", title: 'Swaps' }, scope });
 */
import './shop.css';
import './slate.css';

export interface ShopGood {
  id: string; name: string; does: string; icon: IconId; price: number;
  /** the big tile's name when `name` is a long line (Big cards only; `name` when absent) */
  tile?: string;
}
/** 'full': the buyer has no room for what the good gives (a full quiver) */
export type ShopState = 'owned' | 'locked' | 'short' | 'buy' | 'full';
/** one thing a bartered good takes, as its line reads ("2 deer hides (3)": the trailing count is what the buyer holds) */
export interface ShopCost { readonly text: string; readonly have: boolean }
/** a Classic look other than the flip deck: every good a row on a chalk slate, under a kicker and a hand-lettered title */
export interface ShopSlate { readonly kind: 'slate'; readonly kicker: string; readonly title: string }
export interface ShopOpts<G extends ShopGood> {
  trader: string;
  place: string;
  goods: readonly G[];
  state: (g: G) => ShopState;
  /** the purse (absent: a barter stall, no coin and no purse) */
  coins?: () => number;
  /** what a bartered good takes, in place of its coin price */
  cost?: (g: G) => readonly ShopCost[];
  /** the deal's verb on the buttons ("Buy" when absent) */
  verb?: string;
  /** a locked good's prerequisite, by name ("Whetstone I") */
  needs?: (g: G) => string;
  /** her line on top, read each time the shop opens */
  greeting?: () => string;
  /** the Classic look (the flip deck when absent) */
  layout?: ShopSlate;
  /** the owner the panel's DOM and listeners live and die with (the level's UI scope when absent) */
  scope?: Scope;
}

const COIN = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#f2c44d"/><circle cx="12" cy="12" r="6.6" fill="none" stroke="#9c6a12" stroke-width="1.8"/><circle cx="12" cy="12" r="2.2" fill="#9c6a12"/></svg>';
const CHEV_L = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4 L7 12 L15 20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const CHEV_R = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4 L17 12 L9 20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const CROSS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6 L18 18 M18 6 L6 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent?: HTMLElement, html?: string): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag); e.className = cls; if (html !== undefined) e.innerHTML = html; parent?.append(e); return e;
};
const text = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, value: string, parent: HTMLElement): HTMLElementTagNameMap[K] => {
  const e = el(tag, cls, parent); e.textContent = value; return e;
};
/** a cost line without the held count ("2 deer hides (3)" → "2 deer hides"), for the big tile's foot and bar */
const bare = (c: ShopCost): string => c.text.replace(/ \(\d+\)$/u, '');

interface SlateView { root: HTMLDivElement; body: HTMLElement; rows: Scope | null }

export class ShopPanel<G extends ShopGood> {
  readonly scope: Scope;
  private layer: UiHandle | null = null;
  private get open_(): boolean { return this.layer?.active === true; }
  /** the counter: the flip deck and the Big sheet */
  private readonly counter: HTMLDivElement;
  /** a slate stall's Classic panel */
  private readonly slate: SlateView | null;
  /** the root on screen while open */
  private shownRoot: HTMLDivElement | null = null;
  onBuy?: (g: G) => boolean;
  onOpen?: () => void;
  onClose?: () => void;

  private i = 0;
  private line: HTMLElement; private count: HTMLElement; private purse: HTMLElement;
  private card: HTMLElement; private dots: HTMLElement; private buy: HTMLButtonElement;
  private swipeX: number | null = null;
  private readonly o: ShopOpts<G>;
  private readonly classic: HTMLElement;
  private big: { sheet: HTMLElement; purse: HTMLElement; grid: HTMLElement; buy: HTMLButtonElement } | null = null;
  constructor(o: ShopOpts<G>) {
    this.o = o;
    this.scope = o.scope === undefined ? uiScope('shop') : uiScope('shop', o.scope);
    this.counter = el('div', 'ws-shop');
    const top = el('div', 'ws-shop-top', this.counter);
    const close = el('button', 'ws-shop-close', top, `<i>${CROSS}</i>Close`);
    close.type = 'button';
    this.scope.listen(close, 'click', (e) => { e.stopPropagation(); this.close(); });
    const title = el('div', 'ws-shop-title', top); text('b', '', `${o.trader}'s counter`, title); text('span', '', o.place, title);

    const sheet = el('div', 'ws-shop-sheet ws-glass', this.counter);
    this.classic = sheet;
    text('div', 'ws-shop-who', `${o.trader} · Trader`, sheet);
    this.line = el('div', 'ws-shop-line', sheet);
    const row = el('div', 'ws-shop-row', sheet);
    this.count = el('span', 'ws-shop-count', row);
    this.purse = el('span', 'ws-shop-purse', row);
    const deck = el('div', 'ws-shop-deck', sheet);
    const prev = el('button', 'ws-shop-flip', deck, CHEV_L); prev.type = 'button'; prev.setAttribute('aria-label', 'Previous');
    this.card = el('div', 'ws-shop-card', deck);
    const next = el('button', 'ws-shop-flip', deck, CHEV_R); next.type = 'button'; next.setAttribute('aria-label', 'Next');
    this.scope.listen(prev, 'click', (e) => { e.stopPropagation(); this.flip(-1); });
    this.scope.listen(next, 'click', (e) => { e.stopPropagation(); this.flip(1); });
    this.dots = el('div', 'ws-shop-dots', sheet);
    this.buy = el('button', 'ws-shop-buy', sheet);
    this.buy.type = 'button';
    this.scope.listen(this.buy, 'click', (e) => { e.stopPropagation(); this.tryBuy(); });

    // a swipe across the card flips it (the phone's natural gesture; ‹ › stay for a tap)
    this.scope.listen(this.card, 'pointerdown', (e) => { this.swipeX = e.clientX; });
    this.scope.listen(this.card, 'pointerup', (e) => {
      if (this.swipeX === null) return;
      const dx = e.clientX - this.swipeX; this.swipeX = null;
      if (Math.abs(dx) > 40) this.flip(dx < 0 ? 1 : -1);
    });
    this.scope.listen(this.counter, 'pointerdown', (e) => { e.stopPropagation(); });   // the touch pads under it never see a tap
    this.scope.listen(this.counter, 'touchstart', (e) => { e.stopPropagation(); }, { passive: true });
    // ← → and confirm pick and buy on the counter; the slate's rows carry their own buttons
    const counterTop = (): boolean => this.layer?.top === true && this.shownRoot === this.counter;
    app.input.bind('nav.left', () => { this.flip(-1); }, this.scope, counterTop);
    app.input.bind('nav.right', () => { this.flip(1); }, this.scope, counterTop);
    app.input.bind('confirm', () => { this.tryBuy(); }, this.scope, counterTop);
    app.input.bind('use', () => { this.close(); }, this.scope, () => this.layer?.top === true);
    mountUi(this.counter, this.scope);
    this.slate = o.layout === undefined ? null : this.slateView(o.layout);
    this.scope.onDispose(onSettingChange('itemCards', () => { if (this.open_) { this.render(); this.showRoot(); } }));
  }

  private get bigCards(): boolean { return setting('itemCards') === 'big'; }
  /** the root the look wants: the slate for a slate stall in Classic, else the counter */
  get root(): HTMLDivElement { return this.slate !== null && !this.bigCards ? this.slate.root : this.counter; }

  /** the slate stall's Classic panel: the frame (the kicker, the title, the rows' body) and CLOSE */
  private slateView(l: ShopSlate): SlateView {
    const root = el('div', 'ws-slate');
    const frame = el('div', 'ws-slate-frame', root);
    const head = el('div', 'ws-slate-head', frame);
    text('div', 'ws-slate-kicker', l.kicker, head);
    text('div', 'ws-slate-title', l.title, head);
    const body = el('div', 'ws-slate-body', frame);
    const close = text('button', 'ws-slate-close', 'Close', root);
    close.type = 'button';
    this.scope.listen(close, 'click', (e) => { e.stopPropagation(); this.close(); });
    this.scope.listen(root, 'pointerdown', (e) => { e.stopPropagation(); });
    mountUi(root, this.scope);
    return { root, body, rows: null };
  }

  /** the G87 sheet, built the first time Big is on */
  private bigSheet(): NonNullable<ShopPanel<G>['big']> {
    if (this.big !== null) return this.big;
    const sheet = el('div', 'ws-shop-big ws-glass');
    const head = el('div', 'ws-shop-bighead', sheet);
    text('b', 'ws-shop-bigwho', `${this.o.trader} · Trader`, head);
    const purse = el('span', 'ws-shop-bigpurse', head);
    const grid = el('div', 'ws-shop-grid', sheet);
    const buy = el('button', 'ws-shop-bigbuy', sheet); buy.type = 'button';
    this.scope.listen(buy, 'click', (e) => { e.stopPropagation(); this.tryBuy(); });
    this.scope.listen(grid, 'click', (e) => {
      const tile = e.target instanceof Element ? e.target.closest('.ws-icard-tile') : null;
      const k = tile === null ? -1 : [...grid.children].indexOf(tile);
      if (k >= 0) { e.stopPropagation(); this.i = k; this.render(); }
    });
    this.big = { sheet, purse, grid, buy };
    return this.big;
  }

  get isOpen(): boolean { return this.open_; }
  /** the good on the card */
  get shown(): G | undefined { return this.o.goods[this.i]; }

  open(): void {
    if (this.open_ || this.scope.disposed) return;
    // open on the first good still to buy (all bought: the first)
    const first = this.o.goods.findIndex((g) => this.o.state(g) !== 'owned');
    this.i = first === -1 ? 0 : first;
    this.line.textContent = this.o.greeting?.() ?? '';
    this.render();
    this.showRoot();
    this.onOpen?.();
  }

  close(): void {
    if (!this.open_) return;
    this.layer?.dispose(); this.layer = null;
    this.hideRoot();
    this.onClose?.();
  }

  /** put the root the look wants on screen as the open layer (a swap when Item cards changes while open). The slate sits at
   *  the game menu's layer + 4 as it always did; the counter is a modal that steps the HUD aside. */
  private showRoot(): void {
    const root = this.root;
    if (root === this.shownRoot) return;
    this.layer?.dispose();
    this.hideRoot();
    this.layer = root === this.counter
      ? app.ui.push('modal', { root, order: -40, back: () => { this.close(); } }, this.scope)
      : app.ui.push('gameMenu', { root, order: 4, back: () => { this.close(); } }, this.scope);
    this.shownRoot = root;
    if (root === this.counter) this.hideHud(true);
    root.classList.add('show');
  }

  private hideRoot(): void {
    const was = this.shownRoot;
    if (was === null) return;
    was.classList.remove('show');
    if (was === this.counter) this.hideHud(false);
    this.shownRoot = null;
  }

  /** the HUD under the counter (the touch pads, PAUSE, the minimap, the quest chip) steps aside while it is open, so the
   *  top bar and the trader read clean (board 5 C); the toasts stay (a sale's "Bought · …") */
  private hidden: { el: HTMLElement; was: string }[] = [];
  private hideHud(on: boolean): void {
    if (!on) { for (const h of this.hidden) h.el.style.visibility = h.was; this.hidden = []; return; }
    const hud = this.counter.parentElement;
    if (hud === null) return;
    for (const c of hud.children) {
      if (c === this.counter || !(c instanceof HTMLElement) || c.classList.contains('ws-game-toasts')) continue;
      this.hidden.push({ el: c, was: c.style.visibility });
      c.style.visibility = 'hidden';
    }
  }

  /** show card `i` (dev / captures) */
  show(i: number): void { this.i = Math.max(0, Math.min(this.o.goods.length - 1, i)); this.render(); }

  flip(d: number): void {
    const n = this.o.goods.length;
    if (n === 0) return;
    this.i = (this.i + d + n) % n;
    this.render();
    this.card.classList.remove('in-l', 'in-r'); void this.card.offsetWidth; this.card.classList.add(d < 0 ? 'in-l' : 'in-r');
  }

  private coins(): number { return this.o.coins?.() ?? 0; }
  private needs(g: G): string { return this.o.needs?.(g) ?? ''; }
  private get verb(): string { return this.o.verb ?? 'Buy'; }

  render(): void {
    const g = this.o.goods[this.i];
    if (!g) return;
    if (this.bigCards) { this.renderBig(g); return; }
    if (this.big?.sheet.isConnected === true) { this.big.sheet.replaceWith(this.classic); this.counter.style.removeProperty('--ws-accent'); }
    if (this.slate !== null) { this.renderSlate(this.slate); return; }
    const st = this.o.state(g), goods = this.o.goods;
    this.count.textContent = `${this.i + 1} / ${goods.length}`;
    this.purse.innerHTML = `<i class="ws-shop-coin">${COIN}</i><b>${this.coins()}</b>`;
    this.card.className = `ws-shop-card ${st}`;
    this.card.replaceChildren();
    el('i', 'ws-shop-icon', this.card, icon(g.icon)); text('b', 'ws-shop-name', g.name, this.card);
    el('span', 'ws-shop-rule', this.card); text('span', 'ws-shop-does', g.does, this.card);
    if (st === 'owned') text('span', 'ws-shop-stamp', 'Owned', this.card);
    else { const price = text('span', 'ws-shop-price', String(g.price), this.card); el('i', 'ws-shop-coin', price, COIN); }
    this.dots.innerHTML = goods.map((x, k) => `<i class="${k === this.i ? 'on' : ''}${this.o.state(x) === 'owned' ? ' got' : ''}"></i>`).join('');
    this.buy.className = `ws-shop-buy ${st}`;
    this.buy.disabled = st !== 'buy';
    this.buy.textContent = st === 'owned' ? 'Owned' : st === 'locked' ? `Needs ${this.needs(g)}` : st === 'full' ? 'Full' : `${this.verb} · ${g.price}`;
    if (st === 'short' || st === 'buy') el('i', 'ws-shop-coin', this.buy, COIN);
    if (st === 'short') text('small', '', `Need ${g.price - this.coins()} more`, this.buy);
  }

  /** the slate: every good a row (its name, its line, what it takes with what you hold, the verb / Owned / Full button) */
  private renderSlate(s: SlateView): void {
    s.rows?.dispose();
    s.body.replaceChildren();
    const rows = this.scope.child('rows');
    s.rows = rows;
    for (const g of this.o.goods) {
      const st = this.o.state(g);
      const row = el('div', `ws-slate-swap${st === 'buy' ? ' ok' : ''}${st === 'owned' ? ' owned' : ''}`, s.body);
      const words = el('div', 'ws-slate-swap-text', row);
      text('div', 'ws-slate-swap-label', g.name, words);
      text('div', 'ws-slate-swap-blurb', g.does, words);
      const give = el('div', 'ws-slate-swap-give', words);
      for (const c of this.o.cost?.(g) ?? []) text('span', c.have ? 'have' : 'short', c.text, give);
      const btn = text('button', 'ws-slate-swap-btn', st === 'owned' ? 'Owned' : st === 'full' ? 'Full' : this.verb, row);
      btn.type = 'button'; btn.disabled = st !== 'buy';
      rows.listen(btn, 'click', (e) => { e.stopPropagation(); if (this.o.state(g) === 'buy' && this.onBuy?.(g) === true) this.render(); });
    }
  }

  /** the G87 sheet: every good a big tile, the one picked framed in the accent, and the wide BUY bar */
  private renderBig(g: G): void {
    const big = this.bigSheet();
    if (!big.sheet.isConnected) this.classic.replaceWith(big.sheet);
    const accent = hudAccent();
    if (accent === null) this.counter.style.removeProperty('--ws-accent'); else this.counter.style.setProperty('--ws-accent', accent);
    big.purse.replaceChildren();
    if (this.o.coins !== undefined) { el('i', 'ws-shop-ring', big.purse); text('b', '', String(this.coins()), big.purse); }
    const FOOT: Record<ShopState, ItemCardState> = { buy: 'buy', short: 'short', owned: 'owned', locked: 'locked', full: 'locked' };
    const barter = this.o.cost;
    const dense = this.o.goods.length > 6;   // seven or more goods: 4-up compact tiles, so the world stays in view
    big.grid.classList.toggle('dense', dense);
    big.grid.replaceChildren(...this.o.goods.map((x, k) => {
      const st = this.o.state(x);
      // a bartered good's foot is its state in a word (the bar spells out what it takes): a cost list wrapped every tile
      const detail = st === 'owned' ? 'Owned' : st === 'locked' ? `Needs ${this.needs(x)}` : st === 'full' ? 'Full'
        : barter === undefined ? undefined : st === 'buy' ? 'Ready' : 'Need more';
      return itemCardTile({ name: x.tile ?? x.name, icon: x.icon, ...(barter === undefined ? { price: x.price } : {}), state: FOOT[st], ...(detail === undefined ? {} : { detail }) }, k === this.i, dense);
    }));
    const st = this.o.state(g), name = g.tile ?? g.name;
    big.buy.className = `ws-shop-bigbuy ${st}`;
    big.buy.disabled = st !== 'buy';
    const short = barter === undefined ? `Need ${g.price - this.coins()} more` : `Need ${barter(g).filter((c) => !c.have).map(bare).join(' · ')}`;
    big.buy.textContent = st === 'owned' ? `${name} · Owned` : st === 'locked' ? `Needs ${this.needs(g)}` : st === 'full' ? `${name} · Full`
      : st === 'short' ? short : barter === undefined ? `${this.verb} ${name} · ${g.price}` : `${this.verb} ${name}`;
    if (barter !== undefined && st === 'buy') text('small', '', barter(g).map(bare).join(' · '), big.buy);
  }

  private tryBuy(): void {
    const g = this.shown;
    if (!g || this.o.state(g) !== 'buy') return;
    if (this.onBuy?.(g) !== true) return;
    this.render();
    if (this.bigCards || this.slate !== null) return;
    this.card.classList.remove('sold'); void this.card.offsetWidth; this.card.classList.add('sold');
    this.purse.classList.remove('spent'); void this.purse.offsetWidth; this.purse.classList.add('spent');
  }

  dispose(): void { this.close(); this.scope.dispose(); }
}
