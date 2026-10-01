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



const TABLES: Record<string, AchievementDef[]> = {};

export function achievementsFor(chunkId: string): AchievementDef[] { return TABLES[chunkId.replace(/^chunk:\/\/local\//u, '')] ?? []; }

/** A level owns its authored rows; a resident level can release only its own registration. */
export function registerAchievements(chunkId: string, defs: AchievementDef[]): () => void {
  const id = chunkId.replace(/^chunk:\/\/local\//u, '');
  const previous = TABLES[id];
  TABLES[id] = defs;
  return () => { if (TABLES[id] === defs) { if (previous) TABLES[id] = previous; else delete TABLES[id]; } };
}
