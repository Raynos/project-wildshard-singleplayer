/**
 * The lodge's contract board and the collectibles' counter (PINE-HOLLOW-REMASTER PH-C6 / C8) — declared panels the
 * platform draws in `#hud` (SHARD-PLATFORM SF28: each panel's content is data, `@wildshard/sdk/panels`), styled
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
import { DeclaredPanel, declarePanel, mountPanel, type PanelNode } from '@wildshard/sdk/panels';
import { isFilled, type Board, type Contract } from './contracts';
import { itemName } from './trades';

/** what a contract pays, as the notice says it */
export function rewardLine(c: Contract): string {
  const parts = c.reward.items.map((i) => `${i.n} ${itemName(i.id, i.n)}`);
  if (c.reward.bolts > 0) parts.push(`${c.reward.bolts} bolts`);
  return parts.join(' · ');
}

/** a lodge panel: the frame, its kicker and title, the body the content fills, CLOSE */
const panelFrame = (cls: string, kicker: string, title: string): PanelNode => ({ cls: `ws-ph-panel ${cls}`, children: [
  { cls: 'ws-ph-frame', children: [
    { cls: 'ws-ph-head', children: [{ cls: 'ws-ph-kicker', text: kicker }, { cls: 'ws-ph-title', text: title }] },
    { cls: 'ws-ph-body', ref: 'body' },
  ] },
  { tag: 'button', cls: 'ws-ph-close', button: 'button', text: 'Close', ref: 'close' },
] });

const NOTE_TILT = [-1.2, 0.8, -0.5] as const;
const noteKind = (c: Contract): string => c.kind === 'species' ? 'Game' : c.kind === 'rarity' ? 'Rare coat' : c.kind === 'elite' ? 'Wanted' : 'Cull';

/** the board's body as data: the tally, one pinned notice per slot (refs `claim.<i>` / `tear.<i>`), the foot */
export function boardRows(b: Board): PanelNode[] {
  return [
    { cls: 'ws-ph-tally', children: [
      { tag: 'span', cls: '', text: `Claimed ${b.claimed}` },
      { tag: 'span', cls: '', text: `In a row ${b.streak}` },
      { tag: 'span', cls: '', text: `Best ${b.best}` },
    ] },
    ...b.slots.map((c, i): PanelNode => ({
      cls: `ws-ph-note${isFilled(c) ? ' filled' : ''}`, props: [['--tilt', `${NOTE_TILT[i] ?? 0}deg`]], children: [
        { tag: 'i', cls: 'ws-ph-pin' },
        { cls: 'ws-ph-note-kind', text: noteKind(c) },
        { cls: 'ws-ph-note-title', text: c.title },
        { cls: 'ws-ph-note-goal', text: c.goal },
        { cls: 'ws-ph-note-bar', children: [
          ...Array.from({ length: c.need }, (_, k): PanelNode => ({ tag: 'i', cls: k < c.have ? 'on' : '' })),
          { tag: 'b', cls: 'ws-ph-note-count', text: `${c.have} / ${c.need}` },
        ] },
        { cls: 'ws-ph-note-pay', text: `Pays ${rewardLine(c)}` },
        { cls: 'ws-ph-note-row', children: [
          ...(isFilled(c) ? [{ tag: 'button', cls: 'ws-ph-seal', button: 'button', text: 'Claim', ref: `claim.${i}` } satisfies PanelNode] : []),
          { tag: 'button', cls: 'ws-ph-tear', button: 'button', text: 'Tear down', ref: `tear.${i}` },
        ] },
      ],
    })),
    { cls: 'ws-ph-foot', text: 'A filled notice is claimed here. Tearing one down posts the next and ends your run.' },
  ];
}

export class BoardPanel extends DeclaredPanel {
  onClaim?: (i: number) => void;
  onReroll?: (i: number) => void;
  constructor(private readonly board: () => Board, scope = new Scope('quest.board')) {
    super(() => panelFrame('ws-ph-board', 'The hunting lodge', 'Contracts'), scope,
      { showClass: 'show', closeRef: 'close', closeKeys: ['Escape', 'KeyE'], stopEvents: ['pointerdown'] });
  }
  override render(): void {
    const b = this.board();
    const scope = this.renderRows(boardRows(b));
    b.slots.forEach((_c, i) => {
      if (this.view.has(`claim.${i}`)) this.view.on(`claim.${i}`, 'click', (e) => { e.stopPropagation(); this.onClaim?.(i); this.render(); }, scope);
      this.view.on(`tear.${i}`, 'click', (e) => { e.stopPropagation(); this.onReroll?.(i); this.render(); }, scope);
    });
  }
}

/** "AMBER RESIN 4 / 30" under the quest chip */
const COUNT_CHIP: PanelNode = { cls: 'ws-ph-count', children: [
  { tag: 'span', cls: 'ws-ph-count-label', ref: 'label' },
  { tag: 'b', cls: 'ws-ph-count-n', ref: 'n' },
] };

export class CountChip {
  private readonly view = declarePanel(COUNT_CHIP);
  readonly root = this.view.root;
  private readonly scope: Scope;
  private timer: Scope | null = null;
  constructor(scope = new Scope('quest.count')) {
    this.scope = scope;
    mountPanel(this.view, scope);
  }
  show(label: string, n: number, of: number): void {
    if (this.scope.disposed) return;
    this.view.text('label', label);
    this.view.text('n', `${n} / ${of}`);
    this.view.restart('', 'show');
    this.view.flag('', 'full', n >= of);
    this.timer?.dispose();
    const timer = this.scope.child('hide');
    this.timer = timer;
    timer.timeout(3600, () => { this.view.flag('', 'show', false); timer.dispose(); });
  }
}
