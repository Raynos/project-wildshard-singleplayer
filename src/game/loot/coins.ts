/**
 * What a kill is worth in doubloons (E314 L1, Jake's pick board 1 A): coins come only from kills, and only on a shard
 * whose ChunkDef says `loot: { coins: true }` (Driftwood today). First-guess values, tuned after a playthrough (a run
 * earns ~60–100; the trader's goods cost 15–50, docs/plans/DRIFTWOOD-LOOT.md). No deer: Jake cut them from Driftwood
 * (their removal is a later pass), so they pay nothing meanwhile.
 *
 *   coinsFor(chunk, a.kind)   → 0 on a shard without coins, or a creature that pays nothing
 *   burstCount(n)             → how many coin meshes fly (a big purse is split over fewer coins)
 */
export const COIN_VALUES: Readonly<Record<string, number>> = {
  crab: 1,
  monkey: 1,
  boar: 2,
  sailor: 5,
  bear: 10,
  captain: 25,
};

/** the ChunkDef part the coins read (kept structural so tests and node-side code need no full def) */
export interface LootGate { loot?: { coins?: boolean } | undefined }

export const coinsOn = (def: LootGate): boolean => def.loot?.coins === true;

export function coinsFor(def: LootGate, kind: string): number {
  if (!coinsOn(def)) return 0;
  return COIN_VALUES[kind] ?? 0;
}

/** the most coin meshes one kill throws: the captain's 25 fly as 12 heavier coins */
export const MAX_BURST = 12;
export const burstCount = (n: number): number => Math.max(0, Math.min(MAX_BURST, Math.floor(n)));

/** coin i's share of a burst of `count` worth `total` (the remainder rides the first coins); the shares add up to `total` */
export function coinShare(total: number, count: number, i: number): number {
  if (count <= 0) return 0;
  const base = Math.floor(total / count), extra = total - base * count;
  return base + (i < extra ? 1 : 0);
}
