import { nalatiNativeAssembly } from './nalati-native-assembly';
import * as v from 'valibot';
import {PerspectiveCamera,Vector3} from 'three';
import {BossBrain,easeViewToward,type BossPresentation} from '../../src/engine/ai/BossBrain';
import {pickPrompt} from '../../src/engine/world/interact/prompts';
import {itemPickupFloor,ITEM_PICKUP_HOVER} from '../../src/engine/world/interact/pickup';
import type {SimHost} from '../../src/engine/sim';
import {onSimHostRestored} from '../../src/engine/sim/snapshot';
import type {HuntBody} from '../../src/engine/ai/hunt';
import type {PrepareHeadlessRuntime} from '../../src/sdk/headlessRuntime';
import {parseClientPlan} from '@wildshard/format/clientPlan';
import {OpenArenaFight,readArenaScriptData,type ArenaSupportRider} from '../../src/game/boss/openArenaFight';
import {OpenArenaRoom} from '../../src/game/boss/openArenaRoom';
import {bindArenaPoseView} from './native-hosts/boss/arenaPoseView';
import {arenaTie,arenaBoundary} from '../../src/game/boss/arenaAnswers';
import {mountedPlayerOf} from '../../src/game/riding/native';
import {respawnNativeMounted} from '../../src/game/riding/nativeTaming';
import {nativeGroupCollection} from '../../src/game/shardfile/groupRuntime';
import {applyWeatherCover,type WeatherReactions} from '../../src/game/weather/reactions';
import type {Wind} from '../../src/engine/world/steppeWind';
import {ledgerPorts} from '../../src/game/plugin/simulation';
import {prepareNalatiPatrol,nalatiPatrolOf,type NalatiPatrolExtras} from './nalati-patrol-native';
import {withNalatiCompanions} from './nalati-companions-native';
import {withNalatiWeapons,nalatiWeaponsOf} from './nalati-weapons-native';
import {prepareNalatiChapterRecords,type NalatiChapterRecords} from './nalati-chapter-records';
import {titanNativeViews} from './nalati-titan-views';
import {TitanSaved} from './nalati-titan-state';
import { leadPlayer } from '@wildshard/engine/sim/leadPlayer';

export interface NativeNalatiTitan {readonly fight:OpenArenaFight;readonly boss:BossBrain;readonly locked:()=>boolean;readonly reward:()=>boolean;readonly storm:()=>boolean;
  readonly records:NalatiChapterRecords;readonly weather:()=>{state:string;left:number};readonly rewardPrompt:()=>{position:Vector3;radius:number;label:string}|null}
const owners=new WeakMap<SimHost,NativeNalatiTitan>();
export function nalatiTitanOf(host:SimHost):NativeNalatiTitan|undefined{return owners.get(host);}

export interface NalatiTitanPreparation extends NalatiPatrolExtras {
  /** A genuinely unopened Titan may lend input validation to the other
   * entered encounter, after every primary adapter has restored. */
  readonly closedInputOwner?:(host:SimHost)=>void;
}

/** The real open-arena owner over native weather, mounted inputs, patrol
 * actors, heart contacts and declared saves. No command arms or damages it. */
export async function prepareNalatiTitan(preparation:Parameters<PrepareHeadlessRuntime>[0],extras?:NalatiTitanPreparation):Promise<Awaited<ReturnType<PrepareHeadlessRuntime>>>{
  const product=preparation.product,data=await readArenaScriptData(product,{fight:'combat/titan-fight.json',geometry:'combat/titan-geometry.json'});
  const plan=parseClientPlan(product.section('client/plan'));
  const view=plan.features.find(row=>row.kind==='view.program'&&row.id==='titan-view');
  if(view?.kind!=='view.program')throw new Error('Titan requires its admitted pose view');
  const module=await product.file(view.module),installRecords=await prepareNalatiChapterRecords(product);
  const assembly=v.parse(v.object({constants:v.object({nativePopulation:v.object({groups:v.string()})})}),await nalatiNativeAssembly());
  const weather=new WeakMap<SimHost,{wind:Wind;storm:WeatherReactions}>();
  const shares=new WeakMap<SimHost,Map<HuntBody,(scale:number,x:number,z:number)=>number>>();
  const updates=new WeakMap<SimHost,(dt:number)=>void>();
  const patrol:PrepareHeadlessRuntime=input=>prepareNalatiPatrol(input,
    (host,actor,request)=>shares.get(host)?.get(actor)?.(actor.scale,request.point.x,request.point.z)??1,
    (host,dt)=>{const run=updates.get(host);if(run===undefined)throw new Error('Titan owner was not installed before patrol advance');run(dt);},
    (host,actual)=>{weather.set(host,actual);},extras);
  const composed=withNalatiWeapons(withNalatiCompanions(async input=>{
    const base=await patrol(input);
    return {...base,install:(host,context)=>{
      // The page samples its encounter answer before the weather advances.
      // Bind before base.install registers that same native weather clock.
      host.onStep('nalati.titan.weather-cover',()=>{
        const owner=owners.get(host),actual=weather.get(host);
        if(owner===undefined||actual===undefined)throw new Error('Titan weather cover lost its entered owners');
        applyWeatherCover(actual.storm.weather,actual.storm.inputs,host.events.ask('weather.indoors',0)>0,owner.boss.engaged);
      });
      base.install(host,context);
      const actual=weather.get(host),mount=mountedPlayerOf(host),patrolOwner=nalatiPatrolOf(host);
      const env=nativeGroupCollection(host,assembly.constants.nativePopulation.groups).environment;
      if(actual===undefined||mount===undefined||patrolOwner===undefined||env===undefined||owners.has(host))throw new Error('Titan requires its actual world owners');
      const records=installRecords(host,ledgerPorts(context.emit)),camera=new PerspectiveCamera();
      let locked=false,reward=false,bar=false,rewardPoint:Vector3|null=null;
      const toasts:string[]=[],feeds:string[]=[],support=new Map<number,HuntBody>(),damageShares=new Map<HuntBody,(scale:number,x:number,z:number)=>number>();
      shares.set(host,damageShares);
      const toast=(line:string):void=>{toasts.push(line);if(toasts.length>256)toasts.shift();};
      const feed=(line:string):void=>{feeds.push(line);if(feeds.length>256)feeds.shift();};
      const prompt={position:new Vector3(data.arena.anchor.x,host.groundHeightAt(data.arena.anchor.x,data.arena.anchor.z)+data.view.promptLift,data.arena.anchor.z),radius:0,label:data.lines.tie};
      const weapons=():NonNullable<ReturnType<typeof nalatiWeaponsOf>>=>{const owner=nalatiWeaponsOf(host);
        if(owner===undefined)throw new Error('Titan requires its actual held equipment owner');return owner;};
      const room=new OpenArenaRoom(host,data,(player,position,yaw)=>{respawnNativeMounted(host,position,yaw,data.view.respawn,player.id);weapons().refill();});
      const hit=room.contact;
      const rider=(body:HuntBody):ArenaSupportRider=>({body,share:law=>{if(law===null)damageShares.delete(body);else damageShares.set(body,law);},
        dissolve:()=>{patrolOwner.law.dissolve(body);}});
      const encounter:{boss?:BossBrain}={};
      const fight=new OpenArenaFight({scope:host.scope,weather:actual.storm,tieSpot:null,ai:()=>host.rng.stream('ai'),fog:()=>null,
        camera,wild:env,phone:true,ground:(x,z)=>host.groundHeightAt(x,z),wind:actual.wind},{player:room.party.player,
        get boss(){return encounter.boss??null;},get engaged(){return encounter.boss?.engaged??false;},mounted:room.mounted,
        contact:hit,throwRider:room.throwRider,horseSteed:room.horseSteed,heartScale:room.heartScale,feed,toast,
        riderOwner:()=>({spawnRider:at=>{
          const body=patrolOwner.law.spawnRider(at);if(body===null)throw new Error('Admitted Titan support rider could not spawn');
          const site=data.supportSites.findIndex(row=>row.x===at.x&&row.z===at.z);
          if(site===-1)throw new Error('Titan support spawned outside its admitted site');support.set(site,body);return rider(body);
        }})},data,titanNativeViews(host,data));
      bindArenaPoseView(fight,module,view.rows,{scope:host.scope,player:{position:leadPlayer(host).position,velocity:mount.rider.velocity,get yaw(){return leadPlayer(host).yaw;}},camera});
      const ui:BossPresentation={update:()=>undefined,get barShown(){return bar;},hideBar:()=>{bar=false;},hideNameCard:()=>undefined,
        hideReward:()=>undefined,showRetry:()=>undefined,showNameCard:()=>undefined,setSkip:()=>undefined,showBar:()=>{bar=true;},
        setHp:()=>undefined,setShield:()=>undefined,setPhase:()=>undefined};
      const current=records.bosses.read()[data.definition.id]??{defeated:false,rewardTaken:false,kills:0};
      const boss=new BossBrain({...data.definition,reward:{}},fight,{events:host.events,player:room.party.player,lockInput:on=>{
        locked=on;leadPlayer(host).moveScale=on?0:1;weapons().setEnabled(!on);},
        respawn:room.party.respawn,
        skipHeld:()=>context.commands().some(command=>command.kind==='script'&&command.actorId==='nalati.titan.skip'&&command.value===1),
        faceToward:(target,dt)=>{const p=leadPlayer(host).position;camera.position.set(p.x,p.y+1.68,p.z);
          easeViewToward(weapons().look,camera.position,target,dt);},spawnReward:()=>{
          const at=itemPickupFloor(host.physics,fight.rewardPoint());rewardPoint=new Vector3(at.x,at.y+ITEM_PICKUP_HOVER+.5,at.z);reward=true;
        },persist:saved=>{records.bosses.write({...records.bosses.read(),[data.definition.id]:saved});},toast,feed},ui,current);
      encounter.boss=boss;room.bind(boss,fight);leadPlayer(host).health.checkpoint(host.scope,()=>room.party.died(boss));
      const boundaryPorts={boss,fight,prompt,get player(){return room.near.position;},toast,
        wall:()=>{hit('wall',room.near.position,data.view.wallDamage,data.lines.wall);},clear:()=>{actual.storm.weather.force(data.weather.clearing);},
        persistence:records.outcomes};
      const run=(dt:number):void=>{
        for(const command of context.commands())if(command.kind==='script'&&command.actorId==='nalati.titan.use'){
          if(command.value!==1)throw new Error('Invalid Titan interaction input');
          const p=leadPlayer(host).position;
          if(pickPrompt([prompt],{x:p.x,y:p.y+1.68,z:p.z},host.physics)===prompt)
            arenaTie(fight.life,{engaged:boss.engaged,victory:boss.state==='victory',hit:reward,mounted:room.mounted(),storm:actual.storm.stormActive},data.tieLines,{boss,fight,toast});
        }
        room.party.observe(boss);
        if(boss.state!=='dormant'||fight.body.visible)boss.update(dt,host.clock.now);else fight.update(dt,host.clock.now,false);
        const answer=fight.takeBoundary();if(answer!==null)arenaBoundary(answer,data.lines,data.record,boundaryPorts);
      };
      updates.set(host,run);owners.set(host,{fight,boss,records,locked:()=>locked,reward:()=>reward,storm:()=>actual.storm.stormActive,
        weather:()=>({state:actual.storm.weather.state,left:actual.storm.weather.phaseLeft}),
        rewardPrompt:()=>rewardPoint===null?null:{position:rewardPoint.clone(),radius:2.6,label:data.reward.prompt}});
      host.scope.onDispose(()=>{owners.delete(host);updates.delete(host);shares.delete(host);weather.delete(host);});
      if(context.restoring&&extras?.closedInputOwner!==undefined){
        const check=extras.closedInputOwner;
        onSimHostRestored(host,()=>{
          const saved=boss.snapshot().saved;
          if(owners.get(host)?.boss!==boss||owners.get(host)?.fight!==fight||locked||boss.state!=='dormant'||fight.tied||reward||saved.defeated||saved.rewardTaken||saved.kills!==0)
            throw new Error('Only a closed Titan may lend its input restore check');
          check(host);
        });
      }
      host.onStep('nalati.titan',()=>undefined,{snapshot:()=>{
        const state=fight.snapshot();
        return JSON.stringify({version:1,fight:state,boss:boss.snapshot(),locked,reward,...(rewardPoint===null?{}:{rewardPoint:rewardPoint.toArray()}),bar,prompt:{radius:prompt.radius,label:prompt.label},
          support:state.riders.map(({site})=>{const body=support.get(site);if(body===undefined)throw new Error('Titan support lost its actual site');return [site,body.entityId];}),
          toasts:[...toasts],feeds:[...feeds],contacts:room.contacts,...(room.party.engaged===0?{}:{engaged:room.party.engaged})});},
        restore:value=>{
          const saved=v.parse(TitanSaved,typeof value==='string'?JSON.parse(value):value);
          if(saved.reward!==(saved.rewardPoint!==null))throw new Error('Titan reward continuation lost its actual pickup point');
          const restored=new Map(saved.support.map(([site,id])=>{const body=patrolOwner.law.riders.find(row=>row.a.entityId===id)?.a;
            if(body===undefined)throw new Error('Titan continuation lost its actual support actor');return [site,body] as const;}));
          fight.restore(saved.fight,site=>{const body=restored.get(site);return body===undefined?null:rider(body);});boss.restore(saved.boss);
          support.clear();for(const [site,body]of restored)support.set(site,body);locked=saved.locked;reward=saved.reward;rewardPoint=saved.rewardPoint===null?null:new Vector3().fromArray(saved.rewardPoint);bar=saved.bar;
          if(extras?.closedInputOwner===undefined){
            if(leadPlayer(host).moveScale!==(locked?0:1))throw new Error('Titan input lock differs from the restored native motor owner');
            weapons().setEnabled(!locked);
          }
          prompt.radius=saved.prompt.radius;prompt.label=saved.prompt.label;toasts.splice(0,toasts.length,...saved.toasts);feeds.splice(0,feeds.length,...saved.feeds);room.contacts=saved.contacts;room.party.restoreEngaged(saved.engaged??0);
        }});
    }};
  }),(host,from,dir,distance,hit)=>nalatiPatrolOf(host)?.target(from,dir,distance,hit)??hit,{
    ray:(host,from,dir,distance,hit)=>{const owner=owners.get(host);if(owner===undefined)throw new Error('Missing Titan target owner');return owner.fight.target(from,dir,distance,hit);},
    key:(host,target)=>owners.get(host)?.fight.combatTarget===target?'encounter:storm-titan:heart':null,
    resolve:(host,id)=>id==='encounter:storm-titan:heart'?owners.get(host)?.fight.combatTarget??null:null,
  });
  return composed(preparation);
}

export const prepareHeadlessRuntime:PrepareHeadlessRuntime=preparation=>prepareNalatiTitan(preparation);
