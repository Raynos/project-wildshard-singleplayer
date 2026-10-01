/**
 * Purse — a shard's doubloons (E314 L1, project/archive/2026-09-30-driftwood-loot.md): Driftwood's one currency. Coins come only from
 * kills (src/game/loot/coins.ts); stage 2's trader spends them. Saved per shard in localStorage ('ws.purse.v1'), the
 * Inventory pattern. Whole coins only; never below 0.
 *
 *   const purse = new Purse(chunk.id);
 *   purse.add(2);                 // coins in, saved at once
 *   purse.add(2, false)           // a coin of a burst landed: counted and told, not written (a captain = 12 landings)
 *   purse.flush()                 // write what is unsaved — the burst's end (CoinBurst onDone), pagehide, a hidden tab
 *   purse.spend(15)               // → false, nothing taken, when there are fewer (saved at once)
 *   purse.coins                   // the total (the HUD chip, GEAR)
 *   purse.onChange((n, delta) => chip.set(n))   // returns an unsubscribe
 */
import { purseSave, saveSlug } from '../saves';


export class Purse {
  private n: number;
  private dirty = false;
  private listeners: ((coins: number, delta: number) => void)[] = [];

  constructor(readonly shard: string) {
    const saved = purseSave.read(saveSlug(shard));
    this.n = typeof saved === 'number' && Number.isFinite(saved) && saved > 0 ? Math.floor(saved) : 0;
  }

  get coins(): number { return this.n; }
  /** coins counted but not written yet */
  get unsaved(): boolean { return this.dirty; }

  add(n: number, save = true): void {
    const k = Math.floor(n);
    if (!(k > 0)) return;
    this.set(this.n + k, save);
  }

  /** take `n` coins; false (nothing taken) when the purse holds fewer */
  spend(n: number): boolean {
    const k = Math.floor(n);
    if (k <= 0) return true;
    if (this.n < k) return false;
    this.set(this.n - k, true);
    return true;
  }

  flush(): void {
    if (!this.dirty) return;
    this.dirty = false;
    purseSave.write(this.n, saveSlug(this.shard));
  }

  onChange(fn: (coins: number, delta: number) => void): () => void {
    this.listeners.push(fn);
    return () => { const i = this.listeners.indexOf(fn); if (i !== -1) this.listeners.splice(i, 1); };
  }

  private set(v: number, save: boolean): void {
    const delta = v - this.n;
    this.n = v;
    this.dirty = true;
    if (save) this.flush();
    for (const l of this.listeners) l(v, delta);
  }
}
