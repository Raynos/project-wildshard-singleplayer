/** Client-only binding of Pine's counted rig/effect ports to the existing
 * roaming mechanics. No encounter lifetime or continuation is owned here. */
import type { SpeciesProgramData } from '@wildshard/format/speciesPrograms';
import type { SpeciesDecisionAuthority } from '@wildshard/game/plugin/brain';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import type { BossBrain } from '@wildshard/engine/ai/BossBrain';
import { fnv1a32, Rng, type RngState } from '@wildshard/engine/core/rng';
import { pineView } from '../runtime/world/context';
import { strikeFromData } from '@wildshard/engine/ai/strikeRows';
import { StrikeRunner } from '@wildshard/engine/ai/strikes';
import type { LaneState } from '@wildshard/game/boss/lane';
import { bossFight, type RoamingBossFight, type RoamingBossPorts } from '@wildshard/game/plugin/bossPhase';


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
type KingSound = string;
type KingPorts<B extends KingBody> = RoamingBossPorts<B, LaneState, RngState, 'elk' | 'boar', KingMove, KingSound>;
/** What a host lends the fight beyond its env: bodies, ground, lanes, rings, the weak point and its views. */
export type KingHost<B extends KingBody> = Omit<KingPorts<B>, 'player' | 'random' | 'contact' | 'hurt' | 'trauma' | 'shot'>;

/** The King's two random streams (SF72), from the level seed alone in the browser and headless alike: where a thrall walks
 *  out of the fog (`pine.king.call`) and when it starts down its lane (`pine.king.charge`). */
const kingStreams = (seed: number): { readonly call: Rng; readonly charge: Rng } =>
  ({ call: new Rng(fnv1a32(`${String(seed)}:pine.king.call`)), charge: new Rng(fnv1a32(`${String(seed)}:pine.king.charge`)) });

/** The page's and the headless host's one fight: the admitted roaming boss profile on the host's ports. */
export function kingFight<B extends KingBody>(env: KingCoreEnv<B>, host: KingHost<B>, seed: number, program: SpeciesProgramData, decisions: SpeciesDecisionAuthority): KingFight<B> {
  const profile = pineView().BOSS_ENCOUNTER.profile;
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


/** Client-only presentation scheduling on the page's existing encounter. */
export function kingTick<B extends KingBody>(boss: BossBrain, fight: KingFight<B>, player: { readonly x: number; readonly z: number }, available: boolean, dt: number, t: number): void {
  const row = pineView().BOSS_ENCOUNTER, d = Math.hypot(player.x - row.profile.fight.origin.x, player.z - row.profile.fight.origin.z);
  if (boss.state === 'dormant') { if (available && d < row.presence.enter) { fight.setPresent(true); boss.arm(); } }
  else if ((boss.state === 'armed' || boss.state === 'victory') && (d > row.presence.leave || !available)) { boss.disarm(); fight.setPresent(false); }
  boss.update(dt, t); if (boss.state === 'dormant') fight.update(dt, t, false);
}
