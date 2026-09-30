/**
 * CoinChip — the purse on the HUD (E314 L1, board 1 A): a small "◉ 23" chip under VITALS in the base HUD's language
 * (navy glass, a cyan hairline, the display numerals), and the "+n" that pops over a kill. On touch it is a row of the
 * top-left status column (src/ui/hudSlots.ts, after VITALS and the ammo strip); with a mouse it sits over the VITALS
 * panel, bottom-left. Styled by src/ui/styles/loot.css (prefix ws-loot-). Only built on a shard with coins.
 *
 *   const chip = new CoinChip(purse.coins);
 *   chip.set(n)                  // the total (bumps when it grows)
 *   chip.pop(x, y, n)            // "+n" at a screen point (CSS px), floats up and fades
 *   chip.dispose()
 */
import './styles/loot.css';
import { hudSlots } from './hudSlots';

/** the status column's order: after VITALS (0) and the ammo strip (1) — a shard with coins has no steed row (2) */
const PURSE_ROW = 2;
const POPS = 4;
const COIN_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#f2c44d"/><circle cx="12" cy="12" r="6.6" fill="none" stroke="#9c6a12" stroke-width="1.8"/><circle cx="12" cy="12" r="2.2" fill="#9c6a12"/></svg>';

export class CoinChip {
  readonly root: HTMLElement;
  private num: HTMLElement;
  private pops: HTMLElement[] = [];
  private nextPop = 0;
  private shown = -1;

  constructor(coins: number) {
    this.root = document.createElement('div');
    this.root.className = 'ws-loot-chip';
    this.root.innerHTML = `<i class="ws-loot-coin">${COIN_SVG}</i><b class="ws-loot-num">0</b>`;
    const num = this.root.querySelector<HTMLElement>('.ws-loot-num');
    if (!num) throw new Error('CoinChip: no .ws-loot-num');
    this.num = num;
    const hud = document.getElementById('hud') ?? document.body;
    for (let i = 0; i < POPS; i++) {
      const p = document.createElement('div'); p.className = 'ws-loot-pop';
      hud.append(p); this.pops.push(p);
    }
    this.set(coins, false);
    // docked in #hud (a mouse device: over the VITALS panel, bottom-left); when the touch layer mounts, the status column
    // takes it (hudSlots appends it there — now, or on mount) and loot.css styles it as a row
    hud.append(this.root);
    hudSlots.statusRow(this.root, PURSE_ROW, false);
  }

  set(coins: number, bump = true): void {
    if (coins === this.shown) return;
    const grew = coins > this.shown && this.shown >= 0;
    this.shown = coins;
    this.num.textContent = String(coins);
    if (bump && grew) { this.root.classList.remove('bump'); void this.root.offsetWidth; this.root.classList.add('bump'); }
  }

  pop(x: number, y: number, n: number): void {
    const p = this.pops[this.nextPop];
    if (!p) return;
    this.nextPop = (this.nextPop + 1) % this.pops.length;
    p.innerHTML = `+${n}<i class="ws-loot-coin">${COIN_SVG}</i>`;
    p.style.left = `${x}px`; p.style.top = `${y}px`;
    p.classList.remove('show'); void p.offsetWidth; p.classList.add('show');
  }

  dispose(): void {
    this.root.remove();
    for (const p of this.pops) p.remove();
  }
}
