/**
 * The lodge's contract board and the collectibles' counter (PINE-HOLLOW-REMASTER PH-C6 / C8) — DOM in `#hud`, styled
 * by src/shards/pine-hollow/quest/pinehollow.css (prefix ws-ph-):
 *
 *   BoardPanel  the lodge's contract board: three paper notices pinned to pine boards — the heading, the job, a tally,
 *               what it pays; a filled one gets a red CLAIM seal, any can be TORN DOWN for the next (the streak resets)
 *   CountChip   "AMBER RESIN 4 / 30" slides in under the quest chip for a few seconds after a pickup
 *
 * Mott's stall is no longer here: the platform's ShopPanel draws it from data as the G87 sheet (SHARD-PLATFORM SF28, G181;
 * the goods and rules in ./trades.ts). The board releases the pointer lock and the weapons while open (like
 * the journal) and closes on CLOSE / Esc / E.
 */
import './pinehollow.css';
import { Scope } from '@wildshard/engine/app/scope';
import { listenPage } from '@wildshard/engine/input/dom';
import { isFilled, type Board, type Contract } from './contracts';
import { itemName } from './trades';

const hudRoot = (): HTMLElement => document.getElementById('hud') ?? document.body;
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent?: HTMLElement, text?: string): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag); e.className = cls; if (text !== undefined) e.textContent = text; parent?.append(e); return e;
};

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
  private readonly scope: Scope;
  private rows: Scope | null = null;
  constructor(cls: string, title: string, kicker: string, scope: Scope) {
    this.scope = scope;
    this.root = el('div', `ws-ph-panel ${cls}`);
    const frame = el('div', 'ws-ph-frame', this.root);
    const head = el('div', 'ws-ph-head', frame);
    el('div', 'ws-ph-kicker', head, kicker);
    el('div', 'ws-ph-title', head, title);
    this.body = el('div', 'ws-ph-body', frame);
    const close = el('button', 'ws-ph-close', this.root, 'Close');
    close.type = 'button';
    scope.listen(close, 'click', (e) => { e.stopPropagation(); this.close(); });
    scope.listen(this.root, 'pointerdown', (e) => { e.stopPropagation(); });
    listenPage(scope, 'keydown', (event) => {
      const e = event;
      if (!this.open_ || e.repeat) return;
      if (e.code === 'Escape' || e.code === 'KeyE') { e.preventDefault(); e.stopPropagation(); this.close(); }
    }, { capture: true, on: 'document' });
    hudRoot().append(this.root);
    scope.onDispose(() => { this.open_ = false; this.root.remove(); });
  }
  get isOpen(): boolean { return this.open_; }
  protected renderScope(): Scope {
    this.rows?.dispose();
    this.body.replaceChildren();
    this.rows = this.scope.child('rows');
    return this.rows;
  }
  open(): void {
    if (this.open_ || this.scope.disposed) return;
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
  constructor(private readonly board: () => Board, scope = new Scope('quest.board')) { super('ws-ph-board', 'Contracts', 'The hunting lodge', scope); }
  render(): void {
    const b = this.board();
    const scope = this.renderScope();
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
        scope.listen(claim, 'click', (e) => { e.stopPropagation(); this.onClaim?.(i); this.render(); });
      }
      const tear = el('button', 'ws-ph-tear', row, 'Tear down');
      tear.type = 'button';
      scope.listen(tear, 'click', (e) => { e.stopPropagation(); this.onReroll?.(i); this.render(); });
    });
    el('div', 'ws-ph-foot', this.body, 'A filled notice is claimed here. Tearing one down posts the next and ends your run.');
  }
}

export class CountChip {
  readonly root = el('div', 'ws-ph-count');
  private label = el('span', 'ws-ph-count-label', this.root);
  private n = el('b', 'ws-ph-count-n', this.root);
  private readonly scope: Scope;
  private timer: Scope | null = null;
  constructor(scope = new Scope('quest.count')) {
    this.scope = scope;
    hudRoot().append(this.root);
    scope.onDispose(() => { this.root.remove(); });
  }
  show(label: string, n: number, of: number): void {
    if (this.scope.disposed) return;
    this.label.textContent = label;
    this.n.textContent = `${n} / ${of}`;
    this.root.classList.remove('show'); void this.root.offsetWidth; this.root.classList.add('show');
    this.root.classList.toggle('full', n >= of);
    this.timer?.dispose();
    const timer = this.scope.child('hide');
    this.timer = timer;
    timer.timeout(3600, () => { this.root.classList.remove('show'); timer.dispose(); });
  }
}
