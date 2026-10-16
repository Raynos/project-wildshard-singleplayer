/**
 * The trader's goods (E314 stage 2, project/archive/2026-09-30-driftwood-loot.md — Jake's picks 2026-09-30): six permanent things, each
 * bought once, BUY only (no selling), in the order the shop card flips through them. Pure: the shop screen
 * (src/shards/driftwood-isle/loot/ShopPanel.ts) renders `goodState`, `buyGood` spends the purse and grants the Owned id, and the effects read
 * Owned through the live EffectService binding (loot/effects.ts); the Bag borrows that player's health.
 *
 *   goodState(good, owned, coins)  → 'owned' | 'locked' (a II before its I) | 'short' (too few coins) | 'buy'
 *   buyGood(good, owned, purse)    → true when bought (coins taken, the id granted); false changes nothing
 */
import type { OwnedId } from '@wildshard/game/loot/Owned';
import type { declaredLootEconomy } from '@wildshard/game/shard/declaredRows';

/**
 * PRICES — coins are capped per enemy (Bounty.ts), so the island holds a fixed purse: one full clear of Driftwood is
 * FULL_CLEAR = 92 coins (`window.__loot.fullClear` on a Driftwood build after the E318 cuts, 2026-09-30: 11 boars × 2,
 * 2 bears × 10, 9 crabs × 1, 11 monkeys × 1, the drowned sailor 5, the Drowned Captain 25 — no deer; coins.ts values).
 * The six goods add up to 90 (98 % of it), so buying everything takes about one full clear; the IIs are the dearest,
 * the cape the cheapest.
 */

export type Good = ReturnType<typeof declaredLootEconomy>['goods'][number];

export type GoodState = 'owned' | 'locked' | 'short' | 'buy';

export interface OwnedView { has: (id: OwnedId) => boolean }

export function goodState(g: Good, owned: OwnedView, coins: number): GoodState {
  if (owned.has(g.id)) return 'owned';
  if (g.needs !== undefined && !owned.has(g.needs)) return 'locked';
  return coins < g.price ? 'short' : 'buy';
}

export function buyGood(g: Good, owned: OwnedView & { grant: (id: OwnedId) => boolean }, purse: { coins: number; spend: (n: number) => boolean }): boolean {
  if (goodState(g, owned, purse.coins) !== 'buy') return false;
  if (!purse.spend(g.price)) return false;
  owned.grant(g.id);
  return true;
}

export const goodById = (goods: readonly Good[], id: OwnedId): Good | undefined => goods.find((g) => g.id === id);
