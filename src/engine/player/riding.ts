import type { Animal } from '../entities/Animal';

/**
 * The horse under the player right now (null on foot; Mount.ts sets it on mount / dismount). A module of its own so the
 * shared HUD (Combat.ts) and main's Targets can read it without pulling the riding code into every shard.
 *
 * The aim rays look past it: `pastRidden(() => animals.raycast(…))` hides it for that one call, so you never shoot, aim
 * at or get a MISS over your own mount.
 */
export const riding: { horse: Animal | null } = { horse: null };

export function pastRidden<T>(fn: () => T): T {
  const h = riding.horse;
  if (h === null || h.hidden) return fn();
  h.hidden = true;
  try { return fn(); } finally { h.hidden = false; }
}
