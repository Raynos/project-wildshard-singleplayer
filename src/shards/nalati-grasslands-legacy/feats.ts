import type { AchievementDef } from '@wildshard/game/achievements';

export const NALATI_FEATS: AchievementDef[] = [
  { id: 'storm-titan', name: 'Weather Report', goal: 'Defeat Jel Ata, the Storm Titan', count: 1, event: 'storm-titan', title: 'Partly Cloudy', icon: 'laurel' },
  { id: 'golden-king', name: 'Kurgan Robber', goal: 'Defeat the Golden King', count: 1, kind: 'golden-king', variant: 'king', title: 'Grave Robber (Licensed)', icon: 'laurel' },
  // the named elites (B12, src/shards/nalati-grasslands/elites.ts) — joke titles, the user's decision
  { id: 'aqbars', name: 'Irbis', goal: 'Kill Aqbars the Pale', count: 1, kind: 'leopard', variant: 'aqbars', title: 'Crazy Cat Person', icon: 'laurel' },
  { id: 'kokbori', name: 'Leader of the Pack', goal: 'Kill Kokbori', count: 1, kind: 'kokbori', title: 'Good Boy Denier', icon: 'laurel' },
  { id: 'qyran', name: 'Clipped', goal: 'Kill Qyran the Storm-Wing', count: 1, kind: 'eagle', variant: 'qyran', title: 'Birdwatcher (Aggressive)', icon: 'laurel' },
  { id: 'qara-batyr', name: 'Ride the Night', goal: 'Unhorse Qara Batyr', count: 1, kind: 'ghost-rider', variant: 'captain', title: 'Night Shift', icon: 'ghost' },
  { id: 'argymaq', name: 'Unbroken, Until Now', goal: 'Tame Argymaq', count: 1, event: 'argymaq', title: 'Horse Whisperer (Shouting)', icon: 'laurel' },
  // the tame (B8, src/shards/nalati-grasslands/ride/Taming.ts → main.ts's onBonded): any wild stallion broken in five rounds
  { id: 'tame', name: 'Horse Sense', goal: 'Break a wild stallion and bond him', count: 1, event: 'tame', title: 'Stable Genius', icon: 'laurel' },
  // the quest line (NALATI-MERGE Q3–Q5, src/shards/nalati-grasslands/adventure.ts): a kokpar round won, each chapter finished
  { id: 'kokpar', name: 'Goat Rodeo', goal: 'Win a round of kokpar', count: 1, event: 'kokpar', title: 'Varsity Goat Carrier', icon: 'laurel' },
  { id: 'tulpar', name: 'Tulpar', goal: 'Finish chapter 1: TULPAR', count: 1, event: 'tulpar', title: 'Formerly On Foot', icon: 'laurel' },
  { id: 'chapter-king', name: 'The Golden King', goal: 'Finish chapter 2: THE GOLDEN KING', count: 1, event: 'chapter-king', title: 'Honorary Balbal', icon: 'laurel' },
  { id: 'chapter-wind', name: 'Father of the Wind', goal: 'Finish chapter 3: FATHER OF THE WIND', count: 1, event: 'chapter-wind', title: 'Weather Complainer (Successful)', icon: 'laurel' },
  // the steppe's counts (B15) — joke titles, the Pine Hollow style
  { id: 'wolf5', name: 'Wolfbane', goal: 'Kill 5 wolves', count: 5, kind: 'wolf', title: 'Pack Leader (Self-Appointed)', icon: 'laurel' },
  { id: 'wolf25', name: 'The Big Bad', goal: 'Kill 25 wolves', count: 25, kind: 'wolf', title: 'Not Afraid Of The Big Bad Anything', icon: 'laurel' },
  { id: 'alpha', name: 'Alpha Male Seminar', goal: 'Kill a pack alpha', count: 1, kind: 'wolf', variant: 'alpha', title: 'Sigma Grindset Survivor', icon: 'laurel' },
  { id: 'balbal5', name: 'Rock Bottom', goal: 'Topple 5 balbal warriors', count: 5, kind: 'balbal', title: 'Licensed Stonemason', icon: 'laurel' },
  { id: 'ghost10', name: 'Night Watch', goal: 'Unhorse 10 ghost riders', count: 10, kind: 'ghost-rider', title: 'Ghost Rider (No Relation)', icon: 'ghost' },
];
