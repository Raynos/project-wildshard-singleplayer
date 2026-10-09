/**
 * Driftwood's FINDS (E314 L5, board 7 B): what the sticker book shows, read from the saved flags and Owned — pure, so the
 * counts are tested (test/loot.test.ts).
 *   sea glass:    the 15 beach pieces' flags (`glass:1…15`, src/shards/driftwood-isle/quest/interactables.ts) — ONLY those: the pack's
 *                 "Sea glass" items (the old sailor drop) never count, so the number can't drift (the audit's double count)
 *   places:       `seen:<id>` for the 9 named places (src/shards/driftwood-isle/quest/Places.ts)
 *   glyph shards: `shard:lookout` / `shard:wreck` / `shard:cave`
 *   trophies:     Owned 'bear-claw' · 'boar-tusk' · 'captain-hat' (stage 3 hands them out)
 *   treasures:    the reef's pearl necklace, `found:reef-treasure`
 *   next charm:   every 5 pieces (5 → I, 10 → II, 15 → III)
 * And the sea chart's marks (E314 stage 2, `seaChartMarks`): every beach piece not found yet, where it lies, in its colour.
 */
import type { FindsView } from '@wildshard/game/bag/bag';
import type { OwnedId } from '@wildshard/game/loot/Owned';
import { DRIFTWOOD_PLACES } from '../quest/Places';
import { DRIFTWOOD_INTERACT, SEA_GLASS_COUNT, SEA_GLASS_FLAG, SHARD_FLAGS } from '../quest/interactables';

export interface FlagReader { has: (flag: string) => boolean }
export interface OwnedReader { has: (id: OwnedId) => boolean }

const GLASS_COLORS = ['#7df0d0', '#8fd8ff', '#b7f59a', '#9fb8ff', '#f0f7a0']; // the pieces' own colours (driftwood.ts)
export const CHARM_EVERY = 5;

/** the sea glass count the next charm needs, or null once all three are strung */
export function nextCharmAt(found: number): number | null {
  const next = (Math.floor(found / CHARM_EVERY) + 1) * CHARM_EVERY;
  return next > SEA_GLASS_COUNT ? null : next;
}

export function seaGlassFound(flags: FlagReader): boolean[] {
  return Array.from({ length: SEA_GLASS_COUNT }, (_, i) => flags.has(`${SEA_GLASS_FLAG}${i + 1}`));
}

export function driftwoodFinds(flags: FlagReader, owned: OwnedReader): FindsView {
  const glass = seaGlassFound(flags);
  const nGlass = glass.filter(Boolean).length;
  const nPlaces = DRIFTWOOD_PLACES.filter((p) => flags.has(`seen:${p.id}`)).length;
  const nShards = SHARD_FLAGS.filter((f) => flags.has(f)).length;
  const next = nextCharmAt(nGlass);
  return {
    counters: [
      { label: 'Sea glass', n: nGlass, of: SEA_GLASS_COUNT },
      { label: 'Places', n: nPlaces, of: DRIFTWOOD_PLACES.length },
      { label: 'Glyph shards', n: nShards, of: SHARD_FLAGS.length },
    ],
    next: next === null ? null : `Next charm at ${next}`,
    sections: [
      { title: 'Trophies', items: [
        { label: 'Bear claw', icon: 'talon', found: owned.has('bear-claw') },
        { label: 'Boar tusk', icon: 'tusk', found: owned.has('boar-tusk') },
        { label: "Captain's hat", icon: 'hat', found: owned.has('captain-hat') },
      ] },
      { title: 'Treasures', items: [{ label: 'Pearl necklace', icon: 'necklace', found: flags.has('found:reef-treasure') }] },
    ],
    glass: glass.map((found, i) => ({ found, color: GLASS_COLORS[i % GLASS_COLORS.length] ?? '#7df0d0' })),
  };
}

/** the sea chart (E314 stage 2): the beach sea glass not found yet — world x / z and the piece's colour (a found one is gone) */
export function seaChartMarks(flags: FlagReader): { x: number; z: number; color: string }[] {
  const out: { x: number; z: number; color: string }[] = [];
  for (const r of DRIFTWOOD_INTERACT.rows) {
    if (r.kind !== 'pickup' || r.look !== 'seaglass' || r.at.poi !== 'world') continue;
    const f = r.sets?.[0];
    if (f === undefined || flags.has(f)) continue;
    out.push({ x: r.at.x, z: r.at.z, color: r.color ?? '#7df0d0' });
  }
  return out;
}
