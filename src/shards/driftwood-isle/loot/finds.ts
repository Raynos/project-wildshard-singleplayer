/**
 * Driftwood's FINDS (E314 L5, board 7 B): what the sticker book shows, read from the saved flags and Owned — pure, so the
 * counts are tested (test/loot.test.ts).
 *   sea glass:    the 15 beach pieces' flags (`glass:1…15`, src/shards/driftwood-isle/data/interactables.ts) — ONLY those: the pack's
 *                 "Sea glass" items (the old sailor drop) never count, so the number can't drift (the audit's double count)
 *   places:       `seen:<id>` for the 9 named places (src/shards/driftwood-isle/quest/Places.ts)
 *   glyph shards: `shard:lookout` / `shard:wreck` / `shard:cave`
 *   trophies:     Owned 'bear-claw' · 'boar-tusk' · 'captain-hat' (stage 3 hands them out)
 *   treasures:    the reef's pearl necklace, `found:reef-treasure`
 *   next charm:   every 5 pieces (5 → I, 10 → II, 15 → III)
 * And the sea chart's marks (E314 stage 2, `seaChartMarks`): every beach piece not found yet, where it lies, in its colour.
 */
import { SEA_GLASS_COUNT, SEA_GLASS_FLAG } from '../data/interactables';

export interface FlagReader { has: (flag: string) => boolean }

export const CHARM_EVERY = 5;

/** the sea glass count the next charm needs, or null once all three are strung */
export function nextCharmAt(found: number): number | null {
  const next = (Math.floor(found / CHARM_EVERY) + 1) * CHARM_EVERY;
  return next > SEA_GLASS_COUNT ? null : next;
}

export function seaGlassFound(flags: FlagReader): boolean[] {
  return Array.from({ length: SEA_GLASS_COUNT }, (_, i) => flags.has(`${SEA_GLASS_FLAG}${i + 1}`));
}

/** Filter the authored world-space marks without rebuilding placement or reading the interaction table. */
export function seaChartMarks(flags: FlagReader, marks: readonly { flag: string; x: number; z: number; color: string }[]): { x: number; z: number; color: string }[] {
  return marks.filter(row => !flags.has(row.flag)).map(({ x, z, color }) => ({ x, z, color }));
}
