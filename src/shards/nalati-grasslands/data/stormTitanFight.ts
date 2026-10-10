/**
 * Jel Ata, the Storm Titan's fight rows (plan row B14; design docs/design/nalati/elites-and-bosses.md "The Storm Titan
 * fight, step by step"), read by combat/stormTitan.ts: the encounter card, the reward's card, the feed / toast lines, the
 * place and the fight's tuning.
 */

/** His three phases: the thresholds `Boss` checkpoints at, their captions and names. */
export const TITAN_PHASES = [
  { at: 1, caption: '', name: 'The Sky Spear' },
  { at: 0.6, caption: 'PHASE II · THE THREE WINDS', name: 'The Three Winds' },
  { at: 0.3, caption: 'PHASE III · THE GRASS FIRE', name: 'The Grass Fire' },
];

/** His encounter card: id (saved), name, title, retry card, the intro's lengths and the phases (the reward is added by the fight). */
export const TITAN_ENCOUNTER = {
  id: 'storm-titan', name: 'JEL ATA · THE STORM TITAN', title: 'FATHER OF THE WIND', retryTitle: 'THE STORM RETURNS',
  phases: TITAN_PHASES, intro: 3.6, introShort: 1.3,
};

/** The reward orb's card: Naizagai, and the saddle skin it also grants. */
export const TITAN_REWARD = { tier: 'LEGENDARY', name: 'NAIZAGAI', flavour: 'Storm Sabre of Jel Ata', prompt: 'TAKE NAIZAGAI' };
/** The mount skin the victory owns, and its toast. */
export const TITAN_SKIN = { id: 'sky-marked-saddle', toast: 'Mount skin · SKY-MARKED SADDLE' };

/** The fight's feed and toast lines, each when its beat happens (`riderBreaks` takes the riders left after a `·`). */
export const TITAN_LINES = {
  kneels: 'JEL ATA kneels — his heart shuts behind the wind · break the three riders',
  grassFire: 'THE GRASS FIRE — ride upwind onto the black',
  immuneDome: 'IMMUNE — the dome holds while a rider stands',
  immuneSpear: 'IMMUNE — his heart opens when the spear is stuck',
  spearStuck: 'The spear is stuck — HIS HEART IS OPEN',
  riderBreaks: 'A storm rider breaks — JEL ATA −8 %',
  lastRider: 'The last rider streams back into him — the dome breaks!',
  burning: 'The grass is burning — ride upwind onto the black',
  chain: 'Chain lightning — keep moving',
  wall: 'The storm wall throws you back',
  tie: 'Tie a cloth strip',
  tieOnFoot: 'Tie a cloth strip · the wind wants a rider',
  tieQuiet: 'Tie a cloth strip · the wind is quiet',
  wantsRider: 'The wind wants a rider',
  quiet: 'The wind is quiet — come back in a storm',
  wakes: 'The strip snaps in the wind — JEL ATA wakes',
};

/**
 * The place, from the Wind Cairn: the arena's centre `centreZ` m north of it and its radius, his waist `titanZ` m from it
 * in the cloud sea (a full-draw arrow in the gale drops ~14 m and drifts ~26 m by 110 m out, so the heart stays ~50–90 m
 * from the arena), his heart's hp and the body's draw scale (built at a 60 m design size, drawn ×1.9: a ~110 m giant).
 */
export const TITAN_PLACE = { centreZ: 44, arenaRadius: 68, titanZ: -62, heartHp: 2600, bodyScale: 1.9 };

/**
 * The fight's tuning: the sky spear (damage, landing radius, aim / lock / stuck seconds), the whirlwinds (damage, radius),
 * the storm riders (hp, the Titan's share each takes, the charge's damage, lane / flank / stun seconds), the grass fire
 * (cell metres, burn seconds, damage per second, the most flames drawn), the chain lightning (damage, radius, landing
 * seconds) and the full draw (an arrow's damage at or over `fullDraw` counts × `fullDrawMul` on the open heart).
 */
export const TITAN_TUNING = {
  spearDamage: 40, spearRadius: 4.5, spearAim: 1.5, spearLock: 0.5, spearStuck: 3,
  whirlDamage: 15, whirlRadius: 3.2,
  riderHp: 250, riderChip: 0.08, chargeDamage: 30, laneSeconds: 1.2, flankSeconds: 2, stunSeconds: 4,
  cell: 4, burnSeconds: 7, fireDps: 8, maxFlames: 420,
  chainDamage: 18, chainRadius: 3, chainLand: 0.6,
  fullDraw: 43, fullDrawMul: 2.5,
};
