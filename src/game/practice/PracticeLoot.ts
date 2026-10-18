import type { Scene, Vector3 } from 'three';
import type { Scope } from '@wildshard/engine/app/scope';
import { CoinBurst } from '../loot/CoinBurst';
import { rollLoot } from '../loot/tables';

export interface PracticeLootReceipt {
  readonly scope: 'practice';
  readonly coins: number;
  readonly complete: boolean;
}
export interface PracticeLootOptions {
  readonly owner: Scope;
  readonly scene: Scene;
  readonly player: Vector3;
  readonly onCollect?: (receipt: PracticeLootReceipt) => void;
}

/** Real authored coin drops and collection, paid only to an immutable, bout-local receipt.
 * No inventory, purse, bounty, quest or world event service is reachable from this adapter.
 */
export class PracticeLoot {
  private readonly scope: Scope;
  private readonly burst: CoinBurst;
  private dropped = false;
  private current: PracticeLootReceipt = Object.freeze({ scope: 'practice', coins: 0, complete: false });

  constructor(private readonly options: PracticeLootOptions) {
    this.scope = options.owner.child('practice-loot');
    this.burst = this.scope.run(() => new CoinBurst(options.scene));
    this.scope.onDispose(() => this.burst.dispose());
  }

  get receipt(): PracticeLootReceipt { return this.current; }
  get inFlight(): number { return this.burst.inFlight; }

  /** Claim at most one defeat per bout. Retrying creates a fresh adapter and empty receipt. */
  drop(creature: { kind: string; variant?: string; position: Vector3 }): boolean {
    if (this.scope.disposed || this.dropped) return false;
    this.dropped = true;
    const coins = rollLoot('coins', creature).reduce((sum, row) => sum + (row.item === 'coin' ? row.count : 0), 0);
    if (coins <= 0) { this.publish(0, true); return true; }
    this.burst.spawn(creature.position, coins,
      share => { if (!this.scope.disposed) this.publish(this.current.coins + share, false); },
      () => { if (!this.scope.disposed) this.publish(this.current.coins, true); });
    // Publish instance transforms immediately so a defeat cannot leave the drop invisible for a frame.
    this.burst.update(0, this.options.player);
    return true;
  }

  private publish(coins: number, complete: boolean): void {
    this.current = Object.freeze({ scope: 'practice', coins, complete });
    this.options.onCollect?.(this.current);
  }

  update(dt: number): void {
    if (!this.scope.disposed && Number.isFinite(dt) && dt > 0) this.burst.update(dt, this.options.player);
  }

  dispose(): void { this.scope.dispose(); }
}
