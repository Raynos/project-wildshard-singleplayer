import {lendNalatiAdmission,admission} from './fixtures/nalati-return-modules';
import {ReturnProjectionV2} from '../src/game/population/returnProjectionV2';
import {expect,test,vi} from 'vitest';
import {Vector3} from 'three';
import {Scope} from '../src/engine/app/scope';
import {AnimalSim} from '../src/engine/entities/AnimalSim';
import {Rng} from '../src/engine/core/rng';
import {ObservationColumnsV2} from '../src/engine/script/observationColumnsV2';
import {ActorProjectionV2,type ActorProjectionContext,type ActorProjectionOwner} from '../src/game/population/actorProjectionV2';
import {ReturnProgram} from '../src/game/population/returnProgram';
import {SIM_LEVEL} from './fixtures/sim-level/level';
import page from '../src/shards/nalati-grasslands/data/crowdProjection.json' with {type:'json'};
import native from '../src/shards/nalati-grasslands/data/crowdNativeProjection.json' with {type:'json'};
import {OriginalNativeGuard} from './fixtures/originalNativeGuard';
import {legacyDouble} from './fake/FakeGame';

function fixture(step:unknown=page){
  const scope=new Scope('crowd-test'),first=SIM_LEVEL.entities[0];if(first===undefined)throw new Error('Missing guard');
  lendNalatiAdmission(scope);
  const actor=new AnimalSim(first.spec,first.seed,first.scale,'guard',{heightAt:()=>0,random:()=>.5});
  actor.position.set(7,2,3);
  const random=new Rng(37),calls:unknown[][]=[];
  const flock={cx:1,cz:2,straggler:vi.fn(()=>-1),positions:vi.fn((_index:number,out:Vector3)=>{out.set(15,4,9);})};
  const wolf={alive:true,position:new Vector3(18,5,2)},wolves=[wolf];
  const context=legacyDouble<ActorProjectionContext<AnimalSim>>({dt:1/60,t:0,player:new Vector3(8,3,6),calm:false,playerSpeed:0,
    pathYaw:(_a:AnimalSim,x:number,z:number,period:number)=>{calls.push(['path',x,z,period]);return .25;},
    steer:(_a:AnimalSim,yaw:number,speed:number,turn:number)=>{calls.push(['steer',yaw,speed,turn]);},
    confine:()=>{calls.push(['confine']);}});
  const owner:ActorProjectionOwner={scope,group:'crowd',slot:0,identity:actor.entityId,random,
    crowd:{owner:flock,point:new Vector3()},rosters:new Map([['threats',wolves]])};
  const binding=new ActorProjectionV2('guard',{program:admission,step});
  return {scope,actor,random,calls,flock,wolf,wolves,context,owner,binding};
}

test('guard cadence skips before capture; each due frame samples only its original crowd and threat roster once',()=>{
  const f=fixture({...page,operations:page.operations.filter(op=>op.kind!=='sound-position')});
  const capture=vi.spyOn(ObservationColumnsV2.prototype,'capture'),project=vi.spyOn(ReturnProjectionV2.prototype,'prepare');
  try{
    const perFrame:number[]=[];
    for(let frame=0;frame<600;frame++){
      f.context.t=frame/60;
      const before=capture.mock.calls.length;f.binding.step(f.actor,f.context,f.owner);
      perFrame.push(capture.mock.calls.length-before);
    }
    expect(perFrame.filter(count=>count===1)).toHaveLength(100);
    expect(perFrame.every(count=>count<=1)).toBe(true);
    expect(project).toHaveBeenCalledTimes(100);
    expect(f.flock.straggler).toHaveBeenCalledTimes(100);
    expect(f.flock.positions).not.toHaveBeenCalled();
    expect(f.actor.mem['dogThinkAt']).toBe(9.9);
    const snapshot=f.actor.snapshot(),random=f.random.snapshot();
    f.actor.restore(snapshot);f.random.restore(random);
    expect(JSON.stringify(f.actor.snapshot())).toBe(JSON.stringify(snapshot));
    expect(f.random.snapshot()).toStrictEqual(random);
    expect(f.scope.disposed).toBe(false);
  }finally{capture.mockRestore();project.mockRestore();f.scope.dispose();}
});

test('native rows use the original scheduled context dt, no extra clock, no sound, and no repeated descriptor admission',()=>{
  const f=fixture(native),capture=vi.spyOn(ObservationColumnsV2.prototype,'capture');
  const parse=vi.spyOn(ReturnProgram,'page');
  try{
    // A native actor can have been stunned since its last dog sample. The
    // existing driver supplies the current scheduled dt and stamps BEFORE AS.
    f.actor.mem['dogThinkAt']=1;f.actor.mem['barkT']=8;f.context.t=15;f.context.dt=.1;
    f.actor.mem['dogThinkAt']=f.context.t;f.binding.step(f.actor,f.context,f.owner);
    expect(f.actor.mem['barkT']).toBeCloseTo(7.9);
    f.context.t=15.1;f.actor.mem['dogThinkAt']=f.context.t;f.binding.step(f.actor,f.context,f.owner);
    expect(f.actor.mem['barkT']).toBeCloseTo(7.8);
    expect(capture).toHaveBeenCalledTimes(2);expect(parse).toHaveBeenCalledTimes(1);
    expect(f.calls.map(call=>call[0])).toStrictEqual(['path','steer','confine','path','steer','confine']);
  }finally{capture.mockRestore();parse.mockRestore();f.scope.dispose();}
});

test('due capture is incremental: one native straggler read, live positions, strict first-live nearest tie and no stale roster cache',()=>{
  const f=fixture(native);
  try{
    f.flock.straggler.mockReturnValue(0);f.wolf.alive=false;
    const capture=new ObservationColumnsV2(page.columns,f.scope);
    const values=()=>Object.fromEntries(capture.capture({...f.owner,self:{group:'crowd',slot:0,identity:f.actor.entityId,actor:f.actor},observed:new Map(),
      player:{position:f.context.player},t:0,dt:.1}).map(row=>[row.name,row.value]));
    const before=values();expect(f.flock.straggler).toHaveBeenCalledTimes(1);expect(f.flock.positions).toHaveBeenCalledTimes(1);
    expect(before).toMatchObject({wolf:0,distance:0,wx:0,straggler:1,sx:15,sy:4,sz:9});
    f.wolf.alive=true;f.wolf.position.set(4,8,6);f.wolves.push({alive:true,position:new Vector3(-2,9,-2)});
    expect(values()).toMatchObject({wolf:1,distance:5,wx:4,wy:8,wz:6});
    f.wolves.reverse();expect(values()).toMatchObject({wx:-2,wy:9,wz:-2});
    f.flock.straggler.mockReturnValue(-1);expect(values()).toMatchObject({straggler:0,sx:15,sy:4,sz:9});
  }finally{f.scope.dispose();}
});

test('missing crowd/native ports and sliced retirement refuse before projection writes or random draws',()=>{
  const f=fixture(native),before=f.actor.snapshot(),rng=f.random.snapshot();
  try{
    const {crowd:_crowd,...missing}=f.owner;
    expect(()=>f.binding.step(f.actor,f.context,missing)).toThrow('crowd');
    expect(f.actor.snapshot()).toStrictEqual(before);expect(f.random.snapshot()).toStrictEqual(rng);
    const {pathYaw:_path,...missingNavigation}=f.context;
    expect(()=>f.binding.step(f.actor,missingNavigation,f.owner)).toThrow('native port');
    expect(f.actor.snapshot()).toStrictEqual(before);expect(f.random.snapshot()).toStrictEqual(rng);
    const steps=f.scope.disposeSteps();steps.next();
    expect(()=>f.binding.step(f.actor,f.context,f.owner)).toThrow('disposed');
    expect(f.actor.snapshot()).toStrictEqual(before);for(const _step of steps){/* original retirement */}
  }finally{f.scope.dispose();}
});


test('the original native callback and ABI2 rows keep RNG, JSON continuation and ordered native effects across 600 scheduled ticks',()=>{
  const f=fixture(native),g=fixture(native);
  const clock={now:0};
  const oracle=new OriginalNativeGuard({clock,player:{position:g.context.player},rng:{stream:()=>g.random}},
    {pathYawFor:(_actor,x,z,every)=>{g.calls.push(['path',x,z,every]);return .25;},
      steerAny:(_actor,yaw,speed,turn)=>{g.calls.push(['steer',yaw,speed,turn]);},confine:()=>{g.calls.push(['confine']);}},
    [{...g.flock,dog:g.actor}],g.wolves,{dogDecision:'dog',stragglerDistance:12},ReturnProgram.page({script:admission.script,bytes:admission.bytes}));
  const near=(a:unknown,b:unknown):void=>{
    if(typeof a==='number'&&typeof b==='number'){expect(a).toBeCloseTo(b,11);return;}
    if(Array.isArray(a)&&Array.isArray(b)){expect(a.length).toBe(b.length);a.forEach((value,index)=>near(value,b[index]));return;}
    if(typeof a==='object'&&a!==null&&typeof b==='object'&&b!==null){expect(Object.keys(a)).toStrictEqual(Object.keys(b));for(const key of Object.keys(a))near(Reflect.get(a,key),Reflect.get(b,key));return;}
    expect(a).toBe(b);
  };
  try{
    for(let tick=0;tick<600;tick++){
      const phase=Math.floor(tick/60)%3;
      f.wolf.alive=g.wolf.alive=phase===0;
      f.flock.straggler.mockReturnValue(phase===1?0:-1);g.flock.straggler.mockReturnValue(phase===1?0:-1);
      f.context.dt=g.context.dt=tick===300?.7:.1;
      f.context.t=clock.now=tick*.1+(tick>=300?.6:0);
      // The original native driver stamps before calling either implementation.
      f.actor.mem['dogThinkAt']=clock.now;f.binding.step(f.actor,f.context,f.owner);
      oracle.step(g.actor,g.context.dt);
      near(f.actor.snapshot(),g.actor.snapshot());near(f.calls,g.calls);
      expect(f.random.snapshot()).toStrictEqual(g.random.snapshot());
      if(tick===250){const saved=f.actor.snapshot(),encoded=JSON.stringify(saved);f.actor.restore(saved);expect(JSON.stringify(f.actor.snapshot())).toBe(encoded);}
      f.calls.length=g.calls.length=0;
    }
  }finally{f.scope.dispose();g.scope.dispose();}
});


test('invalid declared state refuses the entire guard output before memory, motion or RNG publication',()=>{
  const f=fixture(native),programme=f.binding.program(f.scope),before=f.actor.snapshot(),random=f.random.snapshot();
  const prepare=programme.prepare;if(prepare===undefined)throw new Error('Missing selected prepare');
  const invalid=vi.spyOn(programme,'prepare').mockImplementation((...args)=>{const candidate=prepare(...args);return {...candidate,values:{...candidate.values,state:99}};});
  try{expect(()=>f.binding.step(f.actor,f.context,f.owner)).toThrow('Invalid actor projection state');expect(f.actor.snapshot()).toStrictEqual(before);expect(f.random.snapshot()).toStrictEqual(random);expect(f.calls).toStrictEqual([]);}
  finally{invalid.mockRestore();f.scope.dispose();}
});
