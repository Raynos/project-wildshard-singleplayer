/**
 * Shard achievements — each shard has its own table, each achievement pays out a TITLE (the thing that
 * would sit under your name in multiplayer; single-player only shows it on the menu's Achievements tab).
 * An achievement counts KILLS (`kind`, + `variant`) or an adventure EVENT (`event` — Driftwood's quest, sea glass,
 * the dive treasure, the vista bench: `progress.recordEvent('glass', total)`), never both.
 *
 *   achievementsFor('chunk://local/pine-hollow')   → AchievementDef[] (empty for a shard without a table)
 *
 * A kill matches an achievement when the species matches and, if the achievement names one, the variant
 * matches too (`ghost` = the Ghost stag, `ironhide` = Old Ironhide — the legendaries from src/entities/species/).
 * Progress / earned state / the worn title live in src/game/Progress.ts.
 */
import type { IconId } from '../ui/icons';

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

const PINE_HOLLOW: AchievementDef[] = [
  { id: 'deer5', name: 'Deerstalker', goal: 'Kill 5 deer', count: 5, kind: 'deer', title: 'Antler Management', icon: 'deer' },
  { id: 'boar5', name: 'Hog Wild', goal: 'Kill 5 boar', count: 5, kind: 'boar', title: 'Bacon Procurement Officer', icon: 'boar' },
  { id: 'elk3', name: 'Big Game', goal: 'Kill 3 elk', count: 3, kind: 'elk', title: 'Elk Yeah', icon: 'elk' },
  { id: 'bear2', name: 'Apex', goal: 'Kill 2 bear', count: 2, kind: 'bear', title: 'Unbearable', icon: 'bear' },
  { id: 'ghost', name: 'Ghost Story', goal: 'Kill the Ghost stag', count: 1, kind: 'deer', variant: 'ghost', title: 'Ghostbuster', icon: 'ghost' },
  { id: 'ironhide', name: 'Old Ironhide', goal: 'Kill Old Ironhide', count: 1, kind: 'boar', variant: 'ironhide', title: "Ironhide's Retirement Plan", icon: 'ironhide' },
];

/** Nalati Grasslands (docs/design/nalati/elites-and-bosses.md): the bosses first (B13, B14); the elites + the rest are B15's */
const NALATI: AchievementDef[] = [
  { id: 'storm-titan', name: 'Weather Report', goal: 'Defeat Jel Ata, the Storm Titan', count: 1, event: 'storm-titan', title: 'Partly Cloudy', icon: 'laurel' },
  { id: 'golden-king', name: 'Kurgan Robber', goal: 'Defeat the Golden King', count: 1, kind: 'golden-king', variant: 'king', title: 'Grave Robber (Licensed)', icon: 'laurel' },
  // the named elites (B12, src/nalati/elites.ts) — joke titles, the user's decision
  { id: 'aqbars', name: 'Irbis', goal: 'Kill Aqbars the Pale', count: 1, kind: 'leopard', variant: 'aqbars', title: 'Crazy Cat Person', icon: 'laurel' },
  { id: 'kokbori', name: 'Leader of the Pack', goal: 'Kill Kokbori', count: 1, kind: 'kokbori', title: 'Good Boy Denier', icon: 'laurel' },
  { id: 'qyran', name: 'Clipped', goal: 'Kill Qyran the Storm-Wing', count: 1, kind: 'eagle', variant: 'qyran', title: 'Birdwatcher (Aggressive)', icon: 'laurel' },
  { id: 'qara-batyr', name: 'Ride the Night', goal: 'Unhorse Qara Batyr', count: 1, kind: 'ghost-rider', variant: 'captain', title: 'Night Shift', icon: 'ghost' },
  { id: 'argymaq', name: 'Unbroken, Until Now', goal: 'Tame Argymaq', count: 1, event: 'argymaq', title: 'Horse Whisperer (Shouting)', icon: 'laurel' },
  // the tame (B8, src/game/Taming.ts → main.ts's onBonded): any wild stallion broken in five rounds
  { id: 'tame', name: 'Horse Sense', goal: 'Break a wild stallion and bond him', count: 1, event: 'tame', title: 'Stable Genius', icon: 'laurel' },
  // the quest line (NALATI-MERGE Q3, src/nalati/adventure.ts): a kokpar round won, chapter 1 finished
  { id: 'kokpar', name: 'Goat Rodeo', goal: 'Win a round of kokpar', count: 1, event: 'kokpar', title: 'Varsity Goat Carrier', icon: 'laurel' },
  { id: 'tulpar', name: 'Tulpar', goal: 'Finish chapter 1: TULPAR', count: 1, event: 'tulpar', title: 'Formerly On Foot', icon: 'laurel' },
  // the steppe's counts (B15) — joke titles, the Pine Hollow style
  { id: 'wolf5', name: 'Wolfbane', goal: 'Kill 5 wolves', count: 5, kind: 'wolf', title: 'Pack Leader (Self-Appointed)', icon: 'laurel' },
  { id: 'wolf25', name: 'The Big Bad', goal: 'Kill 25 wolves', count: 25, kind: 'wolf', title: 'Not Afraid Of The Big Bad Anything', icon: 'laurel' },
  { id: 'alpha', name: 'Alpha Male Seminar', goal: 'Kill a pack alpha', count: 1, kind: 'wolf', variant: 'alpha', title: 'Sigma Grindset Survivor', icon: 'laurel' },
  { id: 'balbal5', name: 'Rock Bottom', goal: 'Topple 5 balbal warriors', count: 5, kind: 'balbal', title: 'Licensed Stonemason', icon: 'laurel' },
  { id: 'ghost10', name: 'Night Watch', goal: 'Unhorse 10 ghost riders', count: 10, kind: 'ghost-rider', title: 'Ghost Rider (No Relation)', icon: 'ghost' },
];

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
  'chunk://local/pine-hollow': PINE_HOLLOW,
  'chunk://local/nalati-grasslands': NALATI,
  'chunk://local/driftwood-isle': DRIFTWOOD,
};

export function achievementsFor(chunkId: string): AchievementDef[] { return TABLES[chunkId] ?? []; }
