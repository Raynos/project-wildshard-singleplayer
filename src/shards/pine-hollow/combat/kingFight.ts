import type { Vector3 } from 'three';
import type { BossBrain, BossScript } from '@wildshard/engine/ai/BossBrain';
import { fnv1a32, Rng, type RngState } from '@wildshard/engine/core/rng';
import { KINGS_CLEARING } from '../layout';
import { PINE_LEVEL_SEED } from './eliteStreams';
import { PINE_STRIKES, pineContact } from './strikes';
import type { Lane, LaneBody, LaneState } from './lane';
import type { KingGoalEnv } from '../runtime/KingGoals';
import { phasedBossFight, type RoamingBossFight } from '@wildshard/sdk/phasedBoss';
import { ANTLER_KING_FIGHT } from '../data/kingFight';

/** the arena's threshold, the soft wall, the fog wall and his own leash round the clearing's centre (m) */
export const KING_ARENA_IN = 22, KING_WALL_R = 27.5, KING_FOG_R = 31, KING_LEASH_R = 24;

/** A body the King's fight drives: his own, or a thrall's (the page's Animal, the headless host's body). */
export interface KingBody extends LaneBody { hp: number; readonly maxHp: number; herd: number; place: (x: number, z: number, yaw: number) => void }
/** What the King's fight reads of the world beyond his goals' (the page's PineCtx over its Player, the host's player). */
export interface KingCoreEnv<B extends KingBody> extends KingGoalEnv<B> {
  readonly player: { readonly position: Vector3; readonly onGround: boolean; shove: (fromX: number, fromZ: number, speed: number) => void };
}

/** The King's two random streams (SF72), from the level seed alone in the browser and headless alike: where a thrall walks
 *  out of the fog (`pine.king.call`, one draw a thrall) and when it starts down its lane (`pine.king.charge`, a draw a tick
 *  in range), each a uniform [0, 1) draw as Math.random was. */
export interface PineKingStreams { readonly call: Rng; readonly charge: Rng }
export function pineKingStreams(seed: number = PINE_LEVEL_SEED): PineKingStreams {
  return { call: new Rng(fnv1a32(`${String(seed)}:pine.king.call`)), charge: new Rng(fnv1a32(`${String(seed)}:pine.king.charge`)) };
}

/** A fallen lantern burning where it landed: its spot, its fall (−1 out, 0..1 falling, 1 burning) and its burn's bite clock. */
export interface KingLantern { x: number; z: number; y: number; fallT: number; acc: number }
/** A thrall the King called: its body, its lane and whether it is running it. */
export interface KingThrall<B extends KingBody> { a: B; lane: Lane<B>; mode: 'approach' | 'charge' }

/** The fight's own continuation beside BossBrain's (the headless runtime's `fight`; bodies by entity id). */
export interface KingFightState {
  king: string | null; present: boolean; sealed: boolean; sealK: number; darkK: number; glow: number; invuln: boolean; lockHp: number; won: boolean;
  phase: number; mode: string; modeT: number; sweepCd: number; stompCd: number; callCd: number; laneN: number; open: number;
  lane: LaneState; waves: { r: number; on: boolean; hit: boolean; delay: number }[]; lanterns: KingLantern[];
  thralls: { a: string; lane: number; mode: 'approach' | 'charge' }[]; thrallLanes: LaneState[]; rngs: RngState[];
}

/** The page and native adapter bind the same declared phasedBoss policy, retaining the shipped continuation schema. */
export abstract class AntlerKingCore<B extends KingBody> implements BossScript {
  protected abstract readonly ctx: KingCoreEnv<B>;
  protected abstract readonly tellRing: {setTime:(t:number)=>void;ring:(x:number,z:number,r:number,alpha:number)=>void;hide:()=>void};
  protected abstract readonly waves: {r:number;on:boolean;hit:boolean;delay:number}[];
  protected abstract readonly lane: Lane<B>;
  protected abstract readonly thrallLanes: readonly Lane<B>[];
  protected abstract action(k:B,action:'roar'|'sweep'|'strike'|'brace'):void;
  protected abstract roar(k:B):void;
  protected readonly rng: PineKingStreams;
  private readonly platform: RoamingBossFight<B,LaneState,RngState>;
  protected constructor(seed:number=PINE_LEVEL_SEED) {
    this.rng=pineKingStreams(seed);
    const player=()=>this.ctx.player;
    this.platform=phasedBossFight(ANTLER_KING_FIGHT,{
      player:{get position(){return player().position;},get onGround(){return player().onGround;},shove:(x,z,speed)=>this.ctx.player.shove(x,z,speed)},
      groundAt:(x,z)=>this.groundAt(x,z),
      body:{make:()=>this.makeKing(),retire:a=>this.retireKing(a),park:a=>this.parkKing(a),unpark:a=>this.unparkKing(a)},
      adds:{spawn:(kind,x,z,yaw)=>this.spawnThrall(kind,x,z,yaw),retire:a=>this.retireThrall(a),lanes:()=>this.thrallLanes},
      lane:()=>this.lane,rings:()=>this.waves,random:this.rng,
      contact:(a,strike,hit,options)=>{
        const spec=strike==='sweep'?PINE_STRIKES.sweep:strike==='roots'?PINE_STRIKES.roots:strike==='lantern'?PINE_STRIKES.lantern:undefined;
        if(spec===undefined)throw new Error(`Unknown Antler King strike ${strike}`);
        return pineContact(a,this.ctx.player.position,spec,hit,()=>this.ctx.reach(a,this.ctx.player.position),options);
      },
      weakPoint:p=>this.onRibs(p),hurt:(a,damage,through)=>this.ctx.hurt(a,damage,through),trauma:v=>this.ctx.trauma(v),shot:(sound,at)=>this.ctx.shot(sound,at),
      views:{glow:v=>this.glowTo(v),hung:on=>this.lanternsHung(on),focus:(a,out)=>this.introFocus(a,out),room:(dt,t)=>this.room(dt,t),light:on=>{if(on)this.lightOn();else this.lightOff();},
        action:(a,move)=>this.action(a,move),roar:a=>this.roar(a),burst:a=>this.stompFx(a),hazard:(i,f,t,event)=>this.lanternView(i,f,t,event),add:(a,event)=>this.thrallView(a,event),ring:(i,t,at)=>this.waveView(i,t,at),
        tell:{setTime:t=>this.tellRing.setTime(t),ring:(x,z,r,alpha)=>this.tellRing.ring(x,z,r,alpha),hide:()=>this.tellRing.hide()}},
    });
  }
  get king():B|null{return this.platform.body;}
  set king(a:B|null){this.platform.body=a;}
  get phase():number{return this.platform.phase;}
  set phase(v:number){this.platform.phase=v;}
  get mode():string{return this.platform.mode;}
  set mode(v:string){this.platform.mode=v;}
  protected get present():boolean{return this.platform.present;}
  protected set present(on:boolean){this.platform.present=on;}
  protected get thralls():RoamingBossFight<B,LaneState,RngState>['adds']{return this.platform.adds;}
  protected get lanterns():RoamingBossFight<B,LaneState,RngState>['hazards']{return this.platform.hazards;}
  protected get sealK():number{return this.platform.sealK;}
  protected get darkK():number{return this.platform.darkK;}
  protected get glow():number{return this.platform.glow;}
  protected get open():number{return this.platform.open;}
  protected get won():boolean{return this.platform.won;}
  // ── the hosts' bodies and views ──
  /** the terrain's height (the page's terrainHeight, the host's height query) */
  protected abstract groundAt(x: number, z: number): number;
  /** a fresh King body at the clearing (the old one, if any, already retired) */
  protected abstract makeKing(): B;
  protected abstract retireKing(k: B): void;
  /** out of every list (AI, aim, hitboxes) and hidden, kept for tonight; and back */
  protected abstract parkKing(k: B): void;
  protected abstract unparkKing(k: B): void;
  /** a thrall of `kind` walking out of the fog at (x, z), and its retirement */
  protected abstract spawnThrall(kind: 'elk' | 'boar', x: number, z: number, yaw: number): B;
  protected abstract retireThrall(a: B): void;
  /** the point a hit lands on is his ribcage (the weak point: the page's model; headless has no model yet) */
  protected onRibs(_p: Vector3): boolean { return false; }
  /** views: the ribcage's glow, the lanterns hung on his rack, the intro's camera focus, the room's tick (fog wall, puffs,
   *  ribcage, light), a lantern's fall / burn, a thrall's arrival or exit, the light's release */
  protected glowTo(_v: number): void { /* view */ }
  protected lanternsHung(_on: boolean): void { /* view */ }
  protected introFocus(k: B, out: Vector3): Vector3 { return out.copy(k.position); }
  protected room(_dt: number, _t: number): void { /* view */ }
  protected lanternView(_i: number, _f: KingLantern, _t: number, _event: 'drop' | 'fall' | 'land' | 'burn' | 'out' | 'placed'): void { /* view */ }
  protected thrallView(_a: B, _event: 'in' | 'out'): void { /* view */ }
  protected lightOn(): void { /* view */ }
  protected lightOff(): void { /* view */ }
  protected stompFx(_k: B): void { /* view */ }

  protected waveView(_i:number,_t:number,_at:Vector3|null):void { /* view */ }
  get weatherHold():number{return this.platform.sealK;}
  get hpFrac():number{return this.platform.hpFrac;}
  get shielded():boolean{return this.platform.shielded;}
  get dead():boolean{return this.platform.dead;}
  inArena(p:Vector3):boolean{return this.platform.inArena(p);}
  seal(on:boolean):void{this.platform.seal(on);}
  clampHp(v:number):void{this.platform.clampHp(v);}
  setInvulnerable(on:boolean):void{this.platform.setInvulnerable(on);}
  rewardPoint():Vector3{return this.platform.rewardPoint();}
  respawnPoint():{pos:Vector3;yaw:number}{return this.platform.respawnPoint();}
  protected spawnKing():B{return this.platform.spawn();}
  setPresent(on:boolean):void{this.platform.setPresent(on);}
  reset(phase:number):void{this.platform.reset(phase);}
  intro(t:number,short:boolean):Vector3{return this.platform.intro(t,short);}
  begin(phase:number):void{this.platform.begin(phase);}
  enterPhase(phase:number):void{this.platform.enterPhase(phase);}
  victory():void{this.platform.victory();}
  update(dt:number,t:number,fighting:boolean):void{this.platform.update(dt,t,fighting);}
  damageMul(a:B,p:Vector3):number{return this.platform.damageMul(a,p);}
  /** Preserve the exact persisted SF72 field order and schemas while policy state is owned by phasedBoss. */
  fightState(id:(a:B)=>string):KingFightState {
    const s=this.platform.snapshot(id);
    return {king:s.body,present:s.present,sealed:s.sealed,sealK:s.sealK,darkK:s.darkK,glow:s.glow,invuln:s.invuln,lockHp:s.lockHp,won:s.won,
      phase:s.phase,mode:s.mode,modeT:s.modeT,sweepCd:s.strikeCd,stompCd:s.burstCd,callCd:s.summonCd,laneN:s.chain,open:s.open,
      lane:s.lane,waves:s.rings,lanterns:s.hazards,thralls:s.adds,thrallLanes:s.addLanes,rngs:s.rngs};
  }
  /** Translate the legacy continuation, then restore actual bodies, charge runners and the two original streams. */
  restoreFight(s:KingFightState,find:(id:string)=>B|null):void {
    this.platform.restore({body:s.king,present:s.present,sealed:s.sealed,sealK:s.sealK,darkK:s.darkK,glow:s.glow,invuln:s.invuln,lockHp:s.lockHp,won:s.won,
      phase:s.phase,mode:s.mode,modeT:s.modeT,strikeCd:s.sweepCd,burstCd:s.stompCd,summonCd:s.callCd,chain:s.laneN,open:s.open,
      lane:s.lane,rings:s.waves,hazards:s.lanterns,adds:s.thralls,addLanes:s.thrallLanes,rngs:s.rngs},find);
  }
}

/** Before the boss brain's tick: the King comes at night when the player is within 80 m (armed at the stones) and goes by
 *  day or past 110 m (the page's AntlerKing and the headless step alike). */
export function kingPresence<B extends KingBody>(boss: BossBrain, fight: AntlerKingCore<B>, player: { readonly x: number; readonly z: number }, night: boolean): void {
  const d = Math.hypot(player.x - KINGS_CLEARING.x, player.z - KINGS_CLEARING.z), s = boss.state;
  if (s === 'dormant') { if (night && d < 80) { fight.setPresent(true); boss.arm(); } }
  else if ((s === 'armed' || s === 'victory') && (d > 110 || !night)) { boss.disarm(); fight.setPresent(false); }
}
/** After the boss brain's tick: a dormant fight still ticks its room (the brain ticks the script in every other state). */
export function kingDormant<B extends KingBody>(boss: BossBrain, fight: AntlerKingCore<B>, dt: number, t: number): void {
  if (boss.state === 'dormant') fight.update(dt, t, false);
}
/** The page's whole King tick: presence, the boss brain, the dormant room (headless runs the three as its own steps). */
export function kingTick<B extends KingBody>(boss: BossBrain, fight: AntlerKingCore<B>, player: { readonly x: number; readonly z: number }, night: boolean, dt: number, t: number): void {
  kingPresence(boss, fight, player, night);
  boss.update(dt, t);
  kingDormant(boss, fight, dt, t);
}
