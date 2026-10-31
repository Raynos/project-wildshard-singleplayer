import * as v from 'valibot';
import {Vector3} from 'three';
import type {SimHost} from '../../src/engine/sim';
import type {HuntBody} from '../../src/engine/ai/hunt';
import type {NativeEliteBindings} from '../../src/engine/ai/eliteRoster';
import type {AnimalSim} from '../../src/engine/entities/AnimalSim';
import {onSimHostRestored} from '../../src/engine/sim/snapshot';
import {ObservationColumnsV2} from '../../src/engine/script/observationColumnsV2';
import {parseActorProjectionV2} from '../../src/format/actorProjectionV2';
import {SpeciesActorsFileSchema} from '../../src/format/speciesBookRows';
import {TimedEncountersSchema} from '../../src/format/encounterRows';
import {SceneDressingSchema} from '../../src/format/sceneDressing';
import {parseClientPlan} from '../../src/format/clientPlan';
import {ActorProjectionV2,type ActorProjectionContext} from '../../src/game/population/actorProjectionV2';
import {ReturnProgram} from '../../src/game/population/returnProgram';
import {nativePopulationOf} from '../../src/game/riding/nativePopulation';
import {attachNativeCreaturePose,type NativeCreaturePose} from '../../src/game/plugin/animation';
import {SlotEncounterLaw,type SlotTell} from '../../src/game/boss/slotLaw';
import {prepareNalatiTitan} from './nalati-titan-native';
import {readNalatiArenaIntake} from './nalati-arena-intake';
import {readNalatiArenaPoses} from './nalati-arena-poses';
import {NalatiCreatureView} from './nalati-creature-view-native';
import {nalatiSlotColliders} from './nalati-slot-colliders';
import {readNalatiWeaponObservation} from './nalati-weapon-observation';
import {restoreEncounterBrains} from './restoreEncounterBrains';
import type {NalatiEncounterIntake} from './nalati-headless';
import type {PrepareHeadlessRuntime} from '../../src/sdk/headlessRuntime';

const finite=v.pipe(v.number(),v.finite()),natural=v.pipe(finite,v.integer(),v.minValue(0));
const Saved=v.strictObject({version:v.literal(1),law:v.unknown(),sites:v.array(v.boolean()),view:v.unknown(),
  poses:v.pipe(v.array(v.tuple([v.string(),v.string()])),v.maxLength(16)),
  cues:v.pipe(v.array(v.strictObject({id:v.string(),point:v.tuple([finite,finite,finite]),normal:v.tuple([finite,finite,finite])})),v.maxLength(256)),
  tells:v.pipe(v.array(v.array(finite)),v.maxLength(8)),contacts:natural,arenaAdds:v.exactOptional(v.pipe(v.array(v.string()),v.maxLength(16)))});
export interface NativeNalatiBalbals {readonly law:SlotEncounterLaw<HuntBody,SlotTell>;readonly contacts:()=>number;readonly adoptAdd:(body:HuntBody)=>void}
export interface NalatiBalbalPreparation {readonly intake:NalatiEncounterIntake;readonly bindings:(host:SimHost,bindings:NativeEliteBindings)=>void}
const owners=new WeakMap<SimHost,NativeNalatiBalbals>();
export function nalatiBalbalsOf(host:SimHost):NativeNalatiBalbals|undefined{return owners.get(host);}
function actualContext(input:unknown):input is ActorProjectionContext<HuntBody> {
  if(typeof input!=='object'||input===null||!('player' in input)||!(input.player instanceof Vector3))return false;
  return ['dt','t','playerSpeed'].every(key=>typeof Reflect.get(input,key)==='number'&&Number.isFinite(Reflect.get(input,key)))
    &&typeof Reflect.get(input,'calm')==='boolean'&&['steer','reach','hurt','sound','pathYaw','confine'].every(key=>typeof Reflect.get(input,key)==='function');
}

/** Original timed slots and H4 actor decisions, on their admitted native
 * species, real weapons, contact poses and retained statue colliders. */
export async function prepareNalatiBalbals(preparation:Parameters<PrepareHeadlessRuntime>[0],extra?:NalatiBalbalPreparation):Promise<Awaited<ReturnType<PrepareHeadlessRuntime>>>{
  const product=preparation.product,plan=parseClientPlan(product.section('client/plan'));
  const timed=plan.features.find(row=>row.kind==='timed.encounters'),view=plan.features.find(row=>row.kind==='view.program'&&row.id==='creature-views');
  if(timed?.kind!=='timed.encounters'||view?.kind!=='view.program')throw new Error('Balbals require their original timed encounter and creature view');
  const scenes=v.parse(v.object({dressing:v.object({phone:v.string()})}),product.section('world/scenes'));
  const [intake,poses,timing,actors,dressing,module]=await Promise.all([
    readNalatiArenaIntake(product,['balbal']),readNalatiArenaPoses(product,['balbal']),
    product.json(timed.file).then(input=>v.parse(TimedEncountersSchema,input)),
    product.json('actors/sheep.json').then(input=>v.parse(SpeciesActorsFileSchema,input)),
    product.json(scenes.dressing.phone).then(input=>v.parse(SceneDressingSchema,input)),product.file(view.module),
  ]);
  const entry=actors.species.lookBook.rows.find(row=>row.metadata.kind===timing.slots.actors?.kind),projectionRows=entry?.projection;
  const sites=dressing.sites.find(row=>row.name===timed.sites)?.rows;
  if(entry===undefined||projectionRows===undefined||sites===undefined||entry.metadata.kind!=='balbal')throw new Error('Missing original balbal projection or standing sites');
  const projected=parseActorProjectionV2(projectionRows),damage=projected.damage;
  if(damage===undefined||projected.step===undefined)throw new Error('Balbals require all original think and damage requests');
  const bindings=new WeakMap<SimHost,NativeEliteBindings>(),updates=new WeakMap<SimHost,(dt:number)=>void>(),
    poseUpdates=new WeakMap<SimHost,(dt:number)=>void>();
  const combined=extra===undefined?intake:{...extra.intake,species:[...intake.species,...extra.intake.species],recipes:[...intake.recipes,...extra.intake.recipes]};
  const base=await prepareNalatiTitan(preparation,{intake:combined,beforePatrol:(host,dt)=>{
    const run=updates.get(host);if(run===undefined)throw new Error('Timed slots did not bind before their original patrol slot');run(dt);
  },bindings:(host,owner)=>{
    bindings.set(host,owner);
    host.onStep('nalati.balbal-poses',dt=>{const run=poseUpdates.get(host);
      if(run===undefined)throw new Error('Balbal contacts did not bind before the body publication slot');run(dt);},undefined,'afterBodies');
    extra?.bindings(host,owner);
  }});
  return {...base,install:(host,context)=>{
    base.install(host,context);
    const population=nativePopulationOf(host),elite=bindings.get(host),clock=host.dayClock;
    if(population===undefined||elite===undefined||clock===undefined||owners.has(host))throw new Error('Balbal owner lacks its original population and day clock');
    const poseRows=poses.rows,animations=poses.animations((x,z)=>host.groundHeightAt(x,z)),presented=new Map<string,NativeCreaturePose>();
    const projection=new ActorProjectionV2(entry.metadata.kind,projected),brain=ReturnProgram.native(host,projected.program);
    const ownedBrains=new Map<AnimalSim,NonNullable<ReturnType<NativeEliteBindings['brains']['get']>>>();
    const columns=damage.requests.map(row=>new ObservationColumnsV2(row.columns,host.scope));
    const arenaAdds=new Set<string>();let contacts=0;
    const bind=(body:HuntBody):void=>{
      const recipe=poseRows.find(row=>row.kind===body.kind&&row.variant===body.variant),animate=animations.get(body.kind);
      if(recipe===undefined||animate===undefined||presented.has(body.entityId))throw new Error('Balbal body lost its actual contact recipe');
      const attached=attachNativeCreaturePose(body,recipe.pose,animate);presented.set(body.entityId,attached.pose);
      const bound:NonNullable<ReturnType<NativeEliteBindings['brains']['get']>>={think:(actor,c)=>{
        if(actor!==body||!actualContext(c))throw new Error('Balbal decision lost its actual native observations');
        projection.step(body,c,{scope:host.scope,group:entry.metadata.kind,slot:0,identity:body.entityId});
      },act:()=>undefined};ownedBrains.set(body,bound);elite.brains.set(body,bound);
      body.combatActor().damageMul=request=>{
        const weapon=host.adapters.get('nalati.weapons');if(weapon===undefined)throw new Error('Balbal damage requires its actual held owner');
        const equipment=readNalatiWeaponObservation(weapon);
        const results:Record<string,number>={};
        for(const [index,query]of damage.requests.entries()){
          const table=columns[index];if(table===undefined)throw new Error('Missing balbal damage columns');
          const values=Object.fromEntries(table.capture({scope:host.scope,self:{group:entry.metadata.kind,slot:0,identity:body.entityId,actor:body},
            observed:new Map(),player:{position:body.position},t:0,dt:0,hit:request.point,request,
            equipment:equipment.enabled?equipment.slot:'',results}).map(row=>[row.name,row.value]));
          Object.assign(results,brain.project(query.signal,values));
        }
        const value=results[damage.result];if(value===undefined||!Number.isFinite(value))throw new Error('Missing actual balbal damage result');return value;
      };
    };
    const cues:{id:string;point:[number,number,number];normal:[number,number,number]}[]=[],tells:number[][]=Array.from({length:timing.view.tell.pool},()=>[]);
    const wedges:SlotTell[]=tells.map(values=>({hide:()=>{values.splice(0);},wedge:(...args)=>{values.splice(0,values.length,...args);}}));
    const standing=nalatiSlotColliders(host,sites),law=new SlotEncounterLaw<HuntBody,SlotTell>(timing.slots,timing.view,ReturnProgram.native(host,timing.program),{
      sites:sites.sites.map((site,index)=>({x:site.x,z:site.z,yaw:site.yaw,variant:sites.variantCycle[index%sites.variantCycle.length]??0})),
      wedges,guest:brain,ground:(x,z)=>host.groundHeightAt(x,z),cosmetic:()=>host.rng.stream('cosmetic').next(),
      cues:{cue:(id,point,normal)=>{cues.push({id,point:point.toArray(),normal:normal.toArray()});if(cues.length>256)cues.shift();}}});
    law.attachActors({factory:{model:(kind,variant)=>{population.validateSpawn(kind,variant);return kind;}},
      spawn:(kind,x,z,yaw,variant)=>{const body=population.spawnElite(kind,x,z,yaw,variant);bind(body);return body;},
      retire:body=>{population.retireElite(body);elite.brains.delete(body);ownedBrains.delete(body);presented.delete(body.entityId);}});
    for(const body of population.bodies)if(body.kind===entry.metadata.kind)bind(body);
    if(context.restoring)onSimHostRestored(host,()=>{restoreEncounterBrains(ownedBrains,elite.brains,
      body=>!host.scope.disposed&&!host.scope.disposing&&host.entities.get(body.entityId)===body&&body.kind===entry.metadata.kind&&presented.has(body.entityId));});
    const viewOwner=new NalatiCreatureView(module,view.rows,host.scope,()=>population.bodies,(x,z)=>host.groundHeightAt(x,z));
    host.events.on('damage.dealt',event=>{if(event.req.target===host.player.health)contacts++;},host.scope);
    const update=(dt:number):void=>{
      for(const change of law.update(dt,{kind:Number(timing.phases.slots.includes(clock.dayPhase))}))standing.set(change.index,change.awake===1);
    };
    updates.set(host,update);
    host.onStep('nalati.balbals',()=>undefined,{snapshot:()=>JSON.stringify({version:1,law:law.snapshot(body=>body.entityId),sites:standing.snapshot(),view:viewOwner.snapshot(),
      poses:[...presented].map(([id,pose])=>[id,pose.snapshot()]),cues,tells,contacts,...(arenaAdds.size===0?{}:{arenaAdds:[...arenaAdds]})}),restore:value=>{
      if(typeof value!=='string')throw new Error('Balbal continuation requires its original string envelope');
      const parsed:unknown=JSON.parse(value),saved=v.parse(Saved,parsed);
      if(saved.tells.length!==tells.length||saved.poses.length!==population.bodies.filter(body=>body.kind===entry.metadata.kind).length
        ||new Set(saved.poses.map(([id])=>id)).size!==saved.poses.length)throw new Error('Balbal continuation lost its original roster');
      for(const [id,wire]of saved.poses){const pose=presented.get(id);if(pose===undefined)throw new Error('Missing restored balbal pose');pose.restore(wire);}
      const body=(id:string):HuntBody|null=>population.bodies.find(actor=>actor.entityId===id&&actor.kind===entry.metadata.kind)??null;
      law.restore(saved.law,body);standing.restore(saved.sites);viewOwner.restore(saved.view);
      const additions=saved.arenaAdds??[];if(new Set(additions).size!==additions.length||additions.some(id=>body(id)===null||law.awake.some(row=>row.a.entityId===id)))throw new Error('Foreign arena add identity');
      arenaAdds.clear();for(const id of additions)arenaAdds.add(id);
      cues.splice(0,cues.length,...saved.cues);saved.tells.forEach((values,index)=>{tells[index]?.splice(0,tells[index]?.length??0,...values);});contacts=saved.contacts;
    },physicsRestored:standing.physicsRestored});
    poseUpdates.set(host,dt=>{
      viewOwner.frame(dt);
      for(const [id,pose]of presented){const body=host.entities.get(id),step=host.bodyDt(id);if(body===undefined)throw new Error('Balbal contact owner retired unexpectedly');
        if(step<=0)continue;pose.advance(step,host.clock.now,body.position.distanceToSquared(host.player.position)<140*140);pose.publish();}
    });
    owners.set(host,{law,contacts:()=>contacts,adoptAdd:body=>{
      if(host.scope.disposed||host.scope.disposing||body.kind!==entry.metadata.kind||host.entities.get(body.entityId)!==body
        ||!population.bodies.includes(body)||law.awake.some(row=>row.a===body)||arenaAdds.size>=16||arenaAdds.has(body.entityId))throw new Error('Foreign or retired native arena add');
      bind(body);arenaAdds.add(body.entityId);
    }});host.scope.onDispose(()=>{owners.delete(host);bindings.delete(host);updates.delete(host);poseUpdates.delete(host);presented.clear();ownedBrains.clear();arenaAdds.clear();});
  }};
}
export const prepareHeadlessRuntime:PrepareHeadlessRuntime=preparation=>prepareNalatiBalbals(preparation);
