import {GrazerBrain as OriginalGrazerBrain} from './fixtures/grazer-herd-original';
import {lendNalatiPasture} from './fixtures/nalati-return-modules';
import {scriptAdmissionRows} from '../src/format/scriptContract';
import {NALATI_SCRIPT_SECTIONS} from '../src/shards/nalati-grasslands/generators/scriptInventory';
import {expect,test,vi} from 'vitest';
import {GroupStepV2,prepareGroupNativeV2,type GroupStepOperationV2,type GroupStepReferenceV2,type GroupStepNativeResultV2} from '../src/engine/script/groupStepV2';
import {ObservationColumnsV2,type V2ColumnOwners} from '../src/engine/script/observationColumnsV2';

import * as v from 'valibot';
import {Vector3} from 'three';
import {AnimalSim} from '../src/engine/entities/AnimalSim';
import {HerdBrain,type HerdSpec,type HerdPorts,type HerdContext} from '../src/engine/ai/herd';
import {Scope} from '../src/engine/app/scope';
import {Rng} from '../src/engine/core/rng';
import {GroupBankV2} from '../src/engine/script/groupBankV2';
import type {GroupBankValueV2} from '../src/format/scriptGroupBankV2';
import type {GroupGuestFrameV2} from '../src/engine/ai/GroupBrain';
import {ReturnProgram} from '../src/game/population/returnProgram';
import binding from '../src/shards/nalati-grasslands/data/herdGuest.json' with {type:'json'};
import pasture from '../src/shards/nalati-grasslands/behaviour/pasture.generated.json' with {type:'json'};

const modes=['graze','drift','alert','flee','settle'],states=['watch','warn','display','charge','wheel','lead','beaten','ridden'];
const savedSchema=v.looseObject({state:v.record(v.string(),v.unknown()),lead:v.nullable(v.string()),stallion:v.nullable(v.string()),ridden:v.nullable(v.string()),chargeTarget:v.nullable(v.string()),foals:v.array(v.string()),mothers:v.array(v.tuple([v.string(),v.string()]))});
const saved=(herd:Pick<HerdBrain<AnimalSim>,'snapshot'>)=>v.parse(savedSchema,JSON.parse(herd.snapshot()));
function makeBody(id:string,variant:string,x:number,z:number,scale=1):AnimalSim{
 const a=new AnimalSim({kind:'horse',label:'Horse',variant,rarity:'common',hp:100,aggressive:false,
 dims:{bodyY:1.2,bodyHalfLen:1,bodyRadius:.4,headRadius:.25,legLen:.7,feet:[],halfWidth:.4},
 mods:{speed:1,chargeDist:1,damageTaken:1,chargeDamage:5,relentless:false}},.312,scale,id,{heightAt:()=>0,random:()=>.5});
 a.position.set(x,0,z);a.yaw=.7;a.mem['aw']=.3;return a;
}
class NativeHerd extends HerdBrain<AnimalSim>{
 captures=0;
 scalarReads=0;
 observeCapture:((frame:GroupGuestFrameV2)=>void)|undefined;
 protected override herdGuestScalars(){this.scalarReads++;return super.herdGuestScalars();}
 protected override captureGuest(replies:readonly GroupStepNativeResultV2[]){this.captures++;const frame=super.captureGuest(replies);this.observeCapture?.(frame);return frame;}
 captureValues(){return this.captureHerdGuestState();}
 captureRoles(actor:AnimalSim){return this.captureHerdGuestRoles(actor);}
 prepareValues(values:Readonly<Record<string,GroupBankValueV2>>,references:readonly (GroupStepReferenceV2&{body:AnimalSim})[],scope:Scope){return this.prepareHerdGuestState(values,references,scope);}
}
const spec:HerdSpec={walkSpeed:2,trotSpeed:5,gallopSpeed:10,chargeSpeed:11,sightRadius:45,grazingSightRadius:20,coneAngle:1.2,hearing:[4,8,15,30],alertThreshold:.6,flightMinDistance:80,flightMaxDistance:120,stallionVariant:'stallion',foalPrefix:'foal',snortCue:'snort',neighCue:'neigh',squealCue:'squeal'};
class OriginalHerd extends OriginalGrazerBrain<AnimalSim>{
 constructor(members:AnimalSim[],definition:HerdSpec,ports:HerdPorts<AnimalSim>){super(members,{pattern:'herd',spec:definition,ports});}
 override snapshot():string{return this.snapshotHerd();}
}
type FixtureHerd=Pick<HerdBrain<AnimalSim>,'findThreat'|'initialize'|'snapshot'|'restore'|'mode'>;
function makeFixture<H extends FixtureHerd>(Owner:new(members:AnimalSim[],definition:HerdSpec,ports:HerdPorts<AnimalSim>)=>H,
 mode:string,stallionState:string,mutate=false,count=4,seed=905){
 const roster=[makeBody('mare-a','mare',-3,1,1.2),makeBody('foal-a','foal-a',-1,3,.8),makeBody('stallion','stallion',8,5),makeBody('mare-b','mare',10,2)];
 if(count<roster.length)roster.length=count;
 while(roster.length<count){const i=roster.length;roster.push(makeBody(`mare-${i}`,'mare',i*2-5,i%3+2));}
 const random=new Rng(seed),contextRandom=new Rng(seed+1002),log:(string|number)[][]=[];
 const ports:HerdPorts<AnimalSim>={sharedRng:()=>random,environment:()=>({playerMounted:false,playerCrouched:false}),visibility:()=>1,hearing:()=>8,downwind:()=>false,inBounds:()=>true,normalY:()=>1,
 passThrough:(a,through)=>{log.push(['pass',a.entityId,Number(through)]);},chargeContact:(a,_c,r)=>{log.push(['contact',a.entityId,r]);},scarePack:()=>false};
 const pending:AnimalSim[]=[],threats:AnimalSim[]=[];const herd=new Owner(roster,spec,ports);herd.initialize();
 herd.findThreat=(x,z,r)=>{let nearest:AnimalSim|null=null,distance=r;for(const actor of threats)if(actor.alive){const d=Math.hypot(actor.position.x-x,actor.position.z-z);if(d<distance){nearest=actor;distance=d;}}return nearest;};ports.resolveActor=id=>[...threats,...pending].find(actor=>actor.entityId===id)??null;
 const snapshot=saved(herd);Object.assign(snapshot.state,{mode,stallionState,cx:3,cz:2,spotX:45,spotZ:20,spotT:40,fleeX:.6,fleeZ:.8,fleeLen:100,fleeRun:12,modeT:1,sT:.6});herd.restore(JSON.stringify(snapshot));
 const scope=new Scope('herd-drive'),player=new Vector3(12,0,16);
 const ctx:HerdContext<AnimalSim>={dt:.1,t:2,player,playerSpeed:.4,calm:false,rng:contextRandom,
 sound:cue=>{log.push(['sound',cue]);},hurt:amount=>{log.push(['hurt',amount]);},
 steer:(a,yaw,speed,turn)=>{log.push(['steer',a.entityId,yaw,speed,turn]);a.setMotion(yaw,speed,turn);if(mutate){a.position.x+=.5;herd.mode='alert';}},
 pathYaw:(a,x,z,every)=>{log.push(['path',a.entityId,x,z,every??0]);return Math.atan2(x-a.position.x,z-a.position.z)+.03;},confine:a=>{log.push(['confine',a.entityId]);}};
 for(const a of roster){const original=a.setMotion.bind(a);a.setMotion=(yaw,speed,turn)=>{log.push(['motion',a.entityId,yaw,speed,turn??2.5]);original(yaw,speed,turn);};}
 return{roster,pending,threats,random,contextRandom,log,herd,ports,scope,ctx};
}
const fixture=(mode:string,state:string,mutate=false,count=4,seed=905)=>makeFixture(NativeHerd,mode,state,mutate,count,seed);
const oracleFixture=(mode:string,state:string,mutate=false,count=4,seed=905)=>makeFixture(OriginalHerd,mode,state,mutate,count,seed);
function numbers(actual:unknown,expected:unknown):void{
 if(typeof expected==='number'&&typeof actual==='number'){
  // G415: AS owns trig. Its libm may differ by one ULP; native effects,
  // ordering, RNG progression and the historical continuation stay exact.
  expect(Math.abs(actual-expected)).toBeLessThanOrEqual(1e-12*Math.max(1,Math.abs(expected)));return;
 }
 if(Array.isArray(expected)&&Array.isArray(actual)){expect(actual.length).toBe(expected.length);expected.forEach((value,index)=>{numbers(actual[index],value);});return;}
 if(expected!==null&&actual!==null&&typeof expected==='object'&&typeof actual==='object'){
  expect(Object.keys(actual)).toEqual(Object.keys(expected));for(const [key,value]of Object.entries(expected))numbers(Reflect.get(actual,key),value);return;
 }expect(actual).toEqual(expected);
}
const guestOwners=new WeakMap<NativeHerd,Map<string,AnimalSim>>();
function execute(f:ReturnType<typeof fixture>,slot:number,asBody=false,signal='drive',args:Readonly<Record<string,number>>={}){
 let actors=guestOwners.get(f.herd);
 if(actors===undefined){const original=f.herd.snapshot();actors=bindNativeGuest(f).actors;f.herd.restore(original);guestOwners.set(f.herd,actors);}
 for(const actor of [...f.roster,...f.pending,...f.threats])actors.set(actor.entityId,actor);
 const body=f.roster[slot];if(body===undefined)throw new Error('Missing original native slot');
 const argument=args['argHandle']??0;
 const actor=argument===0?null:argument>=200?f.pending[argument-200]:argument>=100?f.threats[argument-100]:f.roster[argument-1];
 switch(signal){
  case 'drive':f.herd.drive(body,f.ctx,asBody);return;
  case 'tick':f.herd.tick(f.ctx);return;
  case 'initialize':f.herd.initialize();return;
  case 'stampede':f.herd.stampede(args['argX']??0,args['argZ']??0);return;
  case 'leadAway':f.herd.leadAway(args['argX']??0,args['argZ']??0);return;
  case 'disturb':f.herd.disturb(args['argX']??0,args['argZ']??0);return;
  case 'addTrust':f.herd.addTrust(args['argument']??0);return;
  case 'setRidden':if(actor===undefined)throw new Error('Missing original ride actor');f.herd.setRidden(actor);return;
  case 'adopt':if(actor===undefined||actor===null)throw new Error('Missing original adopted actor');f.herd.adoptStallion(actor);return;
  case 'release':f.herd.releaseStallion();return;
  default:throw new Error('Undeclared original native signal');
 }
}
// Keep the full matrix; each mode gets its own bounded parity case. The
// frozen TS oracle does not construct an unused WASM programme.
test.each(modes)('%s: cold native drives retain original per-member effects and continuation',mode=>{
 for(const state of states.filter(value=>!['charge','ridden'].includes(value)))for(const slot of [0,1,2,3]){
  const old=oracleFixture(mode,state),next=fixture(mode,state);
  try{
   const actor=old.roster[slot];if(actor===undefined)throw new Error('Missing original actor');old.herd.drive(actor,old.ctx);execute(next,slot);
   numbers(next.log,old.log);expect(next.random.snapshot()).toEqual(old.random.snapshot());expect(next.contextRandom.snapshot()).toEqual(old.contextRandom.snapshot());
   expect(next.herd.snapshot()).toBe(old.herd.snapshot());
   for(let i=0;i<old.roster.length;i++){const a=next.roster[i],b=old.roster[i];if(a===undefined||b===undefined)throw new Error('Missing body');numbers(a.mem,b.mem);numbers(a.lookTarget.toArray(),b.lookTarget.toArray());expect(a.state).toBe(b.state);}
  }finally{old.scope.dispose();next.scope.dispose();}
 }
});
test('a native steering effect can mutate the group before the same horse tail resumes',()=>{
 for(const state of ['watch','display','lead']){
  const old=oracleFixture('drift',state,true),next=fixture('drift',state,true);
  try{const actor=old.roster[2];if(actor===undefined)throw new Error('Missing original guard');old.herd.drive(actor,old.ctx);execute(next,2);numbers(next.log,old.log);expect(next.herd.snapshot()).toBe(old.herd.snapshot());}
  finally{old.scope.dispose();next.scope.dispose();}
 }
});

test('charge contact and stampede keep same-call hurt, knockdown, sound and state barriers',()=>{
 for(const charge of [true,false])for(const bodyTick of [true,false]){
  const old=oracleFixture(charge?'graze':'flee',charge?'charge':'lead'),next=fixture(charge?'graze':'flee',charge?'charge':'lead');
  try{
   for(const f of [old,next]){
    const actor=f.roster[2];if(actor===undefined)throw new Error('Missing guard');
    actor.speed=8;f.ctx.player.copy(actor.position).add(new Vector3(.2,0,.3));
    f.ports.onKnockdown=(x,z,power)=>{f.log.push(['knock',x,z,power]);};
    f.herd.onStallionState=(state:string)=>{f.log.push(['state',state]);};
    if(!charge)f.herd.stampeding=true;
   }
   const actor=old.roster[2];if(actor===undefined)throw new Error('Missing guard');old.herd.drive(actor,old.ctx,bodyTick);execute(next,2,bodyTick);
   numbers(next.log,old.log);expect(next.random.snapshot()).toEqual(old.random.snapshot());expect(next.contextRandom.snapshot()).toEqual(old.contextRandom.snapshot());expect(next.herd.snapshot()).toBe(old.herd.snapshot());
   numbers(next.roster[2]?.mem,actor.mem);
  }finally{old.scope.dispose();next.scope.dispose();}
 }
});

test('the full group tick preserves original sensing, alarms, modes and save order',()=>{
 for(const mode of modes)for(const state of states){
  const old=oracleFixture(mode,state),next=fixture(mode,state);
  try{
   old.herd.tick(old.ctx);execute(next,0,false,'tick');numbers(next.log,old.log);
   // G415: drive RNG now advances in the tick-wide plan; multi-seed movement is checked below.
   expect(next.ports.sharedRng()).toBe(next.random);expect(next.contextRandom.snapshot()).toEqual(old.contextRandom.snapshot());expect(next.herd.snapshot()).toBe(old.herd.snapshot());
   for(let i=0;i<old.roster.length;i++)numbers(next.roster[i]?.mem,old.roster[i]?.mem);
  }finally{old.scope.dispose();next.scope.dispose();}
 }
});

test('duplicate group instants and native between-slot group changes retain the one original clock',()=>{
 const old=oracleFixture('alert','watch'),next=fixture('alert','watch');
 try{
  for(const dt of [.1,.06,.04,.35,0,.1]){
   for(const f of [old,next]){f.ctx.dt=dt;f.ctx.t+=dt;}
   old.herd.tick(old.ctx);execute(next,0,false,'tick');
   expect(next.herd.snapshot()).toBe(old.herd.snapshot());// G415: drive RNG now advances in the tick-wide plan; multi-seed movement is checked below.
   expect(next.ports.sharedRng()).toBe(next.random);expect(next.contextRandom.snapshot()).toEqual(old.contextRandom.snapshot());
   const duplicateRandom=next.random.snapshot();old.herd.tick(old.ctx);execute(next,0,false,'tick');
   expect(next.herd.snapshot()).toBe(old.herd.snapshot());expect(next.random.snapshot()).toEqual(duplicateRandom);
   for(let i=0;i<old.roster.length;i++){const a=old.roster[i];if(a===undefined)throw new Error('Missing actor');old.herd.drive(a,old.ctx);execute(next,i);}
   numbers(next.log,old.log);expect(next.herd.snapshot()).toBe(old.herd.snapshot());
  }
 }finally{old.scope.dispose();next.scope.dispose();}
});
test('a real same-call taming callback can change stallion ownership before the outer tick continues',()=>{
 const old=oracleFixture('alert','display'),next=fixture('alert','display');
 try{
  for(const f of [old,next]){
   const guard=f.roster[2];if(guard===undefined)throw new Error('Missing guard');guard.hp=20;
   f.herd.onStallionState=(state:string)=>{f.log.push(['state',state]);if(state==='beaten')f.herd.releaseStallion();};
   f.herd.onBeaten=(actor:AnimalSim)=>{f.log.push(['beaten',actor.entityId]);};
   f.ports.onEvent=(event,x,z)=>{f.log.push(['event',event,x,z]);};
  }
  old.herd.tick(old.ctx);execute(next,0,false,'tick');numbers(next.log,old.log);
  expect(next.herd.snapshot()).toBe(old.herd.snapshot());expect(next.random.snapshot()).toEqual(old.random.snapshot());expect(next.contextRandom.snapshot()).toEqual(old.contextRandom.snapshot());
 }finally{old.scope.dispose();next.scope.dispose();}
});

test('terrain rejection consumes the original context RNG while shared awareness keeps its own stream',()=>{
 for(const capacity of [1,4,16])for(const attempt of [0,1,7,15,16]){
  const old=oracleFixture('graze','watch',false,capacity),next=fixture('graze','watch',false,capacity);
  try{
   for(const f of [old,next]){
    const snapshot=saved(f.herd);snapshot.state['spotT']=0;f.herd.restore(JSON.stringify(snapshot));
    let tests=0;f.ports.inBounds=(x,z,margin)=>x>=-250+margin&&x<=250-margin&&z>=-250+margin&&z<=250-margin;
    f.ports.normalY=(x,z)=>{f.log.push(['normal',x,z]);return ++tests>attempt?.85:.84;};
    // Nearby living horses exercise shared alarm draws before the context
    // stream chooses the new point. The scope has only one existing herd.
    for(const actor of f.roster)actor.mem['aw']=.1;
    if(capacity===1){const actor=f.roster[0];if(actor!==undefined)f.ctx.player.set(actor.position.x+200,0,actor.position.z+200);}
   }
   old.herd.tick(old.ctx);execute(next,0,false,'tick');numbers(next.log,old.log);
   expect(next.random.snapshot()).toEqual(old.random.snapshot());expect(next.contextRandom.snapshot()).toEqual(old.contextRandom.snapshot());
   numbers(JSON.parse(next.herd.snapshot()),JSON.parse(old.herd.snapshot()));
   const bytes=next.herd.snapshot();next.herd.restore(bytes);expect(next.herd.snapshot()).toBe(bytes);
  }finally{old.scope.dispose();next.scope.dispose();}
 }
});
test('public taming mutations keep the original actor, trust, state and same-call event order',()=>{
 const commands=['addTrust','setRidden','release','stampede','leadAway','adopt','disturb'] as const;
 for(const command of commands)for(const value of [-80,0,70,140]){
  const old=oracleFixture('alert','display'),next=fixture('alert','display');
  try{
   for(const f of [old,next]){f.herd.onStallionState=(state:string)=>{f.log.push(['state',state,f.herd.stallion?.entityId??'none']);};f.herd.onFlight=(stampede:boolean)=>{f.log.push(['flight',Number(stampede)]);};f.ports.onEvent=(name,x,z)=>{f.log.push(['event',name,x,z]);};}
   const actor=old.roster[0];if(actor===undefined)throw new Error('Missing adoption actor');
   if(command==='addTrust'){old.herd.addTrust(value);execute(next,0,false,command,{argument:value});}
   else if(command==='setRidden'){old.herd.setRidden(value===0?null:actor);execute(next,0,false,command,{argHandle:value===0?0:1});}
   else if(command==='release'){old.herd.releaseStallion();execute(next,0,false,command);}
   else if(command==='adopt'){old.herd.adoptStallion(actor);execute(next,0,false,command,{argHandle:1});}
   else{old.herd[command](value,value+10);execute(next,0,false,command,{argX:value,argZ:value+10});}
   numbers(next.log,old.log);expect(next.herd.snapshot()).toBe(old.herd.snapshot());expect(next.random.snapshot()).toEqual(old.random.snapshot());expect(next.contextRandom.snapshot()).toEqual(old.contextRandom.snapshot());
   for(let i=0;i<old.roster.length;i++)numbers(next.roster[i]?.mem,old.roster[i]?.mem);
  }finally{old.scope.dispose();next.scope.dispose();}
 }
});
test('the original initialization timer consumes only its original shared stream once',()=>{
 const old=oracleFixture('graze','watch'),next=fixture('graze','watch');
 try{
  for(const f of [old,next]){const snapshot=saved(f.herd);snapshot.state['initialized']=false;f.herd.restore(JSON.stringify(snapshot));}
  old.herd.initialize();execute(next,0,false,'initialize');expect(next.herd.snapshot()).toBe(old.herd.snapshot());expect(next.random.snapshot()).toEqual(old.random.snapshot());expect(next.contextRandom.snapshot()).toEqual(old.contextRandom.snapshot());
 }finally{old.scope.dispose();next.scope.dispose();}
});
test('cross-group nearest threats and charge contact retain actual original actor identities',()=>{
 for(const kicks of [0,1])for(const replacement of [false,true]){
  const old=oracleFixture('graze','charge'),next=fixture('graze','charge');
  try{
   for(const f of [old,next]){
    const guard=f.roster[2];if(guard===undefined)throw new Error('Missing guard');guard.mem['kicks']=kicks;
    const wolf=makeBody('wolf','wolf',guard.position.x+.1,guard.position.z+.2);f.threats.push(wolf);
    const damage=wolf.applyDamage.bind(wolf),stagger=wolf.stagger.bind(wolf);
    wolf.applyDamage=(amount,point,dir)=>{f.log.push(['damage',wolf.entityId,amount,...point,...dir]);return damage(amount,point,dir);};
    wolf.stagger=(dir,strength)=>{f.log.push(['stagger',wolf.entityId,...dir,strength??0]);stagger(dir,strength??0);};
    f.ports.scarePack=(actor,radius)=>{f.log.push(['scare',actor.entityId,radius]);return true;};
    f.ports.onEvent=(name,x,z)=>{f.log.push(['event',name,x,z]);};f.herd.onStallionState=(state:string)=>{f.log.push(['state',state]);};
    const snapshot=saved(f.herd);snapshot.chargeTarget=wolf.entityId;f.herd.restore(JSON.stringify(snapshot));
    if(replacement){const steer=f.ctx.steer;f.ctx.steer=(actor,yaw,speed,turn)=>{steer(actor,yaw,speed,turn);const changed=saved(f.herd);changed.chargeTarget=null;f.herd.restore(JSON.stringify(changed));wolf.position.x+=.15;};}
   }
   const guard=old.roster[2];if(guard===undefined)throw new Error('Missing guard');old.herd.drive(guard,old.ctx,true);execute(next,2,true);
   numbers(next.log,old.log);expect(next.herd.snapshot()).toBe(old.herd.snapshot());expect(next.random.snapshot()).toEqual(old.random.snapshot());expect(next.contextRandom.snapshot()).toEqual(old.contextRandom.snapshot());numbers(next.roster[2]?.mem,guard.mem);expect(next.threats[0]?.hp).toBe(old.threats[0]?.hp);
  }finally{old.scope.dispose();next.scope.dispose();}
 }
});
test('the real nearest binder preserves ordered ties, live threats and post-flight target mutation',()=>{
 for(const firstDead of [false,true])for(const mutate of [false,true]){
  const old=oracleFixture('graze','watch'),next=fixture('graze','watch');
  try{
   for(const f of [old,next]){
    const a=makeBody('wolf-a','wolf',2,3),b=makeBody('wolf-b','wolf',4,3);a.alive=!firstDead;f.threats.push(a,b);
    f.herd.onStallionState=(state:string)=>{f.log.push(['state',state]);};
    f.herd.onFlight=(stampede:boolean)=>{f.log.push(['flight',Number(stampede)]);if(mutate){a.position.set(14,1,15);b.position.set(16,1,15);}};
    f.ports.onEvent=(name,x,z)=>{f.log.push(['event',name,x,z]);};
   }
   old.herd.tick(old.ctx);execute(next,0,false,'tick');numbers(next.log,old.log);expect(next.herd.snapshot()).toBe(old.herd.snapshot());expect(next.random.snapshot()).toEqual(old.random.snapshot());expect(next.contextRandom.snapshot()).toEqual(old.contextRandom.snapshot());
  }finally{old.scope.dispose();next.scope.dispose();}
 }
});
test('a real native sense keeps later member and player captures fresh',()=>{
 const old=oracleFixture('graze','watch'),next=fixture('graze','watch');
 try{
  for(const f of [old,next]){let reads=0;f.ports.visibility=(x,z,player,speed,time)=>{f.log.push(['visibility',x,z,player.x,player.z,speed,time]);if(++reads===1){const later=f.roster[1];if(later!==undefined){later.position.x+=20;later.mem['aw']=.7;}f.ctx.player.x+=3;}return .8;};f.ports.hearing=(radii,player,speed)=>{f.log.push(['hearing',...radii,player.x,player.z,speed]);return 12;};}
  old.herd.tick(old.ctx);execute(next,0,false,'tick');numbers(next.log,old.log);expect(next.herd.snapshot()).toBe(old.herd.snapshot());// G415: drive RNG now advances in the tick-wide plan; multi-seed movement is checked below.
   expect(next.ports.sharedRng()).toBe(next.random);expect(next.contextRandom.snapshot()).toEqual(old.contextRandom.snapshot());
  for(let i=0;i<old.roster.length;i++)numbers(next.roster[i]?.mem,old.roster[i]?.mem);
 }finally{old.scope.dispose();next.scope.dispose();}
});
test('nested public taming calls reuse the same executable and return before the outer native slot resumes',()=>{
 const old=oracleFixture('alert','display'),next=fixture('alert','display');
 try{
  for(const f of [old,next]){
   const guard=f.roster[2];if(guard===undefined)throw new Error('Missing guard');guard.hp=20;
   f.herd.onStallionState=(state:string)=>{f.log.push(['state',state]);if(state==='beaten'){
    if(f===old){f.herd.addTrust(17);f.herd.setRidden(guard);}else{execute(next,0,false,'addTrust',{argument:17});execute(next,0,false,'setRidden',{argHandle:3});}
   }};
   f.herd.onBeaten=(actor:AnimalSim)=>{f.log.push(['beaten',actor.entityId]);};f.ports.onEvent=(name,x,z)=>{f.log.push(['event',name,x,z]);};
  }
  old.herd.tick(old.ctx);execute(next,0,false,'tick');numbers(next.log,old.log);expect(next.herd.snapshot()).toBe(old.herd.snapshot());expect(next.random.snapshot()).toEqual(old.random.snapshot());expect(next.contextRandom.snapshot()).toEqual(old.contextRandom.snapshot());
 }finally{old.scope.dispose();next.scope.dispose();}
});
test('one native call reuses member capture rows while resampling every barrier',()=>{
 const f=fixture('graze','watch',false,16);
 try{
  execute(f,0,false,'addTrust',{argument:0});
  const arrays=new Set<readonly V2ColumnOwners[]>(),rows=new Set<V2ColumnOwners>();
  const selves=new Set(),players=new Set(),observed=new Set(),references=new Set(),results=new Set();const playerX=new Set<number>();let captures=0,changed=false;
  f.ports.visibility=()=>{if(!changed){changed=true;f.ctx.player.set(43,1,27);}return .8;};
  f.herd.observeCapture=frame=>{
   captures++;arrays.add(frame.input.members);playerX.add(f.ctx.player.x);
   expect(frame.native.members).toBe(frame.input.members);
   frame.input.members.forEach((row,slot)=>{
    rows.add(row);selves.add(row.self);players.add(row.player);observed.add(row.observed);references.add(row.references);results.add(row.results);
    expect(row.self.actor).toBe(f.roster[slot]);expect(row.self.identity).toBe(f.roster[slot]?.entityId);
    expect(row.player.position).toBe(f.ctx.player);expect(row.t).toBe(f.ctx.t);expect(row.dt).toBe(f.ctx.dt);
    expect(row.references?.get('self')?.body).toBe(f.roster[slot]);
    expect(row.results?.['reply']).toBeTypeOf('number');
   });
  };
  execute(f,0,false,'tick');expect(changed).toBe(true);expect(captures).toBeGreaterThan(2);expect([...playerX]).toEqual([12,43]);
  expect(arrays.size).toBe(1);for(const bank of [rows,selves,players,observed,references,results])expect(bank.size).toBe(16);
  const first=[...arrays][0];arrays.clear();f.ctx.t+=1;execute(f,0,false,'tick');
  expect(arrays.size).toBe(1);expect([...arrays][0]).not.toBe(first);
 }finally{f.scope.dispose();}
});
test('numeric parameter scratch refreshes at barriers and remains private through getter reentry',()=>{
 const f=fixture('graze','watch',false,16);
 try{
  execute(f,0,false,'addTrust',{argument:0});
  const author=ReturnProgram.page(pasture,f.scope),bindings=author.groupBindings;
  const shape=binding.profile==='main'?bindings:bindings?.profiles?.find(row=>row.id===binding.profile);
  if(shape===undefined)throw new Error('Missing herd parameter shape');
  const codec=new GroupBankV2(shape.bank),observed:number[][]=[];let nested=false,changed=false;
  Object.defineProperty(f.ctx,'calm',{get:()=>{if(!nested){nested=true;f.herd.addTrust(7);}return false;}});
  f.ports.visibility=()=>{if(!changed){changed=true;f.ctx.player.set(43,1,27);}return .8;};
  f.herd.observeCapture=frame=>{
   const values=codec.decode(frame.input.state,frame.input.group,frame.input.references);
   expect(values['context.minX']).toBe(-250);expect(values['context.maxZ']).toBe(250);
   expect(values['context.walk']).toBe(2);expect(values['context.flightMax']).toBe(120);
   if(frame.input.signal==='tick'){
    expect(values['context.dt']).toBe(f.ctx.dt);expect(values['context.time']).toBe(f.ctx.t);
    expect(values['context.px']).toBe(f.ctx.player.x);expect(values['context.py']).toBe(f.ctx.player.y);
    expect(values['context.pz']).toBe(f.ctx.player.z);expect(values['context.playerSpeed']).toBe(f.ctx.playerSpeed);
    expect(values['context.calm']).toBe(0);
    observed.push([Number(values['context.px']),Number(values['context.playerSpeed'])]);
   }else if(frame.input.signal==='addTrust'){
    expect(values['context.dt']).toBe(0);expect(values['context.time']).toBe(0);
   }
  };
  execute(f,0,false,'tick');expect(nested).toBe(true);expect(changed).toBe(true);
  expect(observed.length).toBeGreaterThan(2);expect(observed[0]).toEqual([12,.4]);
  expect(observed.at(-1)).toEqual([43,.4]);
 }finally{f.scope.dispose();}
});
test('nested taming capture scratch is separate and the outer call resumes its own rows',()=>{
 const f=fixture('alert','display');
 try{
  execute(f,0,false,'addTrust',{argument:0});
  const guard=f.roster[2];if(guard===undefined)throw new Error('Missing guard');guard.hp=20;
  const bySignal=new Map<string,Set<readonly V2ColumnOwners[]>>();let nested=false,resumed=false;
  f.herd.observeCapture=frame=>{
   let arrays=bySignal.get(frame.input.signal);if(arrays===undefined){arrays=new Set();bySignal.set(frame.input.signal,arrays);}arrays.add(frame.input.members);
   if(nested&&frame.input.signal==='tick')resumed=true;
  };
  f.herd.onStallionState=state=>{if(state==='beaten'){
   f.herd.addTrust(17);f.herd.setRidden(guard);nested=true;
  }};
  execute(f,0,false,'tick');expect(nested).toBe(true);expect(resumed).toBe(true);
  expect([...bySignal.keys()]).toEqual(['tick','addTrust','setRidden']);
  const calls=[...bySignal.values()];for(const arrays of calls)expect(arrays.size).toBe(1);
  const arrays:(readonly V2ColumnOwners[])[]=[];for(const call of calls)for(const rows of call)arrays.push(rows);expect(new Set(arrays).size).toBe(3);
  expect(new Set(arrays.map(array=>array[0]?.references)).size).toBe(3);
  expect(new Set(arrays.map(array=>array[0]?.self)).size).toBe(3);
  expect(new Set(arrays.map(array=>array[0]?.results)).size).toBe(3);
 }finally{f.scope.dispose();}
});
test('sixteen newly hurt members keep original alarm and flight order within the bounded same-slot transaction',()=>{
 const old=oracleFixture('graze','watch',false,16),next=fixture('graze','watch',false,16);
 try{
  for(const f of [old,next]){
   for(const actor of f.roster){actor.lastHitT=1;delete actor.mem['hitT'];}
   f.herd.onStallionState=(state:string)=>{f.log.push(['state',state]);};f.herd.onFlight=(stampede:boolean)=>{f.log.push(['flight',Number(stampede)]);};f.ports.onEvent=(name,x,z)=>{f.log.push(['event',name,x,z]);};
  }
  old.herd.tick(old.ctx);execute(next,0,false,'tick');numbers(next.log,old.log);expect(next.herd.snapshot()).toBe(old.herd.snapshot());expect(next.random.snapshot()).toEqual(old.random.snapshot());expect(next.contextRandom.snapshot()).toEqual(old.contextRandom.snapshot());
  for(let i=0;i<old.roster.length;i++)numbers(next.roster[i]?.mem,old.roster[i]?.mem);
 }finally{old.scope.dispose();next.scope.dispose();}
});
test('adopting a newly registered elite appends that exact actor before its original state callback',()=>{
 const old=oracleFixture('alert','display'),next=fixture('alert','display');
 try{
  for(const f of [old,next]){
   const elite=makeBody('new-elite','elite',3,4);f.pending.push(elite);
   f.herd.onStallionState=(state:string)=>{f.log.push(['state',state,f.herd.stallion?.entityId??'none',...f.herd.members.map(actor=>actor.entityId)]);};
  }
  const elite=old.pending[0];if(elite===undefined)throw new Error('Missing admitted elite');old.herd.adoptStallion(elite);execute(next,0,false,'adopt',{argHandle:200});
  numbers(next.log,old.log);expect(next.herd.snapshot()).toBe(old.herd.snapshot());expect(next.herd.stallion).toBe(next.pending[0]);expect(next.herd.members.at(-1)).toBe(next.pending[0]);expect(next.random.snapshot()).toEqual(old.random.snapshot());expect(next.contextRandom.snapshot()).toEqual(old.contextRandom.snapshot());
 }finally{old.scope.dispose();next.scope.dispose();}
});
test('an explicitly saved native negative-infinity hit stamp keeps its original semantics and wire',()=>{
 const old=oracleFixture('graze','watch'),next=fixture('graze','watch');
 try{
  for(const f of [old,next])for(const actor of f.roster){actor.mem['hitT']=-Infinity;actor.lastHitT=0;}
  old.herd.tick(old.ctx);execute(next,0,false,'tick');numbers(next.log,old.log);expect(next.herd.snapshot()).toBe(old.herd.snapshot());expect(next.random.snapshot()).toEqual(old.random.snapshot());expect(next.contextRandom.snapshot()).toEqual(old.contextRandom.snapshot());for(let i=0;i<old.roster.length;i++)numbers(next.roster[i]?.mem,old.roster[i]?.mem);
 }finally{old.scope.dispose();next.scope.dispose();}
});

test('environment reads keep their original gates and reentrant group ordering',()=>{
 for(const scenario of ['body-gate','pass-through','standing','sensing','trample']){
  const old=oracleFixture(scenario==='trample'?'flee':'graze',scenario==='trample'?'lead':'warn'),next=fixture(scenario==='trample'?'flee':'graze',scenario==='trample'?'lead':'warn');
  for(const f of [old,next]){
   if(scenario==='trample'){
    f.herd.stampeding=true;f.roster[0]?.position.copy(f.ctx.player);f.roster[0]?.setMotion(.3,9,2);
   }
   let calls=0;
   f.ports.environment=()=>{
    f.log.push(['environment',++calls]);
    if(scenario==='pass-through'){f.herd.mode='flee';f.herd.stampeding=true;}
    if(scenario==='standing'){f.herd.stallion?.position.set(180,0,180);}
    if(scenario==='sensing'&&calls===1){const actor=f.roster[1];if(actor!==undefined)actor.position.x+=3;}
    return{playerMounted:false,playerCrouched:false};
   };
  }
  try{
   if(scenario==='standing'||scenario==='sensing'){
    old.herd.tick(old.ctx);execute(next,0,false,'tick');
   }else{
    const body=scenario==='body-gate';const a=old.roster[0];if(a===undefined)throw new Error('Missing original member');
    old.herd.drive(a,old.ctx,body);execute(next,0,body);
   }
   numbers(next.log,old.log);numbers(JSON.parse(next.herd.snapshot()),JSON.parse(old.herd.snapshot()));
   // G415: drive RNG now advances in the tick-wide plan; multi-seed movement is checked below.
   expect(next.ports.sharedRng()).toBe(next.random);expect(next.contextRandom.snapshot()).toEqual(old.contextRandom.snapshot());
   if(scenario==='body-gate')expect(next.log).toEqual([]);
  }finally{old.scope.dispose();next.scope.dispose();}
 }
});

test('scalar publication validates roles and all original storage before any commit',()=>{
 for(const change of ['role','scalar','accessor','retired','roster']){
  const f=fixture('graze','warn');try{
   const refs=f.roster.map((body,slot)=>({group:'herd',slot,identity:body.entityId,wire:body.entityId,handle:slot+1,body}));
   const values={...f.herd.captureValues(),trust:41};
   if(change==='role'){
    expect(()=>f.herd.prepareValues({...values,lead:'foreign'},refs,f.scope)).toThrow('Foreign herd guest role');expect(f.herd.trust).not.toBe(41);continue;
   }
   const publication=f.herd.prepareValues(values,refs,f.scope),before=f.herd.trust;
   if(change==='scalar')f.herd.alert+=1;
   if(change==='accessor')Object.defineProperty(f.herd,'trust',{get:()=>{throw new Error('getter was invoked');},configurable:true});
   if(change==='retired')f.scope.dispose();
   if(change==='roster')f.roster.reverse();
   expect(()=>publication.commit()).toThrow(/Changed|Retired/);
   if(change==='accessor')Object.defineProperty(f.herd,'trust',{value:before,writable:true,configurable:true});
   expect(f.herd.trust).toBe(before);
  }finally{f.scope.dispose();}
 }
});

function bindNativeGuest(f:ReturnType<typeof fixture>){
 const actors=new Map([...f.roster,...f.pending,...f.threats].map(actor=>[actor.entityId,actor]));
 const snapshot=saved(f.herd);snapshot.state['initialized']=false;f.herd.restore(JSON.stringify(snapshot));
 lendNalatiPasture(f.scope);
 const selected=ReturnProgram.page(pasture,f.scope);if(selected.prepareGroup===undefined||selected.groupBindings===undefined)throw new Error('Missing selected herd');
 const program={groupBindings:selected.groupBindings,prepareGroup:selected.prepareGroup};
 f.herd.bindGuest(program,binding,
  {scope:f.scope,group:'herd',handle:50,player:f.ctx.player,actors});
 return {program,actors};
}
test('the actual native owner initializes and handles pure public mutations through the shared loop without a local RNG loan',()=>{
 const old=oracleFixture('graze','warn'),next=fixture('graze','warn');try{
  const oldState=saved(old.herd);oldState.state['initialized']=false;old.herd.restore(JSON.stringify(oldState));
  bindNativeGuest(next);const context=next.contextRandom.snapshot();
  old.herd.initialize();next.herd.initialize();
  for(const amount of [11,-200,50,101]){old.herd.addTrust(amount);next.herd.addTrust(amount);expect(next.herd.snapshot()).toBe(old.herd.snapshot());}
  const a=old.roster[0],b=next.roster[0];if(a===undefined||b===undefined)throw new Error('Missing original member');
  old.herd.setRidden(a);next.herd.setRidden(b);expect(next.herd.snapshot()).toBe(old.herd.snapshot());expect(b.mem).toEqual(a.mem);
  old.herd.releaseStallion();next.herd.releaseStallion();expect(next.herd.snapshot()).toBe(old.herd.snapshot());
  expect(next.random.snapshot()).toEqual(old.random.snapshot());expect(next.contextRandom.snapshot()).toEqual(context);
 }finally{old.scope.dispose();next.scope.dispose();}
});
test('the bound owner keeps its native cold-start steering reentry before the first plan',()=>{
 for(const mutate of [false,true]){
  const old=oracleFixture('graze','warn',mutate),next=fixture('graze','warn',mutate);try{
   const oldState=saved(old.herd);oldState.state['initialized']=false;old.herd.restore(JSON.stringify(oldState));
   bindNativeGuest(next);old.herd.initialize();next.herd.initialize();
   for(const index of [0,1,3]){
    const a=old.roster[index],b=next.roster[index];if(a===undefined||b===undefined)throw new Error('Missing original member');
    old.herd.drive(a,old.ctx);next.herd.drive(b,next.ctx);numbers(next.log,old.log);numbers(a.mem,b.mem);expect(next.herd.snapshot()).toBe(old.herd.snapshot());
   }
   expect(next.random.snapshot()).toEqual(old.random.snapshot());expect(next.contextRandom.snapshot()).toEqual(old.contextRandom.snapshot());
  }finally{old.scope.dispose();next.scope.dispose();}
 }
});

test('the selected pasture replaces its active witness and keeps exactly eight sim executables',()=>{
 const admissions=scriptAdmissionRows(NALATI_SCRIPT_SECTIONS),sim=admissions.filter(row=>row.side==='sim');
 expect(new Set(sim.map(row=>row.module)).size).toBe(8);
 expect(sim.filter(row=>row.module===pasture.script.module)).toEqual([]);
 expect(sim.filter(row=>row.module===`blobs/wasm/${pasture.v2.artifact.hash}.wasm`)).toHaveLength(1);
 expect(sim.find(row=>row.id==='nalati.pasture.projection')?.abi).toBe(2);
});


test('a full native herd keeps original cold-start drives before its first tick plan',()=>{
 for(const mode of modes)for(const state of ['watch','lead','ridden']){
  const old=oracleFixture(mode,state,false,16),next=fixture(mode,state,false,16);
  try{
   const riddenOld=old.roster[15],riddenNext=next.roster[15];if(riddenOld===undefined||riddenNext===undefined)throw new Error('Missing late ridden member');
   old.herd.setRidden(riddenOld);next.herd.setRidden(riddenNext);
   for(let slot=0;slot<16;slot++){
    const actor=old.roster[slot];if(actor===undefined)throw new Error('Missing full herd member');
    old.herd.drive(actor,old.ctx);execute(next,slot);
    numbers(next.log,old.log);expect(next.herd.snapshot()).toBe(old.herd.snapshot());
    expect(next.random.snapshot()).toEqual(old.random.snapshot());expect(next.contextRandom.snapshot()).toEqual(old.contextRandom.snapshot());
   }
  }finally{old.scope.dispose();next.scope.dispose();}
 }
});

test('original body and duplicate tick gates skip before capture; steady drives reuse the numeric bank',()=>{
 const f=fixture('graze','warn',false,16);
 bindNativeGuest(f);f.herd.initialize();
 const actor=f.roster[0];if(actor===undefined)throw new Error('Missing member');
 const prepare=vi.spyOn(GroupStepV2.prototype,'prepare'),encode=vi.spyOn(GroupBankV2.prototype,'encode'),generic=vi.spyOn(ObservationColumnsV2.prototype,'capture');
 try{
  const before=f.herd.captures;
  for(let frame=0;frame<120;frame++)for(const member of f.roster)f.herd.drive(member,f.ctx,true);
  expect(f.herd.captures).toBe(before);expect(prepare).not.toHaveBeenCalled();expect(encode).not.toHaveBeenCalled();
  f.herd.tick(f.ctx);const captures=f.herd.captures,calls=prepare.mock.calls.length;
  for(let repeat=0;repeat<f.roster.length;repeat++)f.herd.tick(f.ctx);
  expect(f.herd.captures).toBe(captures);expect(prepare).toHaveBeenCalledTimes(calls);
  for(let step=0;step<3;step++)f.herd.drive(actor,f.ctx);
  expect(prepare).toHaveBeenCalledTimes(calls);
  expect(encode).not.toHaveBeenCalled();expect(generic).not.toHaveBeenCalled();
 }finally{prepare.mockRestore();encode.mockRestore();generic.mockRestore();f.scope.dispose();}
});

test('a planned member drive does not recapture unrelated neighbour memory',()=>{
 const f=fixture('graze','warn',false,16);bindNativeGuest(f);f.herd.initialize();f.herd.tick(f.ctx);
 const first=f.roster[0],last=f.roster[15];if(first===undefined||last===undefined)throw new Error('Missing member');
 let reads=0;const prior=last.mem['gt'];Object.defineProperty(last.mem,'gt',{configurable:true,get:()=>{reads++;return prior;}});
 try{f.herd.drive(first,f.ctx);expect(reads).toBe(0);}
 finally{Object.defineProperty(last.mem,'gt',{configurable:true,writable:true,value:prior});f.scope.dispose();}
});

test('one tick plan serves every member drive without another guest capture or call',()=>{
 const f=fixture('graze','watch',false,16);bindNativeGuest(f);f.herd.initialize();
 const prepare=vi.spyOn(GroupStepV2.prototype,'prepare');
 try{
  f.herd.tick(f.ctx);const calls=prepare.mock.calls.length,captures=f.herd.captures;
  for(const actor of f.roster){f.herd.drive(actor,f.ctx);actor.step(f.ctx.dt);}
  expect(prepare).toHaveBeenCalledTimes(calls);expect(f.herd.captures).toBe(captures);
  expect(f.roster.every(actor=>[actor.position.x,actor.position.y,actor.position.z,actor.desiredSpeed,actor.yaw].every(Number.isFinite))).toBe(true);
  expect(f.roster.some(actor=>actor.desiredSpeed>0)).toBe(true);
  const wire=f.herd.snapshot();f.herd.restore(wire);expect(f.herd.snapshot()).toBe(wire);
 }finally{prepare.mockRestore();f.scope.dispose();}
});

test.each(modes)('%s: tick-wide plans keep herd movement within the original behavioural range across twelve seeds',mode=>{
 // G415 explicitly permits a different drive RNG order and tick-wide movement
 // observations. Compare aggregate movement rather than a particular random
 // draw sequence. Save bytes and same-call contact/taming remain separate exact
 // regressions below; a finite pose and bounded per-step motion are mandatory.
 const distance=[0,0],speed=[0,0],spread=[0,0];
 for(let seed=1;seed<=12;seed++){
  const old=oracleFixture(mode,'watch',false,4,seed),next=fixture(mode,'watch',false,4,seed);
  try{
   for(const f of [old,next])f.ctx.player.set(180,0,180);
   const initial=next.herd.snapshot();bindNativeGuest(next);next.herd.restore(initial);
   for(let step=0;step<8;step++){
    for(const[index,f]of [old,next].entries()){
     f.ctx.t+=.1;f.herd.tick(f.ctx);
     for(const actor of f.roster){
      const prior=actor.position.clone();f.herd.drive(actor,f.ctx);actor.step(.1);
      const moved=actor.position.distanceTo(prior);
      expect([actor.position.x,actor.position.y,actor.position.z,actor.yaw,actor.desiredSpeed].every(Number.isFinite)).toBe(true);
      expect(moved).toBeLessThanOrEqual(spec.chargeSpeed*.1+1e-9);
      distance[index]=(distance[index]??0)+moved;speed[index]=(speed[index]??0)+actor.desiredSpeed;
     }
     for(const actor of f.roster)spread[index]=(spread[index]??0)+actor.position.distanceTo(f.roster[0]?.position??actor.position);
    }
   }
   const wire=old.herd.snapshot();next.herd.restore(wire);expect(next.herd.snapshot()).toBe(wire);
  }finally{old.scope.dispose();next.scope.dispose();}
 }
 for(const measurement of [distance,speed,spread]){
  const original=measurement[0]??0,planned=measurement[1]??0;
  expect(Math.abs(planned-original)).toBeLessThanOrEqual(Math.max(1,original)*.2);
 }
},30_000);

test('a tick plan keeps the native body-rate contact and same-call taming ownership barrier',()=>{
 const old=oracleFixture('graze','charge'),next=fixture('graze','charge');
 try{
  for(const f of [old,next]){const actor=f.roster[2];if(actor===undefined)throw new Error('Missing guard');f.ctx.player.copy(actor.position).add(new Vector3(.2,0,.3));actor.speed=8;}
  const initial=next.herd.snapshot();bindNativeGuest(next);next.herd.restore(initial);old.herd.tick(old.ctx);next.herd.tick(next.ctx);
  old.log.length=0;next.log.length=0;
  const a=old.roster[2],b=next.roster[2];if(a===undefined||b===undefined)throw new Error('Missing native guard');
  old.herd.drive(a,old.ctx,true);next.herd.drive(b,next.ctx,true);numbers(next.log,old.log);
  expect(next.herd.stallionState).toBe(old.herd.stallionState);
  next.herd.setRidden(b);const calls=next.herd.captures;next.log.length=0;
  next.herd.drive(b,next.ctx,true);next.herd.drive(b,next.ctx,false);
  expect(next.log).toEqual([]);expect(next.herd.captures).toBe(calls);expect(b.mem['ridden']).toBe(1);
 }finally{old.scope.dispose();next.scope.dispose();}
});

test('locomotion parts preflight the complete member suffix before a plan publishes',()=>{
 const f=fixture('graze','watch');
 try{
  const initial=f.herd.snapshot();bindNativeGuest(f);f.herd.restore(initial);
  const members:V2ColumnOwners[]=f.roster.map((actor,slot)=>({scope:f.scope,self:{group:'herd',slot,identity:actor.entityId,actor},player:{position:f.ctx.player},observed:new Map(),t:2,dt:.1}));
  const actor=f.roster[0],member=members[0]?.self;if(actor===undefined||member===undefined)throw new Error('Missing original member');
  const values=Array.from({length:24},()=>0);values[0]=1;values[1]=2;values[14]=-1;values[23]=-1;
  const operations:GroupStepOperationV2[]=Array.from({length:8},(_,part)=>({id:200+part,values:[0,...values.slice(part*3,part*3+3)],member,native:{kind:'locomotion-plan',part}}));
  const owners={scope:f.scope,members,group:{kind:'herd' as const,owner:f.herd}};
  for(const changed of [operations.slice(0,7),[...operations,operations[0]].filter(value=>value!==undefined),operations.map((op,index)=>index===7?{...op,values:[0,0,0,Number.NaN]}:op)]){
   expect(()=>prepareGroupNativeV2(changed,owners)).toThrow();expect(f.log).toEqual([]);
  }
  f.herd.drive(actor,f.ctx);expect(actor.state).toBe('graze');
  const ready=prepareGroupNativeV2(operations,owners);ready.run();f.herd.drive(actor,f.ctx);expect(actor.state).toBe('alert');
  const retired=prepareGroupNativeV2(operations,owners);f.scope.dispose();expect(()=>retired.run()).toThrow(/Retired|disposed/);
 }finally{f.scope.dispose();}
});

test.each(modes)('%s: a full roster plans within the admitted invocation budget',mode=>{
 for(const state of states){
  const f=fixture(mode,state,false,16);const original=f.herd.snapshot();bindNativeGuest(f);f.herd.restore(original);
  try{f.herd.tick(f.ctx);for(const actor of f.roster)f.herd.drive(actor,f.ctx);expect(f.roster.every(actor=>Number.isFinite(actor.desiredSpeed))).toBe(true);}
  finally{f.scope.dispose();}
 }
},30_000);

test.each(modes)('%s: a dense moving roster plans within the admitted invocation budget',mode=>{
 for(const state of states){
  const f=fixture(mode,state,false,16);f.roster.forEach((actor,index)=>{actor.position.set(index*.1,0,index*.1);actor.speed=5;});
  const original=f.herd.snapshot();bindNativeGuest(f);f.herd.restore(original);
  try{f.herd.tick(f.ctx);for(const actor of f.roster)f.herd.drive(actor,f.ctx);expect(f.roster.every(actor=>Number.isFinite(actor.desiredSpeed))).toBe(true);}
  finally{f.scope.dispose();}
 }
},30_000);

test('a final warning guard keeps boolean scratch valid after its timed sound plan',()=>{
 const f=fixture('graze','warn',false,16),guard=f.roster.splice(2,1)[0];if(guard===undefined)throw new Error('Missing guard');f.roster.push(guard);
 f.ctx.calm=true;f.ctx.player.copy(guard.position).add(new Vector3(25,0,0));guard.mem['snT']=0;
 const original=f.herd.snapshot();bindNativeGuest(f);f.herd.restore(original);
 try{f.herd.tick(f.ctx);expect(f.herd.stallionState).toBe('warn');f.herd.drive(guard,f.ctx);expect(guard.mem['snT']).toBeGreaterThan(1);expect(f.log.some(row=>row[0]==='sound'&&row[1]==='snort')).toBe(true);}
 finally{f.scope.dispose();}
});


test('publication fences every saved scalar, role and clock through its original storage',()=>{
 const baseline=fixture('graze','warn');let names:string[];
 try{names=[...Object.keys(saved(baseline.herd).state),'lead','stallion','ridden','chargeTarget','groupTime'];}
 finally{baseline.scope.dispose();}
 for(const name of names){
  const f=fixture('graze','warn');
  try{
   const refs=f.roster.map((body,slot)=>({group:'herd',slot,identity:body.entityId,wire:body.entityId,handle:slot+1,body}));
   const publication=f.herd.prepareValues({...f.herd.captureValues(),trust:41},refs,f.scope);
   const descriptor=Object.getOwnPropertyDescriptor(f.herd,name);
   if(descriptor===undefined||!Object.hasOwn(descriptor,'value'))throw new Error('Missing original storage');
   const value:unknown=descriptor.value;
   const replacement=typeof value==='number'?(Object.is(value,0)?-0:0):typeof value==='boolean'?!value:typeof value==='string'?`${value}.changed`:value===null?undefined:null;
   Object.defineProperty(f.herd,name,{...descriptor,value:replacement});
   try{expect(()=>publication.commit(),name).toThrow('Changed herd guest storage');}
   finally{Object.defineProperty(f.herd,name,descriptor);}
  }finally{f.scope.dispose();}
 }
});

test('publication validation reuses field pins without rebuilding scalar snapshots',()=>{
 const f=fixture('graze','warn');
 try{
  const refs=f.roster.map((body,slot)=>({group:'herd',slot,identity:body.entityId,wire:body.entityId,handle:slot+1,body}));
  const values={...f.herd.captureValues(),trust:41},reads=f.herd.scalarReads,random=f.random.snapshot();
  const publication=f.herd.prepareValues(values,refs,f.scope);
  publication.validate();publication.validate();publication.commit();
  expect(f.herd.scalarReads).toBe(reads+1);expect(f.herd.trust).toBe(41);expect(f.random.snapshot()).toEqual(random);
 }finally{f.scope.dispose();}
});


test('a sense cannot change the player scalar pinned by its pending native operations',()=>{
 const f=fixture('graze','watch');
 try{
  let hearing=0;
  f.ports.visibility=()=>{f.ctx.playerSpeed=.8;return .8;};
  f.ports.hearing=()=>{hearing++;return 12;};
  expect(()=>execute(f,0,false,'tick')).toThrow('Retired or replaced native group result owner');
  expect(hearing).toBe(0);
 }finally{f.scope.dispose();}
});

test.each(['accessor','readonly','nonconfigurable-readonly','deleted'] as const)('publication still refuses %s storage replacement at the barrier',kind=>{
 const f=fixture('graze','warn');
 try{
  const refs=f.roster.map((body,slot)=>({group:'herd',slot,identity:body.entityId,wire:body.entityId,handle:slot+1,body}));
  if(kind==='nonconfigurable-readonly')Object.defineProperty(f.herd,'trust',{configurable:false,writable:true,value:f.herd.trust});
  const publication=f.herd.prepareValues({...f.herd.captureValues(),trust:41},refs,f.scope),original=Object.getOwnPropertyDescriptor(f.herd,'trust');
  if(original===undefined)throw new Error('Missing storage');let reads=0;const originalValue:unknown=original.value;
  if(kind==='accessor')Object.defineProperty(f.herd,'trust',{configurable:true,get:()=>{reads++;return originalValue;}});
  else if(kind==='deleted')Reflect.deleteProperty(f.herd,'trust');
  else Object.defineProperty(f.herd,'trust',{writable:false});
  expect(()=>publication.commit()).toThrow('Changed herd guest storage');expect(reads).toBe(0);
 }finally{f.scope.dispose();}
});

test('candidate scalar getters are all captured once before schema refusal or publication',()=>{
 for(const invalid of [false,true]){
  const f=fixture('graze','warn');
  try{
   const refs=f.roster.map((body,slot)=>({group:'herd',slot,identity:body.entityId,wire:body.entityId,handle:slot+1,body}));
   const names=Object.keys(saved(f.herd).state),values={...f.herd.captureValues(),trust:41,cx:-0,mode:invalid?'invalid':'graze'},reads:string[]=[];
   for(const name of names){const value:unknown=Reflect.get(values,name);Object.defineProperty(values,name,{enumerable:true,get:()=>{reads.push(name);return value;}});}
   if(invalid)expect(()=>f.herd.prepareValues(values,refs,f.scope)).toThrow();
   else{const publication=f.herd.prepareValues(values,refs,f.scope);publication.validate();publication.commit();expect(f.herd.trust).toBe(41);expect(Object.is(f.herd.cx,-0)).toBe(true);}
   expect(reads).toEqual(names);
  }finally{f.scope.dispose();}
 }
});

test('candidate parser scratch isolates getter reentry and leaves publications detached',()=>{
 const f=fixture('graze','warn');
 try{
  const refs=f.roster.map((body,slot)=>({group:'herd',slot,identity:body.entityId,wire:body.entityId,handle:slot+1,body}));
  const before={trust:f.herd.trust,mode:f.herd.mode},values={...f.herd.captureValues(),mode:'alert'};
  let inner:ReturnType<NativeHerd['prepareValues']>|undefined;
  Object.defineProperty(values,'trust',{enumerable:true,get:()=>{inner=f.herd.prepareValues({...f.herd.captureValues(),trust:17},refs,f.scope);return 41;}});
  const outer=f.herd.prepareValues(values,refs,f.scope);
  outer.commit();expect(f.herd.trust).toBe(41);expect(f.herd.mode).toBe('alert');
  f.herd.trust=before.trust;f.herd.mode=before.mode;
  if(inner===undefined)throw new Error('Missing nested publication');
  inner.commit();expect(f.herd.trust).toBe(17);expect(f.herd.mode).toBe(before.mode);
 }finally{f.scope.dispose();}
});

test('candidate schema errors retain their original input after later parser reuse',()=>{
 const f=fixture('graze','warn');
 try{
  const refs=f.roster.map((body,slot)=>({group:'herd',slot,identity:body.entityId,wire:body.entityId,handle:slot+1,body}));
  let failure:unknown;
  try{f.herd.prepareValues({...f.herd.captureValues(),mode:'invalid'},refs,f.scope);}catch(error){failure=error;}
  if(!v.isValiError(failure))throw new Error('Missing original schema error');
  const input=failure.issues[0]?.path?.[0]?.input;
  if(typeof input!=='object'||input===null)throw new Error('Missing schema input');
  expect(Reflect.get(input,'mode')).toBe('invalid');const before=JSON.stringify(failure.issues);
  f.herd.prepareValues({...f.herd.captureValues(),trust:41},refs,f.scope).commit();
  expect(f.herd.trust).toBe(41);expect(JSON.stringify(failure.issues)).toBe(before);
  const values={...f.herd.captureValues()};Object.defineProperty(values,'trust',{enumerable:true,get:()=>{throw new Error('candidate getter refusal');}});
  expect(()=>f.herd.prepareValues(values,refs,f.scope)).toThrow('candidate getter refusal');
  f.herd.prepareValues({...f.herd.captureValues(),trust:53},refs,f.scope).commit();expect(f.herd.trust).toBe(53);
 }finally{f.scope.dispose();}
});

test('parser scratch preserves a changed scalar key order and missing error input fields',()=>{
 const f=fixture('graze','warn');
 try{
  const refs=f.roster.map((body,slot)=>({group:'herd',slot,identity:body.entityId,wire:body.entityId,handle:slot+1,body}));
  f.herd.prepareValues(f.herd.captureValues(),refs,f.scope).validate();
  const state=Object.fromEntries(Object.entries(saved(f.herd).state).reverse());delete state['trust'];state['mode']='invalid';
  Object.defineProperty(f.herd,'herdGuestScalars',{value:()=>state});
  let failure:unknown;try{f.herd.prepareValues(f.herd.captureValues(),refs,f.scope);}catch(error){failure=error;}
  if(!v.isValiError(failure))throw new Error('Missing original schema error');
  const input=failure.issues[0]?.path?.[0]?.input;
  if(typeof input!=='object'||input===null)throw new Error('Missing schema input');
  expect(Object.keys(input)).toEqual(Object.keys(state));expect(Object.hasOwn(input,'trust')).toBe(false);
 }finally{f.scope.dispose();}
});

test('publication reads the scalar snapshot getters before candidate getters',()=>{
 const f=fixture('graze','warn');
 try{
  const refs=f.roster.map((body,slot)=>({group:'herd',slot,identity:body.entityId,wire:body.entityId,handle:slot+1,body}));
  const state=saved(f.herd).state,values=f.herd.captureValues(),names=Object.keys(state),reads:string[]=[];
  for(const name of names){const scalar:unknown=state[name],value=values[name];
   Object.defineProperty(state,name,{enumerable:true,get:()=>{reads.push(`scalar:${name}`);return scalar;}});
   Object.defineProperty(values,name,{enumerable:true,get:()=>{reads.push(`candidate:${name}`);return value;}});
  }
  Object.defineProperty(f.herd,'herdGuestScalars',{value:()=>state});
  f.herd.prepareValues(values,refs,f.scope).validate();
  expect(reads).toEqual([...names.map(name=>`scalar:${name}`),...names.map(name=>`candidate:${name}`)]);
 }finally{f.scope.dispose();}
});


test('all herd body-only modes leave both borrowed RNG streams unchanged',()=>{
 for(const mode of modes)for(const state of states){
  const f=fixture(mode,state);
  try{
   execute(f,0,false,'addTrust',{argument:0});
   const before=[f.random.snapshot(),f.contextRandom.snapshot()];
   for(let slot=0;slot<f.roster.length;slot++)execute(f,slot,true);
   expect([f.random.snapshot(),f.contextRandom.snapshot()]).toEqual(before);
  }finally{f.scope.dispose();}
 }
});
