import {beforeAll,expect,test} from 'vitest';
import mainSource from '../src/shards/pine-hollow/behaviour/contracts.as?raw';
import randomSource from '../src/shards/pine-hollow/behaviour/contractsRandom.as?raw';
import rulesSource from '../src/shards/pine-hollow/behaviour/contractsRules.as?raw';
import {compileDecisionScripts} from '../src/sdk/buildDecisionScripts';
import {ReturnProgram} from '../src/game/population/returnProgram';
import {CONTRACT_PROGRAM_SCRIPT,contractProgramRegistries} from '../src/shards/pine-hollow/generators/contractProgram';
import {contractFor} from '../src/game/quest/contracts';
import {CONTRACTS} from './fixtures/pine-contracts';
import baseline from './fixtures/legacy-contract-boundaries.json' with {type:'json'};

let guest:ReturnProgram|undefined;
beforeAll(async()=>{
 const sources=new Map([['behaviour/contracts.as',mainSource],['behaviour/contractsRandom.as',randomSource],['behaviour/contractsRules.as',rulesSource]]);
 const built=await compileDecisionScripts([CONTRACT_PROGRAM_SCRIPT],contractProgramRegistries(),sources,{asLineCeiling:256,singleSignal:true}),script=built.rows[0],blob=built.blobs[0];
 if(script===undefined||blob===undefined)throw new Error('Missing compiled contract guest');
 guest=ReturnProgram.page({script,bytes:btoa(Array.from(blob.bytes,byte=>String.fromCodePoint(byte)).join(''))});
},30_000);
function project(signal:string,values:Readonly<Record<string,number>>,candidates:readonly Readonly<Record<string,number>>[]=[]):Readonly<Record<string,number>>{
 if(guest===undefined)throw new Error('Contract guest is not prepared');
 const frame:Record<string,number>=Object.fromEntries(Object.values(CONTRACT_PROGRAM_SCRIPT.fields).map(id=>[id,0]));
 for(const [key,value]of Object.entries(values))frame[`contract.${key}`]=value;
 return guest.project(`contract.${signal}`,frame,undefined,candidates);
}
function out(values:Readonly<Record<string,number>>,key:string):number{
 const value=values[`contract.${key}`];if(value===undefined)throw new Error(`Missing contract channel ${key}`);return value;
}
function arrays(a:readonly number[]=[],b:readonly number[]=[],c:readonly number[]=[]):Record<string,number>{
 const frame:Record<string,number>={};
 for(const [prefix,values]of [['a',a],['b',b],['c',c]]as const)values.forEach((value,i)=>{frame[`${prefix}${String(i).padStart(2,'0')}`]=value;});
 return frame;
}
test('AS preserves legacy offers for fractional, negative and large f64 serials',()=>{
 for(const {serial,offer}of baseline.draws){
  const initial=CONTRACTS.initial[serial],first=initial===undefined?-1:CONTRACTS.rows.findIndex(row=>row.kind===initial.kind&&row.target===initial.target);
  const result=project('draw',{serial,salt:0,first,count:CONTRACTS.draws.length,...arrays(CONTRACTS.draws.map(row=>row.below),CONTRACTS.draws.map(row=>row.targets.length))});
  const index=out(result,'index'),band=CONTRACTS.draws[out(result,'band')],target=band?.targets[out(result,'target')];
  const row=index>=0?CONTRACTS.rows[index]:CONTRACTS.rows.find(entry=>entry.kind===band?.kind&&entry.target===target);
  if(row===undefined)throw new Error(`Guest selected an undeclared offer: ${JSON.stringify({serial,result})}`);
  expect(contractFor(CONTRACTS,serial,row.kind,row.target)).toEqual(offer);
 }
});
test('AS retains overlapping tag predicates and an unlisted elite still excludes a rarity offer',()=>{
 expect(out(project('tag',{kind:1,variant:2,label:-2,count:2,...arrays([1,-1],[2,-1],[-1,3])}),'value')).toBe(1);
 expect(out(project('tag',{kind:4,variant:2,label:-2,count:2,...arrays([1,-1],[2,-1],[-1,3])}),'value')).toBe(0);
 expect(out(project('tag',{kind:4,variant:2,label:3,count:2,...arrays([1,-1],[2,-1],[-1,3])}),'value')).toBe(1);
 const values={match:3,target:2,kind:1,elite:-1,tagged:0,excluded:0,excludeElite:1,rank:2,targetRank:2,knownRank:1,below:3};
 expect(out(project('count',values),'value')).toBe(1);
 expect(out(project('count',{...values,elite:-2}),'value')).toBe(0);
 expect(out(project('count',{...values,rank:3}),'value')).toBe(0);
 expect(out(project('count',{...values,knownRank:0}),'value')).toBe(0);
});
test('AS keeps bounded retries, authored fallback, third-claim finish and tear streak semantics',()=>{
 expect(out(project('collision',{candidate:3,count:3,...arrays([1,3,5])}),'value')).toBe(1);
 expect(project('drawFinish',{candidate:3,excluded:1,salt:22,attempts:24,fallback:8})).toMatchObject({'contract.retry':1,'contract.salt':23});
 expect(project('drawFinish',{candidate:3,excluded:1,salt:23,attempts:24,fallback:8})).toMatchObject({'contract.retry':0,'contract.index':8});
 expect(project('claim',{valid:1,have:3,need:3,next:7,claimed:2,streak:0,best:2,count:1,...arrays([3])})).toMatchObject({'contract.status':1,'contract.next':8,'contract.claimed':3,'contract.streak':1,'contract.best':2,'contract.milestone':0});
 expect(project('tear',{valid:1,next:8,streak:6})).toMatchObject({'contract.status':1,'contract.next':9,'contract.streak':0});
});
test('AS preserves strict prompt distance, modal action range and restore rejection',()=>{
 expect(out(project('near',{x:7,y:2,z:9,px:4,py:2,pz:9,radius:3}),'value')).toBe(0);
 expect(out(project('near',{x:6.99,y:2,z:9,px:4,py:2,pz:9,radius:3}),'value')).toBe(1);
 expect(project('use',{valid:1,pointValid:1,value:10,open:0,slots:3})).toMatchObject({'contract.operation':0,'contract.open':0});
 expect(project('use',{valid:1,value:11,open:1,slots:3})).toMatchObject({'contract.operation':1,'contract.slot':1});
 const candidate={serial:0,have:1,need:2,valid:1},frame={count:2,slots:2,next:2,claimed:0,streak:0,best:0};
 const one:Record<string,number>=Object.fromEntries(Object.entries(candidate).map(([key,value]):[string,number]=>[`contract.${key}`,value]));
 const two={...one,'contract.serial':1};
 expect(out(project('restore',{...frame,candidate:1},[one,two]),'value')).toBe(1);
 expect(out(project('restore',{...frame,candidate:1},[one,one]),'value')).toBe(0);
 expect(out(project('restore',{...frame,best:1,candidate:1},[one,two]),'value')).toBe(0);
});

test('bounded projection packets fit the unchanged instruction allowance',()=>{
 expect(out(project('tag',{kind:9,variant:2,label:3,count:4,...arrays(Array.from({length:4},(_,i)=>i===3?9:1),Array.from({length:4},()=>-1),Array.from({length:4},()=>-1))}),'value')).toBe(1);
 const candidates=Array.from({length:8},(_,serial)=>({'contract.serial':serial,'contract.have':0,'contract.need':2,'contract.valid':1}));
 expect(out(project('restore',{candidate:7,count:8,slots:8,next:8,claimed:0,streak:0,best:0},candidates),'value')).toBe(1);
});
