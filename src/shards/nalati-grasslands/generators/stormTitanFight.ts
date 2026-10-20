import { CAIRN } from './layout';
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

/** Native grid topology; the guest owns propagation and lifetime decisions. */
export const FIRE_NEIGHBOURS: [number, number][] = [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]];

export const TITAN_ARENA = { center: { x: CAIRN.x, z: CAIRN.z + TITAN_PLACE.centreZ }, titan: { x: CAIRN.x, z: CAIRN.z + TITAN_PLACE.titanZ }, grid: Math.ceil(TITAN_PLACE.arenaRadius * 2 / TITAN_TUNING.cell) };

export const TITAN_FIRE_SEEDS = [0,1,2].map(i => ({ x: Math.cos(i*2.1+.5)*26, z: Math.sin(i*2.1+.5)*26 }));

/** Support slots carry no runtime decision fields in the shard. */
export const TITAN_SUPPORT = {
  actors: { hp: TITAN_TUNING.riderHp, memory: { tx: 'x', tz: 'z', v: 'speed', turn: 'turn' } },
  initial: { cd: 2.5 }, member: { mode: 0, t: 0, theta: 0, hit: 0, x0: 0, z0: 0, x1: 0, z1: 0 }, commit: { mode: 1, t: 0 },
  parameters: { lane: TITAN_TUNING.laneSeconds, flank: TITAN_TUNING.flankSeconds, chip: TITAN_TUNING.riderChip * TITAN_PLACE.heartHp },
  signals: { couple: 'couple', member: 'rider', damage: 'supportDamage' },
};
export const TITAN_SUPPORT_SITES = [0,1,2].map(i => ({ x: TITAN_ARENA.titan.x + (i - 1) * 18,
  z: TITAN_ARENA.center.z - TITAN_PLACE.arenaRadius + 10, theta: i * 2.09 }));

/** Attack and tell clocks are retained by the shared encounter host. */
export const TITAN_SCHEDULES = {
  spear: { signal: 'spearResolve', initial: { mode: 0, t: 0, cd: 2.5, x: 0, z: 0 },
    parameters: { radius: TITAN_TUNING.spearRadius, aim: TITAN_TUNING.spearAim, lock: TITAN_TUNING.spearLock, stuck: TITAN_TUNING.spearStuck },
    retain: { mode: 'mode', t: 't', cd: 'cd', x: 'x', z: 'z' } },
  contact: { signal: 'fieldContact', initial: { cd: 0 }, parameters: { amount: TITAN_TUNING.fireDps }, retain: { cd: 'cd' } },
  chain: { signal: 'chain', initial: { cd: 4, chain: 0, t: 0 }, parameters: {}, retain: { cd: 'cd', left: 'chain', t: 't' } },
};

export const TITAN_FIRE_SENSE = [0,1,2,3,4,5].map(angle => ({ x: Math.cos(angle)*5, z: Math.sin(angle)*5 }));

/** Wildfire storage on the shared boss field; ignition and cadence stay in AS. */
export const TITAN_FIRE_FIELD = {
  x: TITAN_ARENA.center.x - TITAN_PLACE.arenaRadius, z: TITAN_ARENA.center.z - TITAN_PLACE.arenaRadius,
  width: TITAN_ARENA.grid, depth: TITAN_ARENA.grid, cell: TITAN_TUNING.cell,
  observations: { cx: TITAN_ARENA.center.x, cz: TITAN_ARENA.center.z, radius: TITAN_PLACE.arenaRadius, burn: TITAN_TUNING.burnSeconds },
  contact: { law: TITAN_SCHEDULES.contact, samples: TITAN_FIRE_SENSE },
  neighbours: FIRE_NEIGHBOURS, signals: { ignite: 'fieldIgnite', step: 'fire', clock: 'fieldClock' },
};

export const TITAN_BOUNDARY = { x: TITAN_ARENA.center.x, z: TITAN_ARENA.center.z, radius: TITAN_PLACE.arenaRadius - 3 };
export const TITAN_PHASE_FEED = ['', TITAN_LINES.kneels, TITAN_LINES.grassFire];
export const TITAN_TIE_FEED = [TITAN_LINES.wantsRider, TITAN_LINES.quiet, TITAN_LINES.wakes];
export const TITAN_IMMUNE_FEED = [TITAN_LINES.immuneSpear, TITAN_LINES.immuneDome];

export const TITAN_TRAIL = { capacity: 12, seconds: .1 };
/** the three whirlwinds (game/boss/arenaFire ArenaWhirlsView): their wander laws, the funnels' ease and spin, the debris spiral */
export const TITAN_WHIRLS = { laws: [0,1,2].map(i => ({ signal: 'whirl',
  initial: { x: TITAN_ARENA.center.x + Math.cos(i*2.1)*30, z: TITAN_ARENA.center.z + Math.sin(i*2.1)*30, vx: 0, vz: 0, cd: 0 },
  parameters: { cx: TITAN_ARENA.center.x, cz: TITAN_ARENA.center.z, radius: TITAN_PLACE.arenaRadius, flank: TITAN_TUNING.whirlRadius },
  retain: { x: 'x', z: 'z', vx: 'vx', vz: 'vz', cd: 'cd' },
})), ease: 1.2, spin: 5, sink: .5, breathe: [.06, 3],
  debris: { count: 40, climb: .35, turn: 4, step: 2.4, radius: [1, 5.5], height: 13, axis: [.3, 1, .2], roll: 6, scale: [.6, .2, 5] } };

export const TITAN_CHAINS = { count: 8, law: { signal: 'chainLand',
  initial: { on: 0, t: 0, x: 0, z: 0 }, parameters: { land: TITAN_TUNING.chainLand, radius: TITAN_TUNING.chainRadius },
  retain: { t: 't', mode: 'on' },
} };


/** Boss-host clock contract: AS selects active attacks and their delayed tells. */
export const TITAN_CLOCKS = {
  gate: { signal: 'arenaClocks', parameters: {} },
  shared: { spearMode: { clock: 'spear', slot: 'mode' }, chainLeft: { clock: 'chain', slot: 'chain' } },
  schedules: [{ id: 'spear', law: { ...TITAN_SCHEDULES.spear, signal: 'arenaSpear' } },
    { id: 'chain', law: { ...TITAN_SCHEDULES.chain, signal: 'arenaChain' } }],
  volley: { launcher: 'chain', capacity: TITAN_CHAINS.count, landing: TITAN_CHAINS.law, trail: TITAN_TRAIL },
};

/** Arena boss-script contract: retained lifecycle state is owned by G474. */
export const TITAN_SCRIPT = { kind: 'boss', pattern: 'arena-script', fight: {
  initial: { phase: 0, hp: TITAN_PLACE.heartHp, invuln: 0, fighting: 0, open: 0, victoryT: -1, tied: 0, sealed: 0, broke: 0, immuneT: 0, introBolt: 0 },
  parameters: { fullHp: TITAN_PLACE.heartHp, fullDraw: TITAN_TUNING.fullDraw, fullDrawMul: TITAN_TUNING.fullDrawMul },
  signals: { reset: 'bossReset', begin: 'bossBegin', phase: 'bossPhase', damage: 'bossDamage', step: 'bossStep', victory: 'bossVictory',
    clamp: 'bossClamp', invulnerable: 'bossShield', seal: 'bossSeal', tie: 'bossTie', intro: 'bossIntro' },
  retain: Object.fromEntries(['phase','hp','invuln','fighting','open','victoryT','tied','sealed','broke','immuneT','introBolt'].map(field => [field,field])),
} };
