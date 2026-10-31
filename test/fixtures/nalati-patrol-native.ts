import * as v from 'valibot';
import {Vector3,Ray} from 'three';
import {nearestJointHit,type JointPorts} from '../../src/game/boss/jointTargets';
import type {DamageRequest} from '../../src/engine/combat/pipeline';
import type {nativeRangedHit} from '../../src/game/plugin/nativeItems';
import type {HuntBody} from '../../src/engine/ai/hunt';
import type {SimHost} from '../../src/engine/sim';
import type {PrepareHeadlessRuntime} from '../../src/sdk/headlessRuntime';
import {decodeTerrainTile} from '../../src/format/terrainTileBytes';
import {SpeciesActorsFileSchema} from '../../src/format/speciesBookRows';
import {EliteReadiness} from '../../src/engine/ai/eliteScript';
import {parseExternalElite} from '../../src/format/eliteFeature';
import {TimedEncountersSchema} from '../../src/format/encounterRows';
import {ReturnProgram} from '../../src/game/population/returnProgram';
import {DirectedLaw} from '../../src/game/population/directedLaw';
import {nativePopulationOf} from '../../src/game/riding/nativePopulation';
import {nativeHerdCollection} from '../../src/game/shardfile/groupRuntime';
import {PatrolLaw} from '../../src/game/boss/patrolLaw';
import {NativeCreaturePose} from '../../src/game/plugin/animation';
import {ProjectileLaw} from '../../src/engine/combat/projectileLaw';
import {StrikeRunner} from '../../src/engine/ai/strikes';
import {strikeFromData} from '../../src/engine/ai/strikeRows';
import {canReach} from '../../src/engine/ai/reach';
import {floorBelow,worldHit} from '../../src/engine/physics/query';
import {CHUNK_HALF} from '../../src/format/contentBounds';
import {pinBrain} from '../../src/engine/ai/pinning';
import {readNalatiPatrolIntake} from './nalati-patrol-intake';
import {readNalatiPatrolPoses} from './nalati-patrol-poses';
import {prepareHeadlessRuntime as prepareNalati,type NalatiEncounterIntake} from './nalati-headless';

const finite=v.pipe(v.number(),v.finite()),natural=v.pipe(finite,v.integer(),v.minValue(0));
const vector=v.tuple([finite,finite,finite]);
const ContactSource=v.strictObject({id:v.string(),kind:v.string(),label:v.string(),at:vector,head:vector,
  yaw:finite,scale:finite,bodyY:finite,bodyRadius:finite});
type PatrolContactSource=Pick<HuntBody,'entityId'|'kind'|'label'|'position'|'yaw'|'scale'|'headWorld'> & {
  readonly dims:{readonly bodyY:number;readonly bodyRadius:number};
};
const projection=v.strictObject({state:v.record(v.string(),finite),elapsed:v.pipe(finite,v.minValue(0))});
const Saved=v.strictObject({law:v.strictObject({cycle:projection,motion:projection,groups:v.pipe(v.array(projection),v.maxLength(64)),
  riders:v.pipe(v.array(v.strictObject({id:v.string(),law:projection,group:v.pipe(finite,v.integer(),v.minValue(-1)),slot:natural,steering:v.record(v.string(),finite)})),v.maxLength(64))}),
  readiness:v.strictObject({readyTime:finite,initialized:v.boolean(),eligible:v.boolean()}),
  poses:v.pipe(v.array(v.tuple([v.string(),v.string()])),v.maxLength(64)),shooter:v.nullable(ContactSource),shots:natural,hits:natural,
  flying:v.pipe(v.array(v.strictObject({active:v.boolean(),age:finite,glanced:v.boolean(),pos:vector,vel:vector,origin:vector,scale:finite})),v.maxLength(1024)),stopped:v.unknown()});

export interface NativeNalatiPatrol {
  readonly law:PatrolLaw<HuntBody,NativeCreaturePose>;
  readonly readiness:EliteReadiness;
  readonly shots:()=>number;
  readonly hits:()=>number;
  readonly target:(from:Vector3,direction:Vector3,distance:number,hit:ReturnType<typeof nativeRangedHit>)=>ReturnType<typeof nativeRangedHit>;
  readonly aimPoint:(body:HuntBody,out:Vector3)=>void;
}
const owners=new WeakMap<SimHost,NativeNalatiPatrol>();
export function nalatiPatrolOf(host:SimHost):NativeNalatiPatrol|undefined{return owners.get(host);}

/** A later entered arena may add recipes and borrow the same native body
 * scheduler. Defaults preserve the original patrol preparation exactly. */
export interface NalatiPatrolExtras {
  readonly intake:NalatiEncounterIntake;
  readonly bindings:NonNullable<Parameters<typeof prepareNalati>[5]>;
  /** TimedEncounters updates its original slot owner immediately before patrol. */
  readonly beforePatrol?:(host:SimHost,dt:number)=>void;
}

/** Bind the same night cycle, directed riders, numeric contact joints and
 * covered projectile hits. Inputs cannot request a spawn, night, kill or gate. */
export async function prepareNalatiPatrol(preparation:Parameters<PrepareHeadlessRuntime>[0],
  eliteDamage?:(host:SimHost,actor:HuntBody,request:DamageRequest)=>number,
  afterPatrol?:(host:SimHost,dt:number)=>void,
  observeWeather?:Parameters<typeof prepareNalati>[4],extras?:NalatiPatrolExtras):Promise<Awaited<ReturnType<PrepareHeadlessRuntime>>>{
  const product=preparation.product;
  const [intake,poseRows,rows,actors,assembly]=await Promise.all([
    readNalatiPatrolIntake(product),readNalatiPatrolPoses(product),
    product.json<unknown>('combat/timed-encounters.json').then(value=>v.parse(TimedEncountersSchema,value)),
    product.json<unknown>('actors/sheep.json').then(value=>v.parse(SpeciesActorsFileSchema,value)),
    product.json<unknown>('sim/headless-assembly.json').then(value=>v.parse(v.object({constants:v.object({nativeTaming:v.object({herds:v.string()}),pageElites:v.object({borrowed:v.array(v.unknown())})})}),value)),
  ]);
  const declared=rows.patrol.actors,metadata=actors.species.lookBook.rows.find(row=>row.metadata.kind===declared?.kind);
  if(declared===undefined||metadata?.directed===undefined||actors.species.lookBook.program===undefined)throw new Error('Patrol requires its admitted directed species owner');
  const directed=metadata.directed,programRows=actors.species.lookBook.program;
  const external=assembly.constants.pageElites.borrowed.map(parseExternalElite).find(row=>row.mode==='script'&&row.spawn.variant===declared.leader);
  if(external===undefined)throw new Error('Patrol requires its actual script-elite readiness owner');
  const combined=extras===undefined?intake:{...extras.intake,species:[...intake.species,...extras.intake.species],recipes:[...intake.recipes,...extras.intake.recipes]};
  const base=await prepareNalati(preparation,decodeTerrainTile,combined,undefined,observeWeather,extras?.bindings);
  return {...base,install:(host,context)=>{
    // The page advances timed encounters before native population movement.
    // Register that phase now, but restore its state only after body owners.
    let advance:(dt:number)=>void=()=>{throw new Error('Patrol installed incompletely');};
    host.onStep('nalati.patrol.advance',dt=>{extras?.beforePatrol?.(host,dt);advance(dt);afterPatrol?.(host,dt);});
    base.install(host,context);
    const population=nativePopulationOf(host),clock=host.dayClock;
    if(population===undefined||clock===undefined||owners.has(host))throw new Error('Native patrol requires its original population and day clock');
    const {wind:poseWind}=nativeHerdCollection(host,assembly.constants.nativeTaming.herds);
    const brain=ReturnProgram.native(host,rows.program),decisions=ReturnProgram.native(host,programRows);
    population.bindSpecies(declared.kind,new DirectedLaw(directed,()=>decisions),(actor,request)=>eliteDamage?.(host,actor,request)??1);
    let restoringViews=false;
    const readiness=new EliteReadiness();
    const poses=new Map<string,NativeCreaturePose>(),scopes=new Map<string,ReturnType<typeof host.scope.child>>();
    const present=(body:HuntBody,quiet:boolean):NativeCreaturePose=>{
      if(poses.has(body.entityId))throw new Error('Patrol cannot re-present a live contact owner');
      const recipe=poseRows.rows.find(row=>row.kind===body.kind&&row.variant===body.variant);
      if(recipe===undefined)throw new Error('Patrol rider lacks its actual contact pose');
      const scope=host.scope.child('patrol-actor');scopes.set(body.entityId,scope);
      if(quiet){if(!restoringViews)body.scale*=rows.ride.quietScale;pinBrain(body,scope);}
      const pose=new NativeCreaturePose(body,recipe.pose);poses.set(body.entityId,pose);
      body.sampleTerrain=()=>{pose.sampleTerrain();};body.headWorld=out=>{pose.headWorld(out);return out;};
      return pose;
    };
    const law=new PatrolLaw(rows.patrol,rows.motion,brain,{player:host.player,random:host.rng.stream('ai'),aimRandom:()=>host.rng.stream('ai'),present});
    law.attachActors({factory:{model:(kind,variant)=>{population.validateSpawn(kind,variant);return kind;}},
      spawn:population.spawnElite,retire:body=>{population.retireElite(body);poses.delete(body.entityId);scopes.get(body.entityId)?.dispose();scopes.delete(body.entityId);}});
    const seat=new Vector3(),aim=new Vector3(),direction=new Vector3(),contact=new StrikeRunner(),strike=strikeFromData(rows.contact.strike);
    const hits:{from:PatrolContactSource|null;point:Vector3;dir:Vector3}[]=[];
    let shooter:PatrolContactSource|null=null,shots=0,totalHits=0;
    const sourceHead=new Vector3();
    const {geometry:_geometry,colour:_colour,renderOrder:_order,...arrowKind}=rows.ride.arrow;
    const arrows=new ProjectileLaw(arrowKind,{
      feet:host.player.position,extent:CHUNK_HALF+80,
      floorAt:(x,y,z)=>floorBelow(host.physics,x,z,y+.3,60)??host.groundHeightAt(x,z),
      world:(from,to,radius)=>worldHit(host.physics,from,to,radius),targets:()=>null,wind:()=>null,
      surface:wall=>wall.material==='flesh'?'flesh':wall.material==='wood'||wall.material==='planks'?'wood':'ground',
      random:()=>host.rng.stream('gameplay').next(),canRecover:()=>true,recover:()=>undefined,
      flight:()=>({}),stuck:()=>null,moved:()=>undefined,ended:()=>undefined,settled:()=>undefined,changed:()=>undefined,removed:()=>undefined,impact:()=>undefined,
      playerHit:(point,dir)=>{hits.push({from:shooter,point:point.clone(),dir:dir.clone()});},targetHit:()=>{throw new Error('Patrol arrow cannot select an animal target');},hit:()=>undefined,
    });
    if(arrowKind.hitsAnimals)throw new Error('Patrol requires its original player-only arrow contacts');
    host.onStep('nalati.patrol-poses',()=>{
      for(const [id,pose] of poses){
        const body=population.bodies.find(row=>row.entityId===id),dt=host.bodyDt(id);
        if(body===undefined)throw new Error('Patrol contact pose lost its original body');
        if(dt<=0)continue;
        const near=body.position.distanceToSquared(host.player.position)<140*140;
        pose.advance(dt,host.clock.now,near);if(near)poseRows.postPose(pose.context,poseWind);pose.publish();
      }
    },undefined,'afterBodies');
    advance=dt=>{
      hits.length=0;
      const effects=law.step(dt,{hold:0,night:Number(rows.phases.patrol.includes(clock.dayPhase))});
      readiness.observe(external,decisions,dt,law.killsTonight);
      for(let i=law.riders.length-1;i>=0;i--){
        const rider=law.riders[i];if(rider===undefined)throw new Error('Patrol roster changed during ordered effects');
        const effect=effects.get(rider),body=rider.a;
        if(effect?.['retire']===1){law.retire(i);continue;}
        if(rider.law.state[rows.ride.states.dead]===1||body.hidden)continue;
        if(effect?.['shoot']===1){
          rider.view.jointPoint(rows.ride.figure.bone,rows.ride.seat,seat);seat.y+=rows.ride.lift.loose*body.scale;
          const out=law.aim(rows.ride.aim,seat);shooter=body;
          arrows.launch(seat,aim.set(out['dx']??0,out['dy']??0,out['dz']??0),{damageScale:1});shots++;
        }
      }
      // PatrolEncounterView leaves Projectiles.wind and onRecover unbound.
      // Keep null wind and real recovery/FIFO draws without an ammo grant.
      arrows.update(dt);
      for(const hit of hits){
        const actor=hit.from??law.riders[0]?.a;if(actor===undefined)continue;
        if(!contact.contains(strike,{actor,target:host.player.position,...(rows.contact.origin==='player'?{origin:host.player.position}:{})})||!canReach(actor,host.player.position,host.physics))continue;
        host.combat.hit({source:'env',sourceTags:rows.contact.tags,target:host.player.health,amount:rows.ride.damage,point:actor.position,dir:direction.set(0,0,0),cause:{kind:actor.kind,label:actor.label}});totalHits++;
      }
    };
    host.onStep('nalati.patrol',()=>undefined,{snapshot:()=>JSON.stringify({law:law.snapshot(),readiness:readiness.snapshot(),poses:[...poses].map(([id,pose])=>[id,pose.snapshot()]),shooter:shooter===null?null:{id:shooter.entityId,kind:shooter.kind,label:shooter.label,at:shooter.position.toArray(),
        head:shooter.headWorld(sourceHead).toArray(),yaw:shooter.yaw,scale:shooter.scale,bodyY:shooter.dims.bodyY,bodyRadius:shooter.dims.bodyRadius},shots,hits:totalHits,
      flying:arrows.pool.slots.map(slot=>({active:slot.active,age:slot.age,glanced:slot.glanced,pos:slot.pos.toArray(),vel:slot.vel.toArray(),origin:slot.origin.toArray(),scale:slot.scale})),
      stopped:arrows.stopped.snapshot(body=>{const id=population.bodies.find(row=>row===body)?.entityId;if(id===undefined)throw new Error('Patrol projectile lost its admitted body');return id;})}),restore:value=>{
      if(typeof value!=='string')throw new Error('Patrol continuation must retain its original string envelope');
      const parsed:unknown=JSON.parse(value),saved=v.parse(Saved,parsed);
      if(saved.flying.length!==arrows.pool.slots.length||saved.poses.length!==saved.law.riders.length||new Set(saved.poses.map(([id])=>id)).size!==saved.poses.length)throw new Error('Patrol continuation has a different contact roster');
      const body=(id:string):HuntBody=>{const actor=population.bodies.find(row=>row.entityId===id);if(actor===undefined)throw new Error('Patrol continuation lost its original body');return actor;};
      for(const scope of scopes.values())scope.dispose();scopes.clear();poses.clear();
      readiness.restore(saved.readiness);
      restoringViews=true;try{law.restore(saved.law,body);}finally{restoringViews=false;}
      for(const [id,wire]of saved.poses){const pose=poses.get(id);if(pose===undefined)throw new Error('Patrol continuation lost its original pose');pose.restore(wire);}
      saved.flying.forEach((row,index)=>{const slot=arrows.pool.slots[index];if(slot===undefined)throw new Error('Missing patrol flight slot');Object.assign(slot,{active:row.active,age:row.age,glanced:row.glanced,scale:row.scale,hitScale:undefined});slot.pos.fromArray(row.pos);slot.vel.fromArray(row.vel);slot.origin.fromArray(row.origin);});
      arrows.stopped.restore(saved.stopped,body);
      const source=saved.shooter;
      // A retired arrow source is a contact query, never a replacement actor.
      // The page retains that same body's final pose after roster retirement.
      shooter=source===null?null:population.bodies.find(actor=>actor.entityId===source.id)??{
        entityId:source.id,kind:source.kind,label:source.label,position:new Vector3().fromArray(source.at),yaw:source.yaw,scale:source.scale,
        dims:{bodyY:source.bodyY,bodyRadius:source.bodyRadius},headWorld:out=>out.fromArray(source.head),
      };
      shots=saved.shots;totalHits=saved.hits;
    }});
    const ray=new Ray(),crossing=new Vector3();
    const joints:JointPorts<(typeof law.riders)[number],HuntBody>={
      actor:rider=>rider.a,dead:rider=>rider.law.state[rows.ride.states.dead]===1,
      joint:(rider,at,out)=>rider.view.jointPoint(rows.ride.figure.bone,at,out),
    };
    const target:NativeNalatiPatrol['target']=(from,heading,distance,original)=>{
      ray.set(from,heading);
      const found=nearestJointHit(ray,original===null?distance:Math.min(distance,original.distance),law.riders,joints,rows.ride.targets,crossing);
      return found===null?original:{body:found.actor,point:crossing.clone(),distance:found.distance,head:found.head};
    };
    const aimPoint:NativeNalatiPatrol['aimPoint']=(body,out)=>{
      const rider=law.riders.find(row=>row.a===body),point=rows.ride.targets.find(row=>row.head);
      if(rider===undefined||point===undefined)throw new Error('Missing original patrol target joint');
      rider.view.jointPoint(rows.ride.figure.bone,point.at,out);
    };
    owners.set(host,{law,readiness,shots:()=>shots,hits:()=>totalHits,target,aimPoint});host.scope.onDispose(()=>{owners.delete(host);poses.clear();scopes.clear();});
  }};
}

export const prepareHeadlessRuntime:PrepareHeadlessRuntime=preparation=>prepareNalatiPatrol(preparation);
