// oxlint-disable-next-line import/no-nodejs-modules -- Content-address admitted immutable rows; every mutable clock remains in the continuation.
import {createHash} from 'node:crypto';
import * as v from 'valibot';
import {Vector3} from 'three';
import {BossBrain,type BossPorts,type BossPresentation,type BossSaved,type BossContinuation} from '../../src/engine/ai/BossBrain';
import type {Scope} from '../../src/engine/app/scope';
import {bossFight,type PhasedBossBody,type PhasedBossPorts,type PhasedBossContinuation} from '../../src/game/plugin/bossPhase';
import {ArenaPortalLaw,type ArenaPortalSnapshot} from '../../src/game/boss/arenaPortal';
import type {ArenaRoomGround} from '../../src/game/boss/arenaGround';
import type {NalatiKingData} from './nalati-king-data';

const finite=v.pipe(v.number(),v.finite()),positive=v.pipe(finite,v.minValue(0));
const Saved=v.strictObject({version:v.literal(1),recipe:v.string(),boss:v.unknown(),fight:v.unknown(),
  portal:v.strictObject({inside:v.boolean(),elapsed:positive,fade:finite,pending:v.nullable(v.picklist(['enter','exit']))}),
  calmWas:v.boolean(),locked:v.boolean(),slow:v.boolean(),sealed:v.boolean()});
export type KingContinuationRows=Pick<NalatiKingData,'room'|'entrance'|'profile'>&{readonly encounter:Pick<NalatiKingData['encounter'],'definition'|'portal'>};
/** Detached data; controllers cannot retain a mutable body or a kernel method. */
export interface KingBodyObservation {
  readonly id:string;readonly position:readonly[number,number,number];readonly head:readonly[number,number,number];
  readonly hp:number;readonly maxHp:number;readonly alive:boolean;readonly scale:number;readonly yaw:number;readonly attackPhase:number;readonly act:number;
}
export interface KingObservation {
  readonly inside:boolean;readonly state:string;readonly phase:number;readonly shielded:boolean;readonly armourBroken:boolean;readonly mode:string;
  readonly body:KingBodyObservation|null;readonly adds:readonly KingBodyObservation[];
}
/** Only actual entered owners supply these ports. The tape receives the read
 * surface below, never reset, damage, teleport, saved records or this owner. */
export interface KingContinuationPorts<B extends PhasedBossBody> {
  readonly scope:Scope;readonly ground:ArenaRoomGround;
  readonly player:{readonly position:Vector3;readonly velocity:Vector3;yaw:number;pitch:number};
  readonly population:{calm:boolean};readonly moveScale:{read:()=>number;write:(value:number)=>void};
  readonly fight:PhasedBossPorts<B>;readonly boss:BossPorts;readonly ui:BossPresentation;readonly saved:BossSaved;
  readonly identify:(body:B)=>string;readonly find:(id:string)=>B|null;
  readonly publishPlayer:()=>void;readonly present:(on:boolean)=>void;readonly sealed:()=>boolean;readonly advanceRoom:(dt:number,time:number)=>void;
}
export interface KingSaved {
  readonly version:1;readonly recipe:string;readonly boss:BossContinuation;readonly fight:PhasedBossContinuation;
  readonly portal:ArenaPortalSnapshot;readonly calmWas:boolean;readonly locked:boolean;readonly slow:boolean;readonly sealed:boolean;
}
/** Original BossBrain + phased fight + portal decisions, with the page's
 * ordered numeric portal operations. Ground/physics/poses/records stay owned
 * outside this continuation and are restored before its validation barrier. */
export class KingContinuation<B extends PhasedBossBody> {
  private readonly portal:ArenaPortalLaw;
  private readonly phased;
  private readonly boss:BossBrain;
  private readonly recipe:string;
  private calmWas=false;private locked=false;private slow=false;private seal=false;
  constructor(private readonly rows:KingContinuationRows,private readonly ports:KingContinuationPorts<B>,program:ConstructorParameters<typeof ArenaPortalLaw>[0]) {
    this.live();
    if(ports.boss.player.position!==ports.player.position)throw new Error('King must borrow the actual entered player');
    this.recipe=createHash('sha256').update(JSON.stringify({room:rows.room,entrance:rows.entrance,profile:rows.profile,definition:rows.encounter.definition,portal:rows.encounter.portal},
      (_key,value:unknown):unknown=>typeof value==='number'&&Object.is(value,-0)?{'king.number':'-0'}:value)).digest('hex');
    this.portal=new ArenaPortalLaw(program,rows.encounter.portal,rows.entrance);
    this.phased=bossFight<B>(rows.profile,{...ports.fight,arena:{...ports.fight.arena,seal:on=>{this.seal=on;ports.fight.arena.seal(on);}}});
    this.boss=new BossBrain({...rows.encounter.definition,reward:{}},this.phased.script,{...ports.boss,
      lockInput:on=>{this.locked=on;this.move();ports.boss.lockInput(on);}},ports.ui,ports.saved);
  }
  private live():void {if(this.ports.scope.disposed||this.ports.scope.disposing)throw new Error('King continuation retired');}
  private move():void {this.ports.moveScale.write(this.locked?0:this.slow?this.rows.encounter.portal.slow:1);}
  /** Read-only controller observations. No gameplay or continuation mutator is lent. */
  observe():KingObservation {
    this.live();const read=(body:B):KingBodyObservation=>{
      const head=body.headWorld(new Vector3());
      return {id:this.ports.identify(body),position:[body.position.x,body.position.y,body.position.z],head:[head.x,head.y,head.z],
        hp:body.hp,maxHp:body.maxHp,alive:body.alive,scale:body.scale,yaw:body.yaw,attackPhase:body.attackPhase,act:body.mem[this.rows.profile.fight.fields.act]??0};
    };
    const body=this.phased.body();
    return {inside:this.portal.inside,state:this.boss.state,phase:this.boss.phase,shielded:this.phased.script.shielded,
      armourBroken:this.phased.armourBroken(),mode:this.phased.mode(),body:body===null?null:read(body),adds:this.phased.adds().map(read)};
  }
  private enter(immediate=false):void {
    const {portal}=this.rows.encounter;
    if(!immediate){this.portal.begin('enter',portal.fade.hold);return;}
    const {player,population}=this.ports,origin=this.rows.room.origin;
    player.position.set(origin.x+portal.spawn.x,origin.y,origin.z+portal.spawn.z);
    player.velocity.set(0,0,0);player.yaw=portal.spawn.yaw;player.pitch=0;this.ports.publishPlayer();
    this.portal.inside=true;this.calmWas=population.calm;population.calm=true;
    this.ports.present(true);this.boss.arm();
  }
  private leave(teleport:boolean,immediate=false):void {
    const {portal}=this.rows.encounter;
    if(teleport&&!immediate){this.portal.begin('exit',portal.fade.hold);return;}
    const {player}=this.ports,e=this.rows.entrance;
    if(teleport){player.position.set(e.x-Math.sin(e.facing)*portal.exitOffset,e.y,e.z-Math.cos(e.facing)*portal.exitOffset);
      player.yaw=e.facing;player.pitch=0;player.velocity.set(0,0,0);this.ports.publishPlayer();}
    this.portal.inside=false;this.ports.population.calm=this.calmWas;this.boss.disarm();this.ports.present(false);
    this.slow=false;this.locked=false;this.move();
  }
  update(dt:number,time:number):void {
    this.live();const {player,ground}=this.ports,p=player.position,origin=this.rows.room.origin;
    const step=this.portal.step(dt,()=>({px:p.x,py:p.y,pz:p.z,floor:ground.floorAt(p.x,p.z),volume:ground.inVolume(p),
      engaged:this.boss.engaged,sand:ground.inChamber(p)?ground.sandAt(p.x-origin.x,p.z-origin.z):0,originY:origin.y,originZ:origin.z}));
    if(step.kind==='fading')return;
    if(step.kind==='faded'){if(step.pending==='enter')this.enter(true);else if(step.pending==='exit')this.leave(true,true);return;}
    if(step.kind==='decided'){
      if(!this.portal.inside){if(step.enter)this.enter();}
      else if(step.exit!==0){this.leave(step.exit===2);return;}
      if(this.portal.inside){this.slow=step.slow;this.move();}
    }
    if(!this.portal.inside)return;
    const floor=ground.floorAt(p.x,p.z),limits=this.rows.encounter.portal.floor;
    if(floor!==undefined&&p.y<floor-limits.tolerance&&p.y>floor-limits.depth){p.y=floor;if(player.velocity.y<0)player.velocity.y=0;this.ports.publishPlayer();}
    this.boss.update(dt,time);this.ports.advanceRoom(dt,time);
  }
  /** Open the original room owner once: its page constructs/reset(0) while
   * hidden, before the later real portal arm/reset. Closed loans do neither. */
  open():void {
    this.live();if(this.boss.state!=='dormant'||this.phased.body()!==null)throw new Error('King room owner already opened');
    this.phased.script.reset(0);this.ports.present(false);
  }
  onPlayerDeath():boolean {this.live();return this.boss.onPlayerDeath();}
  takeReward():boolean {this.live();return this.boss.takeReward();}
  snapshot():KingSaved {this.live();return {version:1 as const,recipe:this.recipe,boss:this.boss.snapshot(),fight:this.phased.continuation(this.ports.identify),
    portal:this.portal.snapshot(),calmWas:this.calmWas,locked:this.locked,slow:this.slow,sealed:this.seal};}
  restore(input:unknown):void {
    this.live();const saved=v.parse(Saved,input),{ports,rows}=this;
    if(saved.recipe!==this.recipe||ports.moveScale.read()!==(saved.locked?0:saved.slow?rows.encounter.portal.slow:1)
      ||saved.portal.inside&&!ports.population.calm||ports.sealed()!==saved.sealed)throw new Error('King continuation differs from its restored owners');
    // Both original kernels validate metadata in private candidates first.
    // Neither candidate resets, spawns, damages, binds or consumes entropy.
    const candidate=bossFight<B>(rows.profile,{...ports.fight,body:{...ports.fight.body,bind:()=>undefined}});
    candidate.restore(saved.fight,ports.find);
    const boss=new BossBrain({...rows.encounter.definition,reward:{}},candidate.script,ports.boss,ports.ui,{...ports.saved});
    if(saved.boss===null||typeof saved.boss!=='object')throw new Error('Missing King boss continuation');
    const bossSaved=v.parse(v.strictObject({state:v.picklist(['dormant','armed','intro','fight','beat','victory']),phase:positive,checkpoint:positive,
      attempts:positive,t:positive,skipT:positive,short:v.boolean(),saved:v.strictObject({defeated:v.boolean(),rewardTaken:v.boolean(),kills:positive})}),saved.boss);
    boss.restore(bossSaved);
    this.phased.restore(saved.fight,ports.find);this.boss.restore(bossSaved);this.portal.restore(saved.portal);
    this.calmWas=saved.calmWas;this.locked=saved.locked;this.slow=saved.slow;this.seal=saved.sealed;
  }
}
