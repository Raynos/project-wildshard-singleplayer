import {expect,test,vi} from 'vitest';
import * as v from 'valibot';
import {Vector3} from 'three';
import {Scope} from '../src/engine/app/scope';
import type {AnimalSim} from '../src/engine/entities/AnimalSim';
import type {SimHost,SimValue} from '../src/engine/sim';
import {installEliteEncounters,eliteBindings,type EliteEncounterPorts,type EliteEncounterRow} from '../src/game/shardfile/eliteEncounters';
import {installEliteEncounters as originalInstall} from './fixtures/originalEliteEncounters';
import {legacyDouble} from './fake/FakeGame';
import admission from '../src/shards/nalati-grasslands/behaviour/admission.generated.json' with {type:'json'};
import program from '../src/shards/nalati-grasslands/behaviour/eliteGroup.generated.json' with {type:'json'};
import law from '../src/shards/nalati-grasslands/data/eliteGroup.json' with {type:'json'};

function fixture(original:boolean){
  const scope=new Scope('native.group'),trace:unknown[][]=[];
  const actor=legacyDouble<AnimalSim>({entityId:'body1',kind:'reed',variant:'silver',alive:true,position:new Vector3(-0,2.25,3.123456789012345),hp:90,maxHp:100,scale:1});
  const adopted=legacyDouble<AnimalSim>({entityId:'body2',kind:'reed',variant:'companion',alive:true,scale:1});
  const group={stallion:actor as AnimalSim|null,stallionState:'display',leadAway:(x:number,z:number)=>{trace.push(['lead',x,z]);}};
  const taming={phase:'free',tulpar:null as AnimalSim|null};
  let adapter:Parameters<SimHost['onStep']>[2];
  const host=legacyDouble<SimHost>({scope,level:legacyDouble<SimHost['level']>({id:'marsh'}),entities:new Map([[actor.entityId,actor],[adopted.entityId,adopted]]),
    player:legacyDouble<SimHost['player']>({position:new Vector3(4.123456789012345,0,-0),health:legacyDouble<SimHost['player']['health']>({})}),
    onStep:(_id,_step,saved)=>{adapter=saved;return()=>undefined;},groundHeightAt:()=>0});
  const row:EliteEncounterRow={def:{id:'reed',lair:{x:0,z:0,r:1},awareR:10,engageR:5,leashR:20,rule:'always',respawnMin:5},keeper:'herd',snapshot:'keeper',member:{kind:'reed',variant:'silver',source:'herd',yaw:0},brokenState:'beaten',onAdopted:{action:'win-and-detach',variant:'companion',scale:1.3}};
  const states={display:1,charge:2,beaten:3};
  const ports=legacyDouble<EliteEncounterPorts>({bindings:eliteBindings(),herd:()=>group,taming:()=>taming,keepers:{pouncer:legacyDouble<EliteEncounterPorts['keepers']['pouncer']>({}),howler:legacyDouble<EliteEncounterPorts['keepers']['howler']>({}),herd:{rows:original?{signal:'argymaqTick',states}:{law,states},program:original?admission:program}},ledges:[],heightAt:()=>0,environment:()=>({playerCrouched:false,playerFwdX:0,playerFwdZ:1,grassHeightAt:()=>0}),packs:()=>[]});
  const result=(original?originalInstall:installEliteEncounters)(host,{step:'marsh.elites',version:1,conditions:{mode:'phase',phase:()=> 'day',storm:()=>false},rows:[row],ports,wire:{detached:'detached'}});
  if(adapter===undefined)throw new Error('Missing save adapter');
  const signature=vi.spyOn(result.core,'signature').mockImplementation(id=>{trace.push(['signature',id]);});
  const won=vi.spyOn(result.core,'won').mockImplementation(id=>{trace.push(['won',id]);});
  result.initialize();const script=result.scripts[0];if(script===undefined)throw new Error('Missing original controller');
  return{scope,host,actor,adopted,group,taming,result,script,save:adapter,trace,signature,won};
}
function record(value:SimValue):Record<string,SimValue>{if(value===null||typeof value!=='object'||Array.isArray(value))throw new Error('Missing record');return value;}
test('native ABI2 group keeps exact original save bytes, unknown states, cadence and effect order',()=>{
  const old=fixture(true),current=fixture(false),restored=fixture(false);
  try{
    for(const dt of [.03,.07,.025,.075]){old.script.tick(dt,0,false,false);current.script.tick(dt,0,false,false);expect(current.save.snapshot()).toEqual(old.save.snapshot());}
    expect(current.trace).toEqual(old.trace);expect(current.trace[0]?.[0]).toBe('signature');
    const initial=record(current.save.snapshot()),member=record(initial['keeper']??null),keeper=record(member['keeper']??null);
    const historical={...initial,keeper:{...member,keeper:{...keeper,lastState:'unknown saved state',elapsed:-0,laneFrom:[-0,.123456789012345,8],runT:-2.75}}};
    old.save.restore(historical);current.save.restore(historical);restored.save.restore(historical);
    expect(JSON.stringify(current.save.snapshot())).toBe(JSON.stringify(old.save.snapshot()));expect(Object.is(record(record(record(current.save.snapshot())['keeper']??null)['keeper']??null)['elapsed'],-0)).toBe(true);
    for(const f of [old,current,restored]){f.group.stallionState='charge';f.script.enterPhase2();f.script.tick(.1,0,true,false);}
    expect(current.trace).toEqual(old.trace);expect(current.trace.at(-1)?.[0]).toBe('lead');expect(current.save.snapshot()).toEqual(old.save.snapshot());expect(restored.save.snapshot()).toEqual(current.save.snapshot());
    for(const f of [old,current]){f.group.stallionState='beaten';f.group.stallion=null;f.taming.phase='bonded';f.taming.tulpar=f.adopted;f.script.tick(.1,0,true,false);}
    expect(current.trace).toEqual(old.trace);expect(current.adopted.scale).toBe(1.3);expect(JSON.stringify(current.save.snapshot())).toBe(JSON.stringify(old.save.snapshot()));
  }finally{old.scope.dispose();current.scope.dispose();restored.scope.dispose();}
});
test('complete native restore preflights historical payload and actor identity before changing any state',()=>{
  const f=fixture(false);try{
    f.script.tick(.04,0,false,false);const saved=record(f.save.snapshot()),member=record(saved['keeper']??null),keeper=record(member['keeper']??null),bytes=JSON.stringify(saved);
    for(const invalid of [{...keeper,laneFrom:[1,2]},{...keeper,elapsed:Infinity},{...keeper,extra:1}]){expect(()=>f.save.restore({...saved,keeper:{...member,keeper:invalid}})).toThrow();expect(JSON.stringify(f.save.snapshot())).toBe(bytes);}
    expect(()=>f.save.restore({...saved,keeper:{...member,animal:'missing'}})).toThrow();expect(JSON.stringify(f.save.snapshot())).toBe(bytes);
    const{elapsed,...legacy}=keeper;expect(elapsed).toBe(.04);f.save.restore({...saved,keeper:{...member,keeper:legacy}});expect(record(record(record(f.save.snapshot())['keeper']??null)['keeper']??null)['elapsed']).toBe(0);
    const Value:v.GenericSchema<SimValue>=v.lazy(()=>v.union([v.null(),v.boolean(),v.number(),v.string(),v.array(Value),v.record(v.string(),Value)]));
    const wire=JSON.stringify(f.save.snapshot());f.save.restore(v.parse(Value,JSON.parse(wire)));expect(JSON.stringify(f.save.snapshot())).toBe(wire);
  }finally{f.scope.dispose();}
});
