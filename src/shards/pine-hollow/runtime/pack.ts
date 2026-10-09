import * as v from 'valibot';
import { addInventory, takeInventory, type InventoryState } from '@wildshard/game/inventoryLaw';
import { PINE_PACK_KINDS, PINE_PACK_SLOTS, type PineItem } from '../items';

const kind = v.picklist(PINE_PACK_KINDS);
/** The seven authored pack kinds, bounded for the headless continuation; the page's save format is unchanged. */
export const PinePackSchema = v.pipe(v.strictObject({
  counts: v.record(kind, v.pipe(v.number(), v.finite(), v.minValue(-1_000_000), v.maxValue(1_000_000))),
  order: v.pipe(v.array(kind), v.maxLength(PINE_PACK_SLOTS)),
}), v.check(state => new Set(state.order).size === state.order.length && Object.keys(state.counts).every(id => state.order.some(item => item === id))));

/** A renderer-free view of the authored pack; no persistence or presentation side effects. */
export interface PinePack {
  add: (id: PineItem, n?: number) => boolean;
  take: (id: PineItem, n?: number) => boolean;
  count: (id: PineItem) => number;
  snapshot: () => { counts: Record<string, number>; order: PineItem[] };
  restore: (value: unknown) => void;
}

/** Pine's renderer-free pack uses the page's shared add/trade law and actual authored keep/slot policy. */
export function createPinePack(): PinePack {
  let state: InventoryState<PineItem> = { counts: {}, order: [] };
  const policy = { has: (id: PineItem) => PINE_PACK_KINDS.includes(id), keeps: (id: PineItem) => PINE_PACK_KINDS.includes(id), slots: () => PINE_PACK_SLOTS };
  return {
    add: (id: PineItem, n = 1): boolean => addInventory(state, policy, id, n),
    take: (id: PineItem, n = 1): boolean => takeInventory(state, id, n),
    count: (id: PineItem): number => state.counts[id] ?? 0,
    snapshot: () => {
      const counts: Record<string, number> = {};
      for (let i = 0; i < 7; i++) { const id = PINE_PACK_KINDS[i]; if (id === undefined) break; const n = state.counts[id]; if (n !== undefined) counts[id] = n; }
      return { counts, order: [...state.order] };
    },
    restore: (value: unknown): void => { state = v.parse(PinePackSchema, value); },
  };
}
