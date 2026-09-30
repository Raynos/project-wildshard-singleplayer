/**
 * The loot modules' one persistence pattern (Inventory's `ws.inventory.v1`): a localStorage key holding one entry per
 * shard id. A failed read gives `undefined` (the caller's defaults); a failed write is dropped (iOS private mode, a full
 * store): the in-memory value stays the truth for the session.
 */
export function readShard(key: string, shard: string): unknown {
  try {
    const all: unknown = JSON.parse(localStorage.getItem(key) ?? '{}');
    if (typeof all !== 'object' || all === null) return undefined;
    return (all as Record<string, unknown>)[shard];
  } catch { return undefined; }
}

export function writeShard(key: string, shard: string, value: unknown): void {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(key) ?? '{}');
    const all = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
    all[shard] = value;
    localStorage.setItem(key, JSON.stringify(all));
  } catch { /* not persisted this session */ }
}
