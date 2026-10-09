import * as v from 'valibot';
import { DEFAULT_PACK_SLOTS, addInventory, type InventoryState } from '@wildshard/game/inventoryLaw';
import { DRIFTWOOD_ITEMS } from '../quest/rows';

const positive = v.pipe(v.number(), v.finite(), v.integer(), v.minValue(1), v.maxValue(Number.MAX_SAFE_INTEGER));
const Saved = v.strictObject({ counts: v.record(v.string(), positive), order: v.pipe(v.array(v.string()), v.maxLength(DEFAULT_PACK_SLOTS)) });

/** Driftwood's authored pack, using the page's admission and stacking law; doubloons are items, never purse coins. */
export class DriftwoodPack {
  private state: InventoryState<string> = { counts: {}, order: [] };
  private readonly kinds = new Set(DRIFTWOOD_ITEMS.map(row => row.id));
  private readonly policy = { has: (id: string): boolean => this.kinds.has(id), keeps: (): boolean => true, slots: (): number => DEFAULT_PACK_SLOTS };

  /** Admit an actual chest's content once its prompt succeeds. Unknown kinds are refused, as by the page. */
  add(id: string, n = 1): boolean {
    v.parse(positive, n);
    if ((this.state.counts[id] ?? 0) + n > Number.MAX_SAFE_INTEGER) throw new RangeError('Driftwood pack stack exceeds its exact bound');
    return addInventory(this.state, this.policy, id, n);
  }

  /** Current stack, including zero for a kind not held. */
  count(id: string): number { return this.state.counts[id] ?? 0; }

  /** Plain copied continuation in first-pickup order; observing it mutates neither the pack nor the world. */
  snapshot(): { counts: Record<string, number>; order: string[] } {
    return { counts: Object.fromEntries(this.state.order.map(id => [id, this.count(id)])), order: [...this.state.order] };
  }

  /** Restore exactly the admitted roster without pickups, RNG draws, facts or writes; reject impossible continuations. */
  restore(value: unknown): void {
    const saved = v.parse(Saved, value), ids = new Set(saved.order);
    if (ids.size !== saved.order.length || Object.keys(saved.counts).length !== ids.size
      || saved.order.some(id => !this.kinds.has(id) || saved.counts[id] === undefined)
      || Object.keys(saved.counts).some(id => !ids.has(id))) throw new Error('Incompatible Driftwood pack continuation');
    this.state = { counts: { ...saved.counts }, order: [...saved.order] };
  }
}
