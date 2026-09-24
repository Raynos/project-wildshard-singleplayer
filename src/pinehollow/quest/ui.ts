/**
 * The mill hamlet's two screens and the collectibles' counter (PINE-HOLLOW-REMASTER PH-C6 / C8) — DOM in `#hud`, styled
 * by src/ui/styles/pinehollow.css (prefix ws-ph-):
 *
 *   BoardPanel  the lodge's contract board: three paper notices pinned to pine boards — the heading, the job, a tally,
 *               what it pays; a filled one gets a red CLAIM seal, any can be TORN DOWN for the next (the streak resets)
 *   TradePanel  Mott's chalk slate: each swap, what it takes (what you hold of it), TRADE / OWNED
 *   CountChip   "AMBER RESIN 4 / 30" slides in under the quest chip for a few seconds after a pickup
 *
 * Both panels release the pointer lock and the weapons while open (like the journal) and close on CLOSE / Esc / E.
 */
import '../../ui/styles/pinehollow.css';
import { isFilled, type Board, type Contract } from './contracts';
import { TRADES, tradeState, type Pack, type Trade } from './trades';

const hudRoot = (): HTMLElement => document.getElementById('hud') ?? document.body;
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent?: HTMLElement, text?: string): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag); e.className = cls; if (text !== undefined) e.textContent = text; parent?.append(e); return e;
};
const ITEM_NAMES: Record<string, string> = {
  'lodge-ribbon': 'lodge ribbon', 'amber-heartwood': 'amber heartwood', 'amber-resin': 'amber resin', 'deer-hide': 'deer hide',
  'boar-hide': 'boar hide', 'boar-tusk': 'boar tusk', antlers: 'antlers', 'elk-hide': 'elk hide', 'bear-pelt': 'bear pelt', 'bear-claw': 'bear claw', venison: 'venison',
};
const itemName = (id: string, n: number): string => { const w = ITEM_NAMES[id] ?? id; return n === 1 ? w : w.endsWith('s') || w.endsWith('heartwood') || w.endsWith('venison') || w.endsWith('resin') ? w : `${w}s`; };

/** what a contract pays, as the notice says it */
export function rewardLine(c: Contract): string {
  const parts = c.reward.items.map((i) => `${i.n} ${itemName(i.id, i.n)}`);
  if (c.reward.bolts > 0) parts.push(`${c.reward.bolts} bolts`);
  return parts.join(' · ');
}

abstract class Panel {
  readonly root: HTMLDivElement;
  protected readonly body: HTMLDivElement;
  onOpen?: () => void;
  onClose?: () => void;
  private open_ = false;
  constructor(cls: string, title: string, kicker: string) {
    this.root = el('div', `ws-ph-panel ${cls}`);
    const frame = el('div', 'ws-ph-frame', this.root);
    const head = el('div', 'ws-ph-head', frame);
    el('div', 'ws-ph-kicker', head, kicker);
    el('div', 'ws-ph-title', head, title);
    this.body = el('div', 'ws-ph-body', frame);
    const close = el('button', 'ws-ph-close', this.root, 'Close');
    close.type = 'button';
    close.addEventListener('click', (e) => { e.stopPropagation(); this.close(); });
    this.root.addEventListener('pointerdown', (e) => { e.stopPropagation(); });
    document.addEventListener('keydown', (e) => {
      if (!this.open_ || e.repeat) return;
      if (e.code === 'Escape' || e.code === 'KeyE') { e.preventDefault(); e.stopPropagation(); this.close(); }
    }, true);
    hudRoot().append(this.root);
  }
  get isOpen(): boolean { return this.open_; }
  open(): void {
    if (this.open_) return;
    this.open_ = true; this.render();
    this.root.classList.add('show');
    this.onOpen?.();
  }
  close(): void {
    if (!this.open_) return;
    this.open_ = false;
    this.root.classList.remove('show');
    this.onClose?.();
  }
  abstract render(): void;
}

export class BoardPanel extends Panel {
  onClaim?: (i: number) => void;
  onReroll?: (i: number) => void;
  constructor(private readonly board: () => Board) { super('ws-ph-board', 'Contracts', 'The hunting lodge'); }
  render(): void {
    const b = this.board();
    this.body.replaceChildren();
    const tally = el('div', 'ws-ph-tally', this.body);
    el('span', '', tally, `Claimed ${b.claimed}`);
    el('span', '', tally, `In a row ${b.streak}`);
    el('span', '', tally, `Best ${b.best}`);
    b.slots.forEach((c, i) => {
      const card = el('div', `ws-ph-note${isFilled(c) ? ' filled' : ''}`, this.body);
      card.style.setProperty('--tilt', `${[-1.2, 0.8, -0.5][i] ?? 0}deg`);
      el('i', 'ws-ph-pin', card);
      el('div', 'ws-ph-note-kind', card, c.kind === 'species' ? 'Game' : c.kind === 'rarity' ? 'Rare coat' : c.kind === 'elite' ? 'Wanted' : 'Cull');
      el('div', 'ws-ph-note-title', card, c.title);
      el('div', 'ws-ph-note-goal', card, c.goal);
      const bar = el('div', 'ws-ph-note-bar', card);
      for (let k = 0; k < c.need; k++) el('i', k < c.have ? 'on' : '', bar);
      el('b', 'ws-ph-note-count', bar, `${c.have} / ${c.need}`);
      el('div', 'ws-ph-note-pay', card, `Pays ${rewardLine(c)}`);
      const row = el('div', 'ws-ph-note-row', card);
      if (isFilled(c)) {
        const claim = el('button', 'ws-ph-seal', row, 'Claim');
        claim.type = 'button';
        claim.addEventListener('click', (e) => { e.stopPropagation(); this.onClaim?.(i); this.render(); });
      }
      const tear = el('button', 'ws-ph-tear', row, 'Tear down');
      tear.type = 'button';
      tear.addEventListener('click', (e) => { e.stopPropagation(); this.onReroll?.(i); this.render(); });
    });
    el('div', 'ws-ph-foot', this.body, 'A filled notice is claimed here. Tearing one down posts the next and ends your run.');
  }
}

export class TradePanel extends Panel {
  onTrade?: (t: Trade) => void;
  constructor(private readonly pack: Pack, private readonly owns: (skin: string) => boolean) { super('ws-ph-trade', 'Swaps', "Mott's stall · no coin"); }
  render(): void {
    this.body.replaceChildren();
    for (const t of TRADES) {
      const st = tradeState(t, this.pack, this.owns);
      const row = el('div', `ws-ph-swap${st.ok ? ' ok' : ''}${st.owned ? ' owned' : ''}`, this.body);
      const text = el('div', 'ws-ph-swap-text', row);
      el('div', 'ws-ph-swap-label', text, t.label);
      el('div', 'ws-ph-swap-blurb', text, t.blurb);
      const give = el('div', 'ws-ph-swap-give', text);
      for (const g of t.give) {
        const have = this.pack.count(g.item);
        el('span', have >= g.n ? 'have' : 'short', give, `${g.n} ${itemName(g.item, g.n)} (${have})`);
      }
      const btn = el('button', 'ws-ph-swap-btn', row, st.owned ? 'Owned' : 'Trade');
      btn.type = 'button'; btn.disabled = !st.ok;
      btn.addEventListener('click', (e) => { e.stopPropagation(); if (tradeState(t, this.pack, this.owns).ok) { this.onTrade?.(t); this.render(); } });
    }
  }
}

export class CountChip {
  readonly root = el('div', 'ws-ph-count');
  private label = el('span', 'ws-ph-count-label', this.root);
  private n = el('b', 'ws-ph-count-n', this.root);
  private hideT = 0;
  constructor() { hudRoot().append(this.root); }
  show(label: string, n: number, of: number): void {
    this.label.textContent = label;
    this.n.textContent = `${n} / ${of}`;
    this.root.classList.remove('show'); void this.root.offsetWidth; this.root.classList.add('show');
    this.root.classList.toggle('full', n >= of);
    window.clearTimeout(this.hideT);
    this.hideT = window.setTimeout(() => { this.root.classList.remove('show'); }, 3600);
  }
}
