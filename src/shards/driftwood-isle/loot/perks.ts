/**
 * Keepsake presentation reads (E314, project/archive/2026-09-30-driftwood-loot.md).
 * Gameplay attributes and tags come from the shared EffectService via loot/effects.ts.
 *   nightGlow(owned, night)   charm III (15 pieces): the held sword's sea-glass glow, 0 by day → 1 at full night
 */
import type { OwnedId } from '@wildshard/game/loot/Owned';

export interface OwnedReader { has: (id: OwnedId) => boolean }

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
