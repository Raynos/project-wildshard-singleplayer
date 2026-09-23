/**
 * Shard achievements — each shard has its own table, each achievement pays out a TITLE (the thing that
 * would sit under your name in multiplayer; single-player only shows it on the menu's Achievements tab).
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
  /** kills needed */
  count: number;
  /** species id (`Animal.kind`) */
  kind: string;
  /** VariantDef id when only one variant counts (legendaries) */
  variant?: string;
  /** the title it unlocks — the joke */
  title: string;
  icon: IconId;
  /** not a kill of a registered species but a moment the game records itself (`progress.recordKill(kind, variant)` from the
   *  code that sees it): a tame, the Storm Titan's heart, Argymaq's bond */
  event?: true;
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
  { id: 'storm-titan', name: 'Weather Report', goal: 'Defeat Jel Ata, the Storm Titan', count: 1, kind: 'storm-titan', variant: 'jel-ata', title: 'Partly Cloudy', icon: 'laurel', event: true },
  { id: 'golden-king', name: 'Kurgan Robber', goal: 'Defeat the Golden King', count: 1, kind: 'golden-king', variant: 'king', title: 'Grave Robber (Licensed)', icon: 'laurel' },
  // the named elites (B12, src/nalati/elites.ts) — joke titles, the user's decision
  { id: 'aqbars', name: 'Irbis', goal: 'Kill Aqbars the Pale', count: 1, kind: 'leopard', variant: 'aqbars', title: 'Crazy Cat Person', icon: 'laurel' },
  { id: 'kokbori', name: 'Leader of the Pack', goal: 'Kill Kokbori', count: 1, kind: 'kokbori', title: 'Good Boy Denier', icon: 'laurel' },
  { id: 'qyran', name: 'Clipped', goal: 'Kill Qyran the Storm-Wing', count: 1, kind: 'eagle', variant: 'qyran', title: 'Birdwatcher (Aggressive)', icon: 'laurel' },
  { id: 'qara-batyr', name: 'Ride the Night', goal: 'Unhorse Qara Batyr', count: 1, kind: 'ghost-rider', variant: 'captain', title: 'Night Shift', icon: 'ghost' },
  { id: 'argymaq', name: 'Unbroken, Until Now', goal: 'Tame Argymaq', count: 1, kind: 'argymaq', title: 'Horse Whisperer (Shouting)', icon: 'laurel', event: true },
  // the tame (B8, src/game/Taming.ts → main.ts's onBonded): any wild stallion broken in five rounds
  { id: 'tame', name: 'Horse Sense', goal: 'Break a wild stallion and bond him', count: 1, kind: 'tame', title: 'Stable Genius', icon: 'laurel', event: true },
  // the steppe's counts (B15) — joke titles, the Pine Hollow style
  { id: 'wolf5', name: 'Wolfbane', goal: 'Kill 5 wolves', count: 5, kind: 'wolf', title: 'Pack Leader (Self-Appointed)', icon: 'laurel' },
  { id: 'wolf25', name: 'The Big Bad', goal: 'Kill 25 wolves', count: 25, kind: 'wolf', title: 'Not Afraid Of The Big Bad Anything', icon: 'laurel' },
  { id: 'alpha', name: 'Alpha Male Seminar', goal: 'Kill a pack alpha', count: 1, kind: 'wolf', variant: 'alpha', title: 'Sigma Grindset Survivor', icon: 'laurel' },
  { id: 'balbal5', name: 'Rock Bottom', goal: 'Topple 5 balbal warriors', count: 5, kind: 'balbal', title: 'Licensed Stonemason', icon: 'laurel' },
  { id: 'ghost10', name: 'Night Watch', goal: 'Unhorse 10 ghost riders', count: 10, kind: 'ghost-rider', title: 'Ghost Rider (No Relation)', icon: 'ghost' },
];

const TABLES: Record<string, AchievementDef[]> = {
  'chunk://local/pine-hollow': PINE_HOLLOW,
  'chunk://local/nalati-grasslands': NALATI,
};

export function achievementsFor(chunkId: string): AchievementDef[] { return TABLES[chunkId] ?? []; }
