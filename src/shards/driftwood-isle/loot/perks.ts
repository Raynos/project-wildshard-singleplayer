/**
 * What the things you own DO (E314, project/archive/2026-09-30-driftwood-loot.md): one place that turns the Owned store into numbers, so
 * the fight code reads a number and never an item id. Pure (no DOM, no three), tested in test/keepsakes.test.ts.
 *
 *   (max health — the trader's hearts and sea glass charm I's +10 — is shop.ts's `maxHealthOf`, stage 2's)
 *   dodgeCooldownScale(owned) charm II (10 pieces): the dodge recharges 30 % faster (0.8 s → 0.56 s, Player.DODGE_COOLDOWN)
 *   nightGlow(owned, night)   charm III (15 pieces): the held sword's sea-glass glow, 0 by day → 1 at full night
 *   heavyMult(owned)          the bear claw: the charged heavy hits 20 % harder (wood 24 → 29, iron 56 → 67)
 *   dodgeGuard(owned)         the boar tusk: a hit that lands while a dodge is carrying you does nothing (dodge i-frames)
 *
 * Every shard has an Owned store, but only Driftwood grants hearts, charms and trophies, so elsewhere these are the
 * defaults (×1, 0, ×1, false).
 */
import type { OwnedId } from '@wildshard/game/loot/Owned';
import { DRIFTWOOD_EFFECTS } from './effects';

const effect = (id: string) => {
  const row = DRIFTWOOD_EFFECTS.find((def) => def.id === id);
  if (row === undefined) throw new Error(`Missing keepsake effect ${id}`);
  return row;
};

export interface OwnedReader { has: (id: OwnedId) => boolean }

/** charm II: the dodge's cooldown × this (0.8 s today → 0.56 s) */
export const CHARM_DODGE = effect('effect.charm.2').modifiers[0]?.value ?? 1;
/** the bear claw: the heavy's damage × this */
export const CLAW_HEAVY = effect('effect.bear-claw').modifiers[0]?.value ?? 1;

export const dodgeCooldownScale = (o: OwnedReader): number => (o.has('charm-2') ? CHARM_DODGE : 1);

export const heavyMult = (o: OwnedReader): number => (o.has('bear-claw') ? CLAW_HEAVY : 1);

export const dodgeGuard = (o: OwnedReader): boolean => o.has('boar-tusk') && effect('effect.boar-tusk').grants?.includes('guard.dodge') === true;

/** charm III's glow for the sky's `night` (0 day … 1 night): off until dusk is well in, full once it is dark */
export function nightGlow(o: OwnedReader, night: number): number {
  if (!o.has('charm-3')) return 0;
  const t = Math.max(0, Math.min(1, (night - 0.3) / 0.45));
  return t * t * (3 - 2 * t);
}

/** the sea glass pieces the chime shows for `found` pieces: whole charms only (0 / 5 / 10 / 15) */
export const chimeCount = (found: number, every = 5): number => Math.max(0, Math.floor(found / every) * every);

/** the charms `found` pieces have earned, in order */
export function charmsFor(found: number, every = 5): ('charm-1' | 'charm-2' | 'charm-3')[] {
  const all = ['charm-1', 'charm-2', 'charm-3'] as const;
  return all.slice(0, Math.max(0, Math.min(3, Math.floor(found / every))));
}
