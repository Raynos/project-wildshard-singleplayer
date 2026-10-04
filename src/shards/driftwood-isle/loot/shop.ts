/**
 * The trader's goods (E314 stage 2, project/archive/2026-09-30-driftwood-loot.md — Jake's picks 2026-09-30): six permanent things, each
 * bought once, BUY only (no selling), in the order the shop card flips through them. Pure: the shop screen
 * (src/shards/driftwood-isle/loot/ShopPanel.ts) renders `goodState`, `buyGood` spends the purse and grants the Owned id, and the effects read
 * Owned through `swordMul` / `maxHealthOf` (src/game/loot/install.ts wires them into the swords and main.ts's health).
 *
 *   goodState(good, owned, coins)  → 'owned' | 'locked' (a II before its I) | 'short' (too few coins) | 'buy'
 *   buyGood(good, owned, purse)    → true when bought (coins taken, the id granted); false changes nothing
 *   swordMul(owned.sharpen)        → 1 · 1.25 · 1.5 (Whetstone I / II: sword damage +25 % / +50 %, both swords)
 *   maxHealthOf(owned)             → 100 · 120 · 140 (Sturdy Heart I / II), +10 with the first sea glass charm (stage 3)
 */
import type { IconId } from '@wildshard/engine/ui/icons';
import type { OwnedId } from '@wildshard/game/loot/Owned';
import { DRIFTWOOD_EFFECTS, driftwoodAttributes } from './effects';

/**
 * PRICES — coins are capped per enemy (Bounty.ts), so the island holds a fixed purse: one full clear of Driftwood is
 * FULL_CLEAR = 92 coins (`window.__loot.fullClear` on a Driftwood build after the E318 cuts, 2026-09-30: 11 boars × 2,
 * 2 bears × 10, 9 crabs × 1, 11 monkeys × 1, the drowned sailor 5, the Drowned Captain 25 — no deer; coins.ts values).
 * The six goods add up to 90 (98 % of it), so buying everything takes about one full clear; the IIs are the dearest,
 * the cape the cheapest.
 */
export const FULL_CLEAR = 92;

export interface Good {
  id: OwnedId;
  name: string;
  /** what it does, one short line (the card's sub-line) */
  does: string;
  icon: IconId;
  price: number;
  /** bought first (a II needs its I) */
  needs?: OwnedId;
}

export const GOODS: readonly Good[] = [
  { id: 'whetstone-1', name: 'Whetstone I', does: 'Sword damage +25 %', icon: 'whetstone', price: 12 },
  { id: 'whetstone-2', name: 'Whetstone II', does: 'Sword damage +50 %', icon: 'whetstone', price: 22, needs: 'whetstone-1' },
  { id: 'heart-1', name: 'Sturdy Heart I', does: 'Max health 120', icon: 'heart', price: 14 },
  { id: 'heart-2', name: 'Sturdy Heart II', does: 'Max health 140', icon: 'heart', price: 22, needs: 'heart-1' },
  { id: 'sea-chart', name: 'Sea chart', does: 'Unfound sea glass on the map', icon: 'chart', price: 12 },
  { id: 'cape', name: 'Sailcloth cape', does: 'A look · worn from GEAR', icon: 'cape', price: 8 },
];

export const goodsTotal = (): number => GOODS.reduce((s, g) => s + g.price, 0);

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

export const goodById = (id: OwnedId): Good | undefined => GOODS.find((g) => g.id === id);

/** the sword's damage multiplier for the whetstones owned (0 · 1 · 2) */
export const swordMul = (sharpen: number): number => DRIFTWOOD_EFFECTS.find((def) => def.id === (sharpen >= 2 ? 'effect.whetstone.2' : sharpen >= 1 ? 'effect.whetstone.1' : ''))?.modifiers[0]?.value ?? 1;

export const BASE_HEALTH = 100;
/** max health: 100, +20 a sturdy heart (120 · 140), +10 for the first sea glass charm (the chime at 5 pieces, stage 3) */
export function maxHealthOf(owned: OwnedView): number {
  return driftwoodAttributes(owned).attributes['maxHealth'] ?? BASE_HEALTH;
}
