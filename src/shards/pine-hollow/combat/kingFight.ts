import type { SpeciesProgramData } from '@wildshard/format/speciesPrograms';
import type { SpeciesDecisionAuthority } from '@wildshard/game/plugin/brain';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import type { BossBrain } from '@wildshard/engine/ai/BossBrain';
import { fnv1a32, Rng, type RngState } from '@wildshard/engine/core/rng';
import LAYOUT from '../data/layout.generated.json' with { type: 'json' };
import { strikeFromData } from '@wildshard/engine/ai/strikeRows';
import { StrikeRunner } from '@wildshard/engine/ai/strikes';
import type { LaneState } from './lane';
import { bossFight, type RoamingBossFight, type RoamingBossPorts } from '@wildshard/game/plugin/bossPhase';
import { RoamingBossProfileSchema } from '@wildshard/format/bossProfiles';
import * as v from 'valibot';
import kingProfile from '../data/kingFight.generated.json' with { type: 'json' };

const contact = new StrikeRunner();

/** A body the King's fight drives: his own, or a thrall's (the page's Animal, the headless host's body). */
export interface KingBody extends AnimalSim { hp: number; readonly maxHp: number; herd: number; place: (x: number, z: number, yaw: number) => void }
/** What the King's fight reads of the world beyond his goals' (the page's PineCtx over its Player, the host's player). */
export interface KingCoreEnv<B extends KingBody> extends Pick<KingPorts<B>, 'player'|'hurt'|'trauma'|'shot'> {
  readonly reach: (actor:B,target:{readonly x:number;readonly y:number;readonly z:number})=>boolean;
}
/** The King's fight: the SDK's roaming phasedBoss policy on the host's bodies, lanes and the King's two streams. */
export type KingFight<B extends KingBody> = RoamingBossFight<B, LaneState, RngState>;
type KingMove = 'roar' | 'sweep' | 'strike' | 'brace';
type KingSound = typeof kingProfile.fight.sounds[keyof typeof kingProfile.fight.sounds];
type KingPorts<B extends KingBody> = RoamingBossPorts<B, LaneState, RngState, 'elk' | 'boar', KingMove, KingSound>;
/** What a host lends the fight beyond its env: bodies, ground, lanes, rings, the weak point and its views. */
export type KingHost<B extends KingBody> = Omit<KingPorts<B>, 'player' | 'random' | 'contact' | 'hurt' | 'trauma' | 'shot'>;

/** The King's two random streams (SF72), from the level seed alone in the browser and headless alike: where a thrall walks
 *  out of the fog (`pine.king.call`) and when it starts down its lane (`pine.king.charge`). */
const kingStreams = (seed: number): { readonly call: Rng; readonly charge: Rng } =>
  ({ call: new Rng(fnv1a32(`${String(seed)}:pine.king.call`)), charge: new Rng(fnv1a32(`${String(seed)}:pine.king.charge`)) });

/** The page's and the headless host's one fight: the admitted roaming boss profile on the host's ports. */
export function kingFight<B extends KingBody>(env: KingCoreEnv<B>, host: KingHost<B>, seed: number, program: SpeciesProgramData, decisions: SpeciesDecisionAuthority): KingFight<B> {
  const action=v.object({action:v.picklist(['roar','sweep','strike','brace'])});
  const profile=v.parse(v.intersect([RoamingBossProfileSchema,v.object({fight:v.object({
    adds:v.object({kinds:v.array(v.picklist(['elk','boar']))}),strike:action,burst:action,summon:action,lanes:action,
  })})]),kingProfile);
  const row=program.species.find(candidate=>candidate.kind==='antler-king');
  if(row?.brain?.archetype!=='decision'||row.body===undefined)throw new Error('King requires its admitted decision/body recipe');
  const declared=row.brain.data,recipe=row.body;
  const bound=new WeakSet<B>();
  const bind=(actor:B):B=>{if(!bound.has(actor)){decisions.bind(actor,declared,recipe);bound.add(actor);}return actor;};
  const contacts = new Map(program.strikes.map(strikeData => [strikeData.id, strikeFromData(strikeData)]));
  const body={...host.body,make:():B=>bind(host.body.make())};
  const fight = bossFight(profile, { ...host, body, player: env.player, random: kingStreams(seed),
    contact: (a, strike, hit, options) => {
      const spec = contacts.get(`strike.antler-king.${strike}`);
      if (spec === undefined) throw new Error(`Unknown Antler King strike ${strike}`);
      if (!contact.contains(spec, { actor: { position: a.position, scale: a.scale, yaw: a.yaw }, target: env.player.position, ...options }) || (!spec.tags.includes('cover.exempt') && !env.reach(a, env.player.position))) return false;
      hit(spec.damage); return true;
    },
    hurt: (a, damage, through) => { env.hurt(a, damage, through); }, trauma: amount => { env.trauma(amount); }, shot: (sound, at) => { env.shot(sound, at); } });
  const restore = fight.restore.bind(fight);
  fight.restore = (saved, bodies) => {
    const actor = saved.body === null ? undefined : bodies.get(saved.body);
    if (actor !== undefined && !bound.has(actor)) {
      // Binding initializes the guest's physical pose; the existing body owner
      // has already restored its attack and motion before this adapter runs.
      const state = actor.snapshot();
      bind(actor);
      actor.restore(state);
    }
    restore(saved, bodies);
  };
  return fight;
}

/** The fight's own continuation beside BossBrain's (the headless runtime's `fight`; bodies by entity id), in the shipped
 *  SF72 field names; the policy state itself is phasedBoss's. */
export interface KingFightState {
  king: string | null; present: boolean; sealed: boolean; sealK: number; darkK: number; glow: number; invuln: boolean; lockHp: number; won: boolean;
  decision?: string;
  phase: number; mode: string; modeT: number; sweepCd: number; stompCd: number; callCd: number; laneN: number; open: number;
  lane: LaneState; waves: { r: number; on: boolean; hit: boolean; delay: number }[]; lanterns: { x: number; z: number; y: number; fallT: number; acc: number }[];
  thralls: { a: string; lane: number; mode: 'approach' | 'charge' }[]; thrallLanes: LaneState[]; rngs: RngState[];
}
export function kingFightState<B extends KingBody>(fight: KingFight<B>): KingFightState {
  const { body: king, strikeCd: sweepCd, burstCd: stompCd, summonCd: callCd, chain: laneN, rings: waves, hazards: lanterns, adds: thralls, addLanes: thrallLanes, ...s } = fight.snapshot();
  return { ...(s.decision===undefined?{}:{decision:s.decision}), king, present: s.present, sealed: s.sealed, sealK: s.sealK, darkK: s.darkK, glow: s.glow, invuln: s.invuln, lockHp: s.lockHp, won: s.won,
    phase: s.phase, mode: s.mode, modeT: s.modeT, sweepCd, stompCd, callCd, laneN, open: s.open, lane: s.lane, waves, lanterns, thralls, thrallLanes, rngs: s.rngs };
}
export function restoreKingFight<B extends KingBody>(fight: KingFight<B>, saved: KingFightState, find: (id: string) => B | null): void {
  const { king: body, sweepCd: strikeCd, stompCd: burstCd, callCd: summonCd, laneN: chain, waves: rings, lanterns: hazards, thralls: adds, thrallLanes: addLanes, ...s } = saved;
  const bodies=new Map<string,B>();
  for(const id of [...(body===null?[]:[body]),...adds.map(add=>add.a)]){const actor=find(id);if(actor!==null)bodies.set(id,actor);}
  fight.restore({ body, ...s, strikeCd, burstCd, summonCd, chain, rings, hazards, adds, addLanes }, bodies);
}

/** Before the boss brain's tick: the King comes at night when the player is within 80 m (armed at the stones) and goes by
 *  day or past 110 m (the page's AntlerKing and the headless step alike). */
export function kingPresence<B extends KingBody>(boss: BossBrain, fight: KingFight<B>, player: { readonly x: number; readonly z: number }, night: boolean): void {
  const d = Math.hypot(player.x - LAYOUT.KINGS_CLEARING.x, player.z - LAYOUT.KINGS_CLEARING.z), s = boss.state;
  if (s === 'dormant') { if (night && d < 80) { fight.setPresent(true); boss.arm(); } }
  else if ((s === 'armed' || s === 'victory') && (d > 110 || !night)) { boss.disarm(); fight.setPresent(false); }
}
/** After the boss brain's tick: a dormant fight still ticks its room (the brain ticks the script in every other state). */
export function kingDormant<B extends KingBody>(boss: BossBrain, fight: KingFight<B>, dt: number, t: number): void {
  if (boss.state === 'dormant') fight.update(dt, t, false);
}
/** The page's whole King tick: presence, the boss brain, the dormant room (headless runs the three as its own steps). */
export function kingTick<B extends KingBody>(boss: BossBrain, fight: KingFight<B>, player: { readonly x: number; readonly z: number }, night: boolean, dt: number, t: number): void {
  kingPresence(boss, fight, player, night);
  boss.update(dt, t);
  kingDormant(boss, fight, dt, t);
}
