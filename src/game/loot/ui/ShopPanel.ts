import { app } from '@wildshard/engine/app/runtime';
import { icon, type IconId } from '@wildshard/engine/ui/icons';
import type { UiHandle } from '@wildshard/engine/ui/layers';
import { uiScope, mountUi } from '@wildshard/engine/ui/ownership';
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
 */
import './shop.css';

export interface ShopGood { id: string; name: string; does: string; icon: IconId; price: number }
export type ShopState = 'owned' | 'locked' | 'short' | 'buy';
export interface ShopOpts<G extends ShopGood> {
  trader: string;
  place: string;
  goods: readonly G[];
  state: (g: G) => ShopState;
  coins: () => number;
  /** a locked good's prerequisite, by name ("Whetstone I") */
  needs: (g: G) => string;
  /** her line on top, read each time the shop opens */
  greeting: () => string;
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

export class ShopPanel<G extends ShopGood> {
  readonly scope = uiScope('shop');
  private layer: UiHandle | null = null;
  private get open_(): boolean { return this.layer?.active === true; }
  readonly root: HTMLDivElement;
  onBuy?: (g: G) => boolean;
  onOpen?: () => void;
  onClose?: () => void;

  private i = 0;
  private line: HTMLElement; private count: HTMLElement; private purse: HTMLElement;
  private card: HTMLElement; private dots: HTMLElement; private buy: HTMLButtonElement;
  private swipeX: number | null = null;
  private readonly o: ShopOpts<G>;
  constructor(o: ShopOpts<G>) {
    this.o = o;
    this.root = el('div', 'ws-shop');
    const top = el('div', 'ws-shop-top', this.root);
    const close = el('button', 'ws-shop-close', top, `<i>${CROSS}</i>Close`);
    close.type = 'button';
    this.scope.listen(close, 'click', (e) => { e.stopPropagation(); this.close(); });
    const title = el('div', 'ws-shop-title', top); text('b', '', `${o.trader}'s counter`, title); text('span', '', o.place, title);

    const sheet = el('div', 'ws-shop-sheet ws-glass', this.root);
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
    this.scope.listen(this.root, 'pointerdown', (e) => { e.stopPropagation(); });   // the touch pads under it never see a tap
    this.scope.listen(this.root, 'touchstart', (e) => { e.stopPropagation(); }, { passive: true });
    app.input.bind('nav.left', () => { this.flip(-1); }, this.scope, () => this.layer?.top === true);
    app.input.bind('nav.right', () => { this.flip(1); }, this.scope, () => this.layer?.top === true);
    app.input.bind('confirm', () => { this.tryBuy(); }, this.scope, () => this.layer?.top === true);
    app.input.bind('use', () => { this.close(); }, this.scope, () => this.layer?.top === true);
    mountUi(this.root, this.scope);
  }

  get isOpen(): boolean { return this.open_; }
  /** the good on the card */
  get shown(): G | undefined { return this.o.goods[this.i]; }

  open(): void {
    if (this.open_) return;
    this.layer = app.ui.push('modal', { root: this.root, order: -40, back: () => { this.close(); } }, this.scope);
    // open on the first good still to buy (all bought: the first)
    const first = this.o.goods.findIndex((g) => this.o.state(g) !== 'owned');
    this.i = first === -1 ? 0 : first;
    this.line.textContent = this.o.greeting();
    this.render();
    this.hideHud(true);
    this.root.classList.add('show');
    this.onOpen?.();
  }

  close(): void {
    if (!this.open_) return;
    this.layer?.dispose(); this.layer = null;
    this.root.classList.remove('show');
    this.hideHud(false);
    this.onClose?.();
  }

  /** the HUD under the counter (the touch pads, PAUSE, the minimap, the quest chip) steps aside while it is open, so the
   *  top bar and the trader read clean (board 5 C); the toasts stay (a sale's "Bought · …") */
  private hidden: { el: HTMLElement; was: string }[] = [];
  private hideHud(on: boolean): void {
    if (!on) { for (const h of this.hidden) h.el.style.visibility = h.was; this.hidden = []; return; }
    const hud = this.root.parentElement;
    if (hud === null) return;
    for (const c of hud.children) {
      if (c === this.root || !(c instanceof HTMLElement) || c.classList.contains('ws-game-toasts')) continue;
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

  render(): void {
    const g = this.o.goods[this.i];
    if (!g) return;
    const st = this.o.state(g), goods = this.o.goods;
    this.count.textContent = `${this.i + 1} / ${goods.length}`;
    this.purse.innerHTML = `<i class="ws-shop-coin">${COIN}</i><b>${this.o.coins()}</b>`;
    this.card.className = `ws-shop-card ${st}`;
    this.card.replaceChildren();
    el('i', 'ws-shop-icon', this.card, icon(g.icon)); text('b', 'ws-shop-name', g.name, this.card);
    el('span', 'ws-shop-rule', this.card); text('span', 'ws-shop-does', g.does, this.card);
    if (st === 'owned') text('span', 'ws-shop-stamp', 'Owned', this.card);
    else { const price = text('span', 'ws-shop-price', String(g.price), this.card); el('i', 'ws-shop-coin', price, COIN); }
    this.dots.innerHTML = goods.map((x, k) => `<i class="${k === this.i ? 'on' : ''}${this.o.state(x) === 'owned' ? ' got' : ''}"></i>`).join('');
    this.buy.className = `ws-shop-buy ${st}`;
    this.buy.disabled = st !== 'buy';
    this.buy.textContent = st === 'owned' ? 'Owned' : st === 'locked' ? `Needs ${this.o.needs(g)}` : `Buy · ${g.price}`;
    if (st === 'short' || st === 'buy') el('i', 'ws-shop-coin', this.buy, COIN);
    if (st === 'short') text('small', '', `Need ${g.price - this.o.coins()} more`, this.buy);
  }

  private tryBuy(): void {
    const g = this.shown;
    if (!g || this.o.state(g) !== 'buy') return;
    if (this.onBuy?.(g) !== true) return;
    this.render();
    this.card.classList.remove('sold'); void this.card.offsetWidth; this.card.classList.add('sold');
    this.purse.classList.remove('spent'); void this.purse.offsetWidth; this.purse.classList.add('spent');
  }

  dispose(): void { this.close(); this.scope.dispose(); }
}
