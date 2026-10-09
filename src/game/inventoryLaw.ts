/** The shipping pack limit when its shard has not authored a different policy. */
export const DEFAULT_PACK_SLOTS = 12;

/** Renderer-free pack state; the page owns persistence, catalogues and change notifications. */
export interface InventoryState<K extends string> {
  counts: Partial<Record<K, number>>;
  order: K[];
}

/** Runtime admission of a kind and the current slot limit, supplied by the owning shard. */
export interface InventoryPolicy<K extends string> {
  has: (id: K) => boolean;
  keeps: (id: K) => boolean;
  slots: () => number;
}

/** Stack a kept kind in first-pickup order. Existing stacks do not consume another slot. */
export function addInventory<K extends string>(state: InventoryState<K>, policy: InventoryPolicy<K>, id: K, n = 1): boolean {
  if (!policy.has(id) || !policy.keeps(id)) return false;
  if (!state.order.includes(id)) {
    if (state.order.length >= policy.slots()) return false;
    state.order.push(id);
  }
  state.counts[id] = (state.counts[id] ?? 0) + n;
  return true;
}

/** Trade all or nothing; nonpositive requests succeed without mutation, as in the saved page pack. */
export function takeInventory<K extends string>(state: InventoryState<K>, id: K, n = 1): boolean {
  const have = state.counts[id] ?? 0;
  if (n <= 0 || have < n) return n <= 0;
  if (have === n) {
    delete state.counts[id];
    state.order = state.order.filter((other) => other !== id);
  } else state.counts[id] = have - n;
  return true;
}
