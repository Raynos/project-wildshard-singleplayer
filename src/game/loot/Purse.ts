/**
 * Purse — a shard's doubloons (E314 L1, docs/plans/DRIFTWOOD-LOOT.md): Driftwood's one currency. Coins come only from
 * kills (src/game/loot/coins.ts); stage 2's trader spends them. Saved per shard in localStorage ('ws.purse.v1'), the
 * Inventory pattern. Whole coins only; never below 0.
 *
 *   const purse = new Purse(chunk.id);
 *   purse.add(2);                 // a kill's coins landed (the coin burst adds on arrival)
 *   purse.spend(15)               // → false, nothing taken, when there are fewer
 *   purse.coins                   // the total (the HUD chip, GEAR)
 *   purse.onChange((n, delta) => chip.set(n))   // returns an unsubscribe
 */
import { readShard, writeShard } from './store';

const STORE = 'ws.purse.v1';

export class Purse {
  private n: number;
  private listeners: ((coins: number, delta: number) => void)[] = [];

  constructor(readonly shard: string) {
    const saved = readShard(STORE, shard);
    this.n = typeof saved === 'number' && Number.isFinite(saved) && saved > 0 ? Math.floor(saved) : 0;
  }

  get coins(): number { return this.n; }

  add(n: number): void {
    const k = Math.floor(n);
    if (!(k > 0)) return;
    this.set(this.n + k);
  }

  /** take `n` coins; false (nothing taken) when the purse holds fewer */
  spend(n: number): boolean {
    const k = Math.floor(n);
    if (k <= 0) return true;
    if (this.n < k) return false;
    this.set(this.n - k);
    return true;
  }

  onChange(fn: (coins: number, delta: number) => void): () => void {
    this.listeners.push(fn);
    return () => { const i = this.listeners.indexOf(fn); if (i !== -1) this.listeners.splice(i, 1); };
  }

  private set(v: number): void {
    const delta = v - this.n;
    this.n = v;
    writeShard(STORE, this.shard, v);
    for (const l of this.listeners) l(v, delta);
  }
}
