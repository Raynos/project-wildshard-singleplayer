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
  // PH-C10 (the remaster): the other two elites, the King, the lantern quest, the collectibles, the lodge, the night
  { id: 'blackpaw', name: 'Eviction Notice', goal: 'Kill Old Blackpaw', count: 1, kind: 'bear', variant: 'black-old', title: 'Landlord of the Den', icon: 'claw' },
  { id: 'imperial', name: 'Seven by Seven', goal: 'Kill the Imperial Bull', count: 1, kind: 'elk', variant: 'imperial', title: 'Crown Jeweller', icon: 'antlers' },
  { id: 'king', name: 'The Last Light', goal: 'Defeat the Antler King', count: 1, event: 'king', title: 'Regicide, Rustic', icon: 'antlers' },
  { id: 'lanterns', name: 'Lamplighter', goal: 'Relight the three waystone lanterns', count: 3, event: 'lantern', title: 'Wick Whisperer', icon: 'poi' },
  { id: 'quest', name: "The Warden's Hollow", goal: 'See the dawn over the Hollow', count: 1, event: 'quest', title: 'Morning Person, Finally', icon: 'laurel' },
  { id: 'zipline', name: 'Lookout Below', goal: 'Ride the zipline off the fire lookout', count: 1, event: 'zipline', title: "Gravity's Favourite", icon: 'rope' },
  { id: 'resin', name: 'Sap Happens', goal: 'Collect all 30 amber resin drops', count: 30, event: 'resin', title: 'Sticky Fingers', icon: 'seaglass' },
  { id: 'tokens', name: 'Whittled Down', goal: 'Find all 8 carved tokens', count: 8, event: 'token', title: 'Token Gesture', icon: 'coin' },
  { id: 'secrets', name: 'Off the Beaten Path', goal: 'Find the 3 secrets: the lookout bench, the hollow log, the islet', count: 3, event: 'secret', title: 'Professional Wanderer', icon: 'check' },
  { id: 'streak', name: 'Lodge Regular', goal: 'Claim 5 lodge contracts in a row (none torn down)', count: 5, event: 'streak', title: 'Contractually Obligated', icon: 'check' },
  { id: 'miller', name: 'Grist for the Mill', goal: "Clear the thralls off the millrace for the miller", count: 1, event: 'miller', title: 'Run of the Mill', icon: 'poi' },
  { id: 'thralls', name: 'Weed Control', goal: 'Put down 10 thralls', count: 10, event: 'thrall', title: 'Moss Remover', icon: 'lock' },
  { id: 'journal', name: 'Field Notes', goal: "Fill every page of the hunter's journal", count: 1, event: 'journal', title: 'Published Naturalist', icon: 'laurel' },
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
  'chunk://local/driftwood-isle': DRIFTWOOD,
};

export function achievementsFor(chunkId: string): AchievementDef[] { return TABLES[chunkId] ?? []; }
