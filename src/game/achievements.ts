/**
 * Shard achievements — each shard has its own table, each achievement pays out a TITLE (the thing that
 * would sit under your name in multiplayer; single-player only shows it on the menu's Achievements tab).
 * An achievement counts KILLS (`kind`, + `variant`) or an adventure EVENT (`event` — Driftwood's quest, sea glass,
 * the dive treasure, the vista bench: `progress.recordEvent('glass', total)`), never both.
 *
 *   achievementsFor('chunk://local/pine-hollow')   → AchievementDef[] (empty for a shard without a table)
 *
 * A kill matches an achievement when the species matches and, if the achievement names one, the variant
 * matches too (`ghost` = the Ghost stag, `ironhide` = Old Ironhide — the legendaries from src/engine/entities/species/).
 * Progress / earned state / the worn title live in src/game/Progress.ts.
 */
import type { IconId } from '#engine/ui/icons';

export interface AchievementDef {
  /** unique within the shard, persisted */
  id: string;
  /** the achievement's name ("DEERSTALKER") */
  name: string;
  /** what it takes ("Kill 5 deer") */
  goal: string;
  /** kills / events needed */
  count: number;
  /** species id (`Animal.kind`) — a kill achievement */
  kind?: string;
  /** an adventure event id (Progress.recordEvent) — an event achievement */
  event?: string;
  /** VariantDef id when only one variant counts (legendaries) */
  variant?: string;
  /** the title it unlocks — the joke */
  title: string;
  icon: IconId;
}



/** Driftwood Isle (plan row A4): the quest's beats, the collectibles, the island's enemies */
const DRIFTWOOD: AchievementDef[] = [
  { id: 'castaway', name: 'Message in a Bottle', goal: 'Talk to the castaway', count: 1, event: 'talked', title: 'Honorary Castaway', icon: 'rope' },
  { id: 'shards', name: 'Shardkeeper', goal: 'Find the 3 glyph shards', count: 3, event: 'shard', title: 'Keeper of the Ring', icon: 'poi' },
  { id: 'quest', name: 'The Sealed Ring', goal: 'Open the Ring Shrine', count: 1, event: 'quest', title: 'Ringbearer', icon: 'laurel' },
  { id: 'glass', name: 'Beachcomber', goal: 'Find all 15 sea glass', count: 15, event: 'glass', title: 'Sea Glass Hoarder', icon: 'seaglass' },
  { id: 'treasure', name: 'Pearl Diver', goal: 'Dive for the treasure', count: 1, event: 'treasure', title: 'Held Breath Champion', icon: 'coin' },
  { id: 'vista', name: 'Take a Seat', goal: 'Sit on the vista bench', count: 1, event: 'vista', title: 'Professional Sitter', icon: 'check' },
  { id: 'zipline', name: 'Zip It', goal: 'Ride the zipline down', count: 1, event: 'zipline', title: 'Line Rider', icon: 'rope' },
  { id: 'sailor', name: 'Shore Leave', goal: 'Beat the drowned sailor', count: 1, kind: 'sailor', title: 'Deckhand\'s Nightmare', icon: 'sword' },
  { id: 'crab10', name: 'Crab Rave', goal: 'Kill 10 reef crabs', count: 10, kind: 'crab', title: 'Crabby', icon: 'claw' },
  { id: 'monkey6', name: 'Barrel of Monkeys', goal: 'Kill 6 coconut monkeys', count: 6, kind: 'monkey', title: 'Monkey Business', icon: 'coconut' },
];

const TABLES: Record<string, AchievementDef[]> = {
  'driftwood-isle': DRIFTWOOD,
};

export function achievementsFor(chunkId: string): AchievementDef[] { return TABLES[chunkId.replace(/^chunk:\/\/local\//u, '')] ?? []; }

/** A level owns its authored rows; a resident level can release only its own registration. */
export function registerAchievements(chunkId: string, defs: AchievementDef[]): () => void {
  const id = chunkId.replace(/^chunk:\/\/local\//u, '');
  const previous = TABLES[id];
  TABLES[id] = defs;
  return () => { if (TABLES[id] === defs) { if (previous) TABLES[id] = previous; else delete TABLES[id]; } };
}
