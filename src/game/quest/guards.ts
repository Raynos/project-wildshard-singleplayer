/**
 * The iron sword's guard (B4 / D6), as a pure rule: the sword on the hold's rack is guarded while a drowned sailor
 * stands (or waits under the deck) — not by a saved "beaten once" flag. The sailor comes back after a reload and after
 * dark (Ecology.ts), and the sword is only taken for the session (Weapons does not persist it), so the saved flag
 * would leave a free sword next to a living guard. The quest's own flags (`dead:sailor` → the hold key) stay as they are.
 *
 *   drop.guard = () => ironSwordGuard(animals.animals);
 */
export const SWORD_GUARDED = 'The drowned sailor guards the rack';

export function ironSwordGuard(animals: readonly { kind: string; alive: boolean }[]): string | null {
  for (const a of animals) if (a.kind === 'sailor' && a.alive) return SWORD_GUARDED;
  return null;
}
