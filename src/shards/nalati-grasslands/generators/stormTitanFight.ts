import { ARENA_VIEW, arenaFunnel, type ArenaWhirlsRows } from '@wildshard/sdk/arenaView';
import { strike } from '@wildshard/sdk/species';
import { nalatiStrikeRows } from './kurganRows';
import { CAIRN } from './layout';

const strikeRows = nalatiStrikeRows();
/**
 * Jel Ata, the Storm Titan's fight rows (plan row B14; design docs/design/nalati/elites-and-bosses.md "The Storm Titan
 * fight, step by step"), read by combat/stormTitan.ts: the encounter card, the reward's card, the feed / toast lines, the
 * place and the fight's tuning.
 */

/** His three phases: the thresholds `Boss` checkpoints at, their captions and names. */
export const TITAN_PHASES: { at: number; caption: string; name: string; }[] = [
  { at: 1, caption: '', name: 'The Sky Spear' },
  { at: 0.6, caption: 'PHASE II · THE THREE WINDS', name: 'The Three Winds' },
  { at: 0.3, caption: 'PHASE III · THE GRASS FIRE', name: 'The Grass Fire' },
];

/** His encounter card: id (saved), name, title, retry card, the intro's lengths and the phases (the reward is added by the fight). */
export const TITAN_ENCOUNTER: { id: string; name: string; title: string; retryTitle: string; phases: { at: number; caption: string; name: string; }[]; intro: number; introShort: number; } = {
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

export const TITAN_ARENA: { center: { x: number; z: number; }; titan: { x: number; z: number; }; grid: number; } = { center: { x: CAIRN.x, z: CAIRN.z + TITAN_PLACE.centreZ }, titan: { x: CAIRN.x, z: CAIRN.z + TITAN_PLACE.titanZ }, grid: Math.ceil(TITAN_PLACE.arenaRadius * 2 / TITAN_TUNING.cell) };

export const TITAN_FIRE_SEEDS: { x: number; z: number; }[] = [0,1,2].map(i => ({ x: Math.cos(i*2.1+.5)*26, z: Math.sin(i*2.1+.5)*26 }));

/** Support slots carry no runtime decision fields in the shard. */
export const TITAN_SUPPORT: { actors: { hp: number; memory: { tx: string; tz: string; v: string; turn: string; }; }; initial: { cd: number; }; member: { mode: number; t: number; theta: number; hit: number; x0: number; z0: number; x1: number; z1: number; }; commit: { mode: number; t: number; }; parameters: { lane: number; flank: number; chip: number; }; signals: { couple: string; member: string; damage: string; }; } = {
  actors: { hp: TITAN_TUNING.riderHp, memory: { tx: 'x', tz: 'z', v: 'speed', turn: 'turn' } },
  initial: { cd: 2.5 }, member: { mode: 0, t: 0, theta: 0, hit: 0, x0: 0, z0: 0, x1: 0, z1: 0 }, commit: { mode: 1, t: 0 },
  parameters: { lane: TITAN_TUNING.laneSeconds, flank: TITAN_TUNING.flankSeconds, chip: TITAN_TUNING.riderChip * TITAN_PLACE.heartHp },
  signals: { couple: 'couple', member: 'rider', damage: 'supportDamage' },
};
export const TITAN_SUPPORT_SITES: { x: number; z: number; theta: number; }[] = [0,1,2].map(i => ({ x: TITAN_ARENA.titan.x + (i - 1) * 18,
  z: TITAN_ARENA.center.z - TITAN_PLACE.arenaRadius + 10, theta: i * 2.09 }));

/** Attack and tell clocks are retained by the shared encounter host. */
export const TITAN_SCHEDULES: { spear: { signal: string; initial: { mode: number; t: number; cd: number; x: number; z: number; }; parameters: { radius: number; aim: number; lock: number; stuck: number; }; retain: { mode: string; t: string; cd: string; x: string; z: string; }; }; contact: { signal: string; initial: { cd: number; }; parameters: { amount: number; }; retain: { cd: string; }; }; chain: { signal: string; initial: { cd: number; chain: number; t: number; }; parameters: NonNullable<unknown>; retain: { cd: string; left: string; t: string; }; }; } = {
  spear: { signal: 'spearResolve', initial: { mode: 0, t: 0, cd: 2.5, x: 0, z: 0 },
    parameters: { radius: TITAN_TUNING.spearRadius, aim: TITAN_TUNING.spearAim, lock: TITAN_TUNING.spearLock, stuck: TITAN_TUNING.spearStuck },
    retain: { mode: 'mode', t: 't', cd: 'cd', x: 'x', z: 'z' } },
  contact: { signal: 'fieldContact', initial: { cd: 0 }, parameters: { amount: TITAN_TUNING.fireDps }, retain: { cd: 'cd' } },
  chain: { signal: 'chain', initial: { cd: 4, chain: 0, t: 0 }, parameters: {}, retain: { cd: 'cd', left: 'chain', t: 't' } },
};

export const TITAN_FIRE_SENSE: { x: number; z: number; }[] = [0,1,2,3,4,5].map(angle => ({ x: Math.cos(angle)*5, z: Math.sin(angle)*5 }));

/** Wildfire storage on the shared boss field; ignition and cadence stay in AS. */
export const TITAN_FIRE_FIELD: { x: number; z: number; width: number; depth: number; cell: number; observations: { cx: number; cz: number; radius: number; burn: number; }; contact: { law: { signal: string; initial: { cd: number; }; parameters: { amount: number; }; retain: { cd: string; }; }; samples: { x: number; z: number; }[]; }; states: { idle: number; active: number; spent: number; }; channels: { state: string; lifetime: string; clock: string; pulse: string; neighbours: string; }; neighbours: [number, number][]; signals: { activate: string; step: string; clock: string; }; } = {
  x: TITAN_ARENA.center.x - TITAN_PLACE.arenaRadius, z: TITAN_ARENA.center.z - TITAN_PLACE.arenaRadius,
  width: TITAN_ARENA.grid, depth: TITAN_ARENA.grid, cell: TITAN_TUNING.cell,
  observations: { cx: TITAN_ARENA.center.x, cz: TITAN_ARENA.center.z, radius: TITAN_PLACE.arenaRadius, burn: TITAN_TUNING.burnSeconds },
  contact: { law: TITAN_SCHEDULES.contact, samples: TITAN_FIRE_SENSE },
  states: { idle: 0,active: 1,spent: 2 },
  channels: { state: 'mode',lifetime: 'burn',clock: 't',pulse: 'spread',neighbours: 'mask' },
  neighbours: FIRE_NEIGHBOURS, signals: { activate: 'fieldIgnite', step: 'fire', clock: 'fieldClock' },
};

export const TITAN_BOUNDARY: { x: number; z: number; radius: number; } = { x: TITAN_ARENA.center.x, z: TITAN_ARENA.center.z, radius: TITAN_PLACE.arenaRadius - 3 };
export const TITAN_PHASE_FEED: string[] = ['', TITAN_LINES.kneels, TITAN_LINES.grassFire];
export const TITAN_TIE_FEED: string[] = [TITAN_LINES.wantsRider, TITAN_LINES.quiet, TITAN_LINES.wakes];
export const TITAN_IMMUNE_FEED: string[] = [TITAN_LINES.immuneSpear, TITAN_LINES.immuneDome];

const trailInitial={count:0,elapsed:0,...Object.fromEntries(Array.from({length:12},(_,i)=>[[`trailX${i}`,0] as const,[`trailZ${i}`,0] as const]).flat())};
export const TITAN_TRAIL: { initial: { count: number; elapsed: number; }; parameters: { capacity: number; every: number; }; retain: Record<string, string>; signals: { step: string; pick: string; }; } = { initial:trailInitial,parameters:{capacity:12,every:.1},retain:Object.fromEntries(Object.keys(trailInitial).map(key=>[key,key] as const)),
  signals:{step:'arenaTrail',pick:'arenaTrailPick'} };
/** the three whirlwinds (game/boss/arenaFire ArenaWhirlsView): their wander laws, the funnels' ease and spin, the debris spiral */
export function titanWhirlGate(count:number):ArenaWhirlsRows['gate']{
  const slots=Array.from({length:count},(_,i)=>({weight:`zzzzWhirl${i}K`,armed:`zzzzWhirl${i}On`,shown:`zzzzWhirl${i}Shown`}));
  const keys=slots.flatMap(slot=>Object.values(slot));
  return {law:{signal:'zzzzWhirlGate',initial:Object.fromEntries(keys.map(key=>[key,0])),parameters:{count},retain:Object.fromEntries(keys.map(key=>[key,key]))},
    arm:'zzzzWhirlArm',slots,inputs:{delta:'dt',live:'open',ease:'amount',mask:'zzMask',index:'index',count:'count'}};
}
export function titanWhirlView(count:number):ArenaWhirlsRows['view']{
  const view=ARENA_VIEW.whirls;
  return {source:view.values,slot:view.slot,draw:view.draws.debris,
    slots:Array.from({length:count},(_,i)=>({object:arenaFunnel(i),fields:{k:`k${i}`,shown:`shown${i}`,x:`x${i}`,y:`y${i}`,z:`z${i}`}}))};
}
export const TITAN_WHIRLS: { view: { source: string; slot: string; draw: string; slots: ({ object: string; fields: { k: string; shown: string; x: string; y: string; z: string; }; })[]; }; gate: { law: ArenaWhirlsRows['gate']['law']; arm: string; slots: ({ weight: string; armed: string; shown: string; })[]; inputs: { delta: string; live: string; ease: string; mask: string; index: string; count: string; }; }; laws: { signal: string; initial: { x: number; z: number; vx: number; vz: number; cd: number; }; parameters: { cx: number; cz: number; radius: number; flank: number; }; retain: { x: string; z: string; vx: string; vz: string; cd: string; }; }[]; ease: number; spin: number; sink: number; breathe: number[]; debris: { count: number; climb: number; turn: number; step: number; radius: number[]; height: number; axis: number[]; roll: number; scale: number[]; }; } = { view:titanWhirlView(3),gate:titanWhirlGate(3), laws: [0,1,2].map(i => ({ signal: 'whirl',
  initial: { x: TITAN_ARENA.center.x + Math.cos(i*2.1)*30, z: TITAN_ARENA.center.z + Math.sin(i*2.1)*30, vx: 0, vz: 0, cd: 0 },
  parameters: { cx: TITAN_ARENA.center.x, cz: TITAN_ARENA.center.z, radius: TITAN_PLACE.arenaRadius, flank: TITAN_TUNING.whirlRadius },
  retain: { x: 'x', z: 'z', vx: 'vx', vz: 'vz', cd: 'cd' },
})), ease: 1.2, spin: 5, sink: .5, breathe: [.06, 3],
  debris: { count: 40, climb: .35, turn: 4, step: 2.4, radius: [1, 5.5], height: 13, axis: [.3, 1, .2], roll: 6, scale: [.6, .2, 5] } };

export const TITAN_CHAINS: { count: number; law: { signal: string; initial: { on: number; t: number; x: number; z: number; }; parameters: { land: number; radius: number; }; retain: { t: string; mode: string; }; }; } = { count: 8, law: { signal: 'chainLand',
  initial: { on: 0, t: 0, x: 0, z: 0 }, parameters: { land: TITAN_TUNING.chainLand, radius: TITAN_TUNING.chainRadius },
  retain: { t: 't', mode: 'on' },
} };


/** Boss-host clock contract: AS selects active attacks and their delayed tells. */
const landingSlots=Array.from({length:TITAN_CHAINS.count},(_,i)=>Object.fromEntries(Object.entries(TITAN_CHAINS.law.initial).map(([key,value])=>[`zzzLanding${i}${key}`,value])));
const clockInitial={...TITAN_SCHEDULES.spear.initial,zzChainCd:TITAN_SCHEDULES.chain.initial.cd,zzChainLeft:TITAN_SCHEDULES.chain.initial.chain,zzChainT:TITAN_SCHEDULES.chain.initial.t,...TITAN_TRAIL.initial,...Object.fromEntries(landingSlots.flatMap<[string, number]>(Object.entries))};
export const TITAN_CLOCKS: { frame: { initial: { count: number; elapsed: number; zzChainCd: number; zzChainLeft: number; zzChainT: number; mode: number; t: number; cd: number; x: number; z: number; }; parameters: { zzzLandSeconds: number; zzzLandRadius: number; zzzLandingCapacity: number; capacity: number; every: number; radius: number; aim: number; lock: number; stuck: number; }; retain: Record<string, string>; signals: { step: string; }; outputs: string[]; }; count: string; left: string; spear: string; clear: Record<string, number>; landings: { on: string; t: string; x: string; z: string; strike: string; hurt: string; }[]; } = {
  frame:{initial:clockInitial,parameters:{...TITAN_SCHEDULES.spear.parameters,...TITAN_TRAIL.parameters,zzzLandSeconds:TITAN_CHAINS.law.parameters.land,zzzLandRadius:TITAN_CHAINS.law.parameters.radius,zzzLandingCapacity:TITAN_CHAINS.count},
    retain:Object.fromEntries(Object.keys(clockInitial).map(key=>[key,key])),signals:{step:'zzzArenaFrame'},
    outputs:[...Object.keys(clockInitial),'strike','stuck','hurt','spread','zzSpearActive','zzChainStrike','zzChainIndex',...landingSlots.flatMap((_,i)=>[`zzzLanding${i}strike`,`zzzLanding${i}hurt`])]},
  count:'zzzLandingCapacity',left:'zzChainLeft',spear:'zzSpearActive',clear:Object.fromEntries(landingSlots.flatMap<[string, number]>(Object.entries)),
  landings:landingSlots.map((_,i)=>({on:`zzzLanding${i}on`,t:`zzzLanding${i}t`,x:`zzzLanding${i}x`,z:`zzzLanding${i}z`,strike:`zzzLanding${i}strike`,hurt:`zzzLanding${i}hurt`})),
};

/** Arena boss-script contract: retained lifecycle state is owned by G474. */
const stepSnapshot={enter:'stepenter',mask:'stepmask',shield:'stepshield',show:'stepshow',active:'stepactive',arm:'steparm',spread:'stepspread',weapon:'stepweapon',dome:'stepdome'};
const tellSnapshot={chainRadius:'tellchainRadius',chainAlpha:'tellchainAlpha',tell:'telltell',ringRadius:'tellringRadius',ringAlpha:'tellringAlpha',forkRadius:'tellforkRadius',forkAlpha:'tellforkAlpha',bend:'tellbend',bendRate:'tellbendRate',raise:'tellraise',raiseRate:'tellraiseRate',castL:'tellcastL',struck:'tellstruck',alpha:'tellalpha'};
const introSnapshot={rise:'introrise',kneel:'introkneel',alpha:'introalpha'};
export const TITAN_SCRIPT: { kind: string; pattern: string; fight: { initial: { tellraise: number; zzzzIntroT: number; zzzzIntroTick: number; phase: number; hp: number; invuln: number; fighting: number; open: number; victoryT: number; tied: number; sealed: number; broke: number; immuneT: number; introBolt: number; wall: number; }; parameters: { fullHp: number; fullDraw: number; fullDrawMul: number; rewardDistance: number; respawnDistance: number; storm: number; engaged: number; armed: number; victory: number; chainRadius: number; spearAim: number; spearLock: number; spearRadius: number; }; signals: { reset: string; begin: string; phase: string; damage: string; step: string; victory: string; clamp: string; invulnerable: string; seal: string; tied: string; tie: string; intro: string; support: string; point: string; tell: string; introClock: string; }; retain: Record<string, string>; retainEvents: { step: { enter: string; mask: string; shield: string; show: string; active: string; arm: string; spread: string; weapon: string; dome: string; }; tell: { chainRadius: string; chainAlpha: string; tell: string; ringRadius: string; ringAlpha: string; forkRadius: string; forkAlpha: string; bend: string; bendRate: string; raise: string; raiseRate: string; castL: string; struck: string; alpha: string; }; intro: { rise: string; kneel: string; alpha: string; }; introClock: { zzzzIntroT: string; zzzzIntroTick: string; }; }; }; } = { kind: 'boss', pattern: 'arena-script', fight: {
  initial: { phase: 0, hp: TITAN_PLACE.heartHp, invuln: 0, fighting: 0, open: 0, victoryT: -1, tied: 0, sealed: 0, broke: 0, immuneT: 0, introBolt: 0, wall: 0,
    ...Object.fromEntries([...Object.values(stepSnapshot),...Object.values(tellSnapshot),...Object.values(introSnapshot)].map(key=>[key,0])),tellraise:.2,zzzzIntroT:-1,zzzzIntroTick:0 },
  parameters: { fullHp: TITAN_PLACE.heartHp, fullDraw: TITAN_TUNING.fullDraw, fullDrawMul: TITAN_TUNING.fullDrawMul, rewardDistance: 3.5, respawnDistance: 16, storm: 0, engaged: 0, armed: 0, victory: 0, chainRadius: TITAN_TUNING.chainRadius,spearAim: TITAN_TUNING.spearAim, spearLock: TITAN_TUNING.spearLock, spearRadius: TITAN_TUNING.spearRadius },
  signals: { reset: 'bossReset', begin: 'bossBegin', phase: 'bossPhase', damage: 'bossDamage', step: 'bossStep', victory: 'bossVictory',
    clamp: 'bossClamp', invulnerable: 'bossShield', seal: 'bossSeal', tied: 'bossTie', tie: 'tie', intro: 'bossIntro', support: 'bossSupport', point: 'bossPoint', tell: 'bossTell',introClock:'zzzzIntroClock' },
  retain: Object.fromEntries(['phase','hp','invuln','fighting','open','victoryT','tied','sealed','broke','immuneT','introBolt','wall'].map(field => [field,field])),
  retainEvents:{step:stepSnapshot,tell:tellSnapshot,intro:introSnapshot,introClock:{zzzzIntroT:'zzzzIntroT',zzzzIntroTick:'zzzzIntroTick'}},
} };

/** G474 arena boss-script binding; native owners receive rows and resources. */
export const TITAN_HOST: { script: { kind: string; pattern: string; fight: { initial: { tellraise: number; zzzzIntroT: number; zzzzIntroTick: number; phase: number; hp: number; invuln: number; fighting: number; open: number; victoryT: number; tied: number; sealed: number; broke: number; immuneT: number; introBolt: number; wall: number; }; parameters: { fullHp: number; fullDraw: number; fullDrawMul: number; rewardDistance: number; respawnDistance: number; storm: number; engaged: number; armed: number; victory: number; chainRadius: number; spearAim: number; spearLock: number; spearRadius: number; }; signals: { reset: string; begin: string; phase: string; damage: string; step: string; victory: string; clamp: string; invulnerable: string; seal: string; tied: string; tie: string; intro: string; support: string; point: string; tell: string; introClock: string; }; retain: Record<string, string>; retainEvents: { step: { enter: string; mask: string; shield: string; show: string; active: string; arm: string; spread: string; weapon: string; dome: string; }; tell: { chainRadius: string; chainAlpha: string; tell: string; ringRadius: string; ringAlpha: string; forkRadius: string; forkAlpha: string; bend: string; bendRate: string; raise: string; raiseRate: string; castL: string; struck: string; alpha: string; }; intro: { rise: string; kneel: string; alpha: string; }; introClock: { zzzzIntroT: string; zzzzIntroTick: string; }; }; }; }; commands: { ignite: string; dismount: string; }; clocks: { frame: { initial: { count: number; elapsed: number; zzChainCd: number; zzChainLeft: number; zzChainT: number; mode: number; t: number; cd: number; x: number; z: number; }; parameters: { zzzLandSeconds: number; zzzLandRadius: number; zzzLandingCapacity: number; capacity: number; every: number; radius: number; aim: number; lock: number; stuck: number; }; retain: Record<string, string>; signals: { step: string; }; outputs: string[]; }; count: string; left: string; spear: string; clear: Record<string, number>; landings: { on: string; t: string; x: string; z: string; strike: string; hurt: string; }[]; }; field: { x: number; z: number; width: number; depth: number; cell: number; observations: { cx: number; cz: number; radius: number; burn: number; }; contact: { law: { signal: string; initial: { cd: number; }; parameters: { amount: number; }; retain: { cd: string; }; }; samples: { x: number; z: number; }[]; }; states: { idle: number; active: number; spent: number; }; channels: { state: string; lifetime: string; clock: string; pulse: string; neighbours: string; }; neighbours: [number, number][]; signals: { activate: string; step: string; clock: string; }; }; support: { actors: { hp: number; memory: { tx: string; tz: string; v: string; turn: string; }; }; initial: { cd: number; }; member: { mode: number; t: number; theta: number; hit: number; x0: number; z0: number; x1: number; z1: number; }; commit: { mode: number; t: number; }; parameters: { lane: number; flank: number; chip: number; }; signals: { couple: string; member: string; damage: string; }; }; whirls: { view: { source: string; slot: string; draw: string; slots: ({ object: string; fields: { k: string; shown: string; x: string; y: string; z: string; }; })[]; }; gate: { law: ArenaWhirlsRows['gate']['law']; arm: string; slots: ({ weight: string; armed: string; shown: string; })[]; inputs: { delta: string; live: string; ease: string; mask: string; index: string; count: string; }; }; laws: { signal: string; initial: { x: number; z: number; vx: number; vz: number; cd: number; }; parameters: { cx: number; cz: number; radius: number; flank: number; }; retain: { x: string; z: string; vx: string; vz: string; cd: string; }; }[]; ease: number; spin: number; sink: number; breathe: number[]; debris: { count: number; climb: number; turn: number; step: number; radius: number[]; height: number; axis: number[]; roll: number; scale: number[]; }; }; supportSites: { x: number; z: number; theta: number; }[]; arena: { center: { x: number; z: number; }; body: { x: number; z: number; }; anchor: { x: number; z: number; }; ground: { x: number; z: number; }; }; place: { arenaRadius: number; heartHp: number; }; phases: { at: number; caption: string; name: string; }[]; definition: { id: string; name: string; title: string; retryTitle: string; phases: { at: number; caption: string; name: string; }[]; intro: number; introShort: number; }; reward: { tier: string; name: string; flavour: string; prompt: string; }; skin: { id: string; toast: string; }; tuning: { spearDamage: number; spearRadius: number; spearAim: number; spearLock: number; spearStuck: number; whirlDamage: number; whirlRadius: number; riderHp: number; riderChip: number; chargeDamage: number; laneSeconds: number; flankSeconds: number; stunSeconds: number; cell: number; burnSeconds: number; fireDps: number; maxFlames: number; chainDamage: number; chainRadius: number; chainLand: number; fullDraw: number; fullDrawMul: number; }; boundary: { x: number; z: number; radius: number; }; phaseLines: string[]; tieLines: string[]; immuneLines: string[]; seeds: { x: number; z: number; }[]; lines: { spear: string; charge: string; whirl: string; kneels: string; grassFire: string; immuneDome: string; immuneSpear: string; spearStuck: string; riderBreaks: string; lastRider: string; burning: string; chain: string; wall: string; tie: string; tieOnFoot: string; tieQuiet: string; wantsRider: string; quiet: string; wakes: string; }; contacts: { spear: { id: string; shape: { kind: "arc"; radius: number; halfAngle: number; yawOffset?: number; } | { kind: "lane"; length: number; width: number; } | { kind: "ring"; inner: number; outer: number; } | { kind: "wedge"; length: number; halfAngle: number; } | { kind: "point"; radius: number; exclusive?: boolean; } | { kind: "sphere"; radius: number; }; windup: number; active: number; recover: number; cooldown: number; range: number | null; damage: number; tags: `${string}.${string}`[]; weight: { kind: "constant"; value: number; } | { kind: "horizontal-distance"; above: number; far: number; near: number; }; units?: "world" | "actor"; alternatives?: ({ kind: "arc"; radius: number; halfAngle: number; yawOffset?: number; } | { kind: "lane"; length: number; width: number; } | { kind: "ring"; inner: number; outer: number; } | { kind: "wedge"; length: number; halfAngle: number; } | { kind: "point"; radius: number; exclusive?: boolean; } | { kind: "sphere"; radius: number; })[]; motion?: { speed?: number; delay?: number; track?: "none" | "lead" | "follow"; overshoot?: number; skid?: number; }; eligibility?: { maxDy?: number; jumpDodges?: boolean; }; }; whirl: { id: string; shape: { kind: "arc"; radius: number; halfAngle: number; yawOffset?: number; } | { kind: "lane"; length: number; width: number; } | { kind: "ring"; inner: number; outer: number; } | { kind: "wedge"; length: number; halfAngle: number; } | { kind: "point"; radius: number; exclusive?: boolean; } | { kind: "sphere"; radius: number; }; windup: number; active: number; recover: number; cooldown: number; range: number | null; damage: number; tags: `${string}.${string}`[]; weight: { kind: "constant"; value: number; } | { kind: "horizontal-distance"; above: number; far: number; near: number; }; units?: "world" | "actor"; alternatives?: ({ kind: "arc"; radius: number; halfAngle: number; yawOffset?: number; } | { kind: "lane"; length: number; width: number; } | { kind: "ring"; inner: number; outer: number; } | { kind: "wedge"; length: number; halfAngle: number; } | { kind: "point"; radius: number; exclusive?: boolean; } | { kind: "sphere"; radius: number; })[]; motion?: { speed?: number; delay?: number; track?: "none" | "lead" | "follow"; overshoot?: number; skid?: number; }; eligibility?: { maxDy?: number; jumpDodges?: boolean; }; }; wind: { id: string; shape: { kind: "arc"; radius: number; halfAngle: number; yawOffset?: number; } | { kind: "lane"; length: number; width: number; } | { kind: "ring"; inner: number; outer: number; } | { kind: "wedge"; length: number; halfAngle: number; } | { kind: "point"; radius: number; exclusive?: boolean; } | { kind: "sphere"; radius: number; }; windup: number; active: number; recover: number; cooldown: number; range: number | null; damage: number; tags: `${string}.${string}`[]; weight: { kind: "constant"; value: number; } | { kind: "horizontal-distance"; above: number; far: number; near: number; }; units?: "world" | "actor"; alternatives?: ({ kind: "arc"; radius: number; halfAngle: number; yawOffset?: number; } | { kind: "lane"; length: number; width: number; } | { kind: "ring"; inner: number; outer: number; } | { kind: "wedge"; length: number; halfAngle: number; } | { kind: "point"; radius: number; exclusive?: boolean; } | { kind: "sphere"; radius: number; })[]; motion?: { speed?: number; delay?: number; track?: "none" | "lead" | "follow"; overshoot?: number; skid?: number; }; eligibility?: { maxDy?: number; jumpDodges?: boolean; }; }; chain: { id: string; shape: { kind: "arc"; radius: number; halfAngle: number; yawOffset?: number; } | { kind: "lane"; length: number; width: number; } | { kind: "ring"; inner: number; outer: number; } | { kind: "wedge"; length: number; halfAngle: number; } | { kind: "point"; radius: number; exclusive?: boolean; } | { kind: "sphere"; radius: number; }; windup: number; active: number; recover: number; cooldown: number; range: number | null; damage: number; tags: `${string}.${string}`[]; weight: { kind: "constant"; value: number; } | { kind: "horizontal-distance"; above: number; far: number; near: number; }; units?: "world" | "actor"; alternatives?: ({ kind: "arc"; radius: number; halfAngle: number; yawOffset?: number; } | { kind: "lane"; length: number; width: number; } | { kind: "ring"; inner: number; outer: number; } | { kind: "wedge"; length: number; halfAngle: number; } | { kind: "point"; radius: number; exclusive?: boolean; } | { kind: "sphere"; radius: number; })[]; motion?: { speed?: number; delay?: number; track?: "none" | "lead" | "follow"; overshoot?: number; skid?: number; }; eligibility?: { maxDy?: number; jumpDodges?: boolean; }; }; }; whole: string[]; pose: { rise: number; bend: number; kneel: number; raise: number; castL: number; stride: number; heartOpen: number; }; view: { group: string; dome: string; bodyRoot: string; quietVariant: string; remaining: string; debug: string; notice: number; promptLift: number; wallDamage: number; target: { damage: number; open: number; closed: number; range: number; }; light: { colour: number; y: number; }; reward: { distance: number; lift: number; }; respawn: { distance: number; yaw: number; steed: number; }; introBolt: { x: number; z: number; }; }; weather: { strike: string; clearing: string; storm: string; }; record: { kind: string; variant: string; }; } = {
  script: TITAN_SCRIPT,commands:{ignite:'zzzzIgnite',dismount:'zzzzDismount'},clocks: TITAN_CLOCKS,field: TITAN_FIRE_FIELD,support: TITAN_SUPPORT,whirls: TITAN_WHIRLS,
  supportSites: TITAN_SUPPORT_SITES,arena: { center: TITAN_ARENA.center,body: TITAN_ARENA.titan,anchor: { x: CAIRN.x,z: CAIRN.z+3 },ground: { x: CAIRN.x,z: CAIRN.z } },
  place: { arenaRadius: TITAN_PLACE.arenaRadius,heartHp: TITAN_PLACE.heartHp },phases: TITAN_PHASES,
  definition: TITAN_ENCOUNTER,reward: TITAN_REWARD,skin: TITAN_SKIN,tuning: TITAN_TUNING,boundary: TITAN_BOUNDARY,
  phaseLines: TITAN_PHASE_FEED,tieLines: TITAN_TIE_FEED,immuneLines: TITAN_IMMUNE_FEED,seeds: TITAN_FIRE_SEEDS,
  lines: { ...TITAN_LINES,spear: 'The Sky Spear — keep turning at a canter',charge: 'Wind Charge — swerve out of the lane',whirl: 'A whirlwind — ride around them' },
  contacts: { spear: strike(strikeRows.spear),whirl: strike(strikeRows.whirl),wind: strike(strikeRows.wind),chain: strike(strikeRows.chain) },whole: ['fire','wall'],
  pose: { rise: 0,bend: 0,kneel: 0,raise: .2,castL: 0,stride: 0,heartOpen: 0 },
  view: { group: 'titan.fight',dome: 'dome',bodyRoot: 'root',quietVariant: 'rider',remaining: ' · {count} left',debug: 'nalati.titan',notice: 4,promptLift: 1.2,wallDamage: 10,
    target: { damage: 40,open: 7,closed: 4,range: 150 },light: { colour: 0xc8dcff,y: -60 },reward: { distance: 3.5,lift: 1.3 },respawn: { distance: 16,yaw: Math.PI,steed: 100 },introBolt: { x: 18,z: -10 } },
  weather: { strike: 'strike',clearing: 'clearing',storm: 'storm' },record: { kind: 'storm-titan',variant: 'jel-ata' },
};
