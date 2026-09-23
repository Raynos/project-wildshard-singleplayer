/**
 * Detail tiers for Explore's DETAIL TIERS view (EXPLORE-WORLD.md X7): build a model as another tier would, and the
 * budgets a frame is held to.
 *
 *   withTier('phone', () => new Palms(sky).build([spec]).mesh)   // TIER_CONFIG reads the phone table while fn runs
 *
 * The model modules read `TIER_CONFIG.*` (palmFrondSegs, bushDetail, …) synchronously inside build(), so swapping the
 * live config object's fields for the call and putting them back is enough — nothing else runs in between.
 */
import { TIER, TIER_CONFIG, TIER_TABLE, type Tier } from '../core/tier';

export const TIERS: readonly Tier[] = ['phone', 'desktop'];
export const CURRENT_TIER: Tier = TIER;

/** the frame budgets (project/archive/2026-09-22-play-perf.md): phone ≤ 150 calls / ≤ 2.0 M tris; desktop ≤ 300 calls */
export const BUDGET: Record<Tier, { calls: number; tris: number }> = { phone: { calls: 150, tris: 2_000_000 }, desktop: { calls: 300, tris: 4_000_000 } };

export function withTier<T>(tier: Tier, fn: () => T): T {
  if (tier === TIER) return fn();
  const live = TIER_CONFIG as Record<string, unknown>;
  const saved = { ...live };
  Object.assign(live, TIER_TABLE[tier]);
  try { return fn(); } finally {
    for (const k of Object.keys(live)) if (!(k in saved)) Reflect.deleteProperty(live, k);
    Object.assign(live, saved);
  }
}
